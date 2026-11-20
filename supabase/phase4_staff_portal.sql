-- GymFit Phase 4 Staff Portal migration
-- Apply this AFTER supabase/phase4.sql on a fresh Supabase project.
-- This migration adds staff member/payment RPCs and attendance monitoring.
-- It assumes the base Phase 4 schema already provides:
-- profiles, subscriptions, plans, payments, admins, user_roles,
-- public.is_admin(), public._finalize_payment(), and public._log_payment_event().

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Attendance table and indexes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    checked_in_at timestamptz NOT NULL DEFAULT now(),
    checked_out_at timestamptz,
    recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_attendance_times
        CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_attendance_per_member
    ON public.attendance_records(user_id)
    WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS attendance_user_history_idx
    ON public.attendance_records(user_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS attendance_date_idx
    ON public.attendance_records(checked_in_at DESC);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Direct table access is intentionally blocked. Staff/admin screens use
-- the SECURITY DEFINER RPC functions below.
REVOKE ALL ON TABLE public.attendance_records FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Staff member list
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_members(
    p_search text DEFAULT NULL,
    p_status text DEFAULT 'all',
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
RETURNS TABLE(
    user_id uuid,
    full_name text,
    email text,
    joined_at timestamptz,
    status text,
    plan_name text,
    start_date timestamptz,
    end_date timestamptz,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_now timestamptz := now();
    v_q text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
    IF NOT public.is_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role = 'staff'
       )
    THEN
        RAISE EXCEPTION 'not_staff';
    END IF;

    IF v_q IS NOT NULL THEN
        v_q := '%' || replace(replace(replace(v_q, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
    END IF;

    RETURN QUERY
    WITH latest AS (
        SELECT DISTINCT ON (s.user_id)
            s.user_id,
            s.plan_id,
            s.status AS sub_status,
            s.start_date,
            s.end_date
        FROM public.subscriptions s
        ORDER BY s.user_id, s.created_at DESC
    ),
    base AS (
        SELECT
            pr.id AS uid,
            coalesce(pr.full_name, '') AS fname,
            coalesce(pr.email, '') AS femail,
            pr.created_at AS joined,
            CASE
                WHEN l.user_id IS NULL OR l.sub_status = 'cancelled' THEN 'none'
                WHEN l.sub_status = 'active' AND l.end_date <= v_now THEN 'expired'
                ELSE l.sub_status
            END AS effective_status,
            l.plan_id,
            l.start_date AS sdate,
            l.end_date AS edate
        FROM public.profiles pr
        LEFT JOIN latest l ON l.user_id = pr.id
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.admins a
            WHERE a.user_id = pr.id
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = pr.id
              AND ur.role = 'admin'
        )
        AND (
            v_q IS NULL
            OR pr.full_name ILIKE v_q
            OR pr.email ILIKE v_q
        )
    )
    SELECT
        b.uid,
        b.fname,
        b.femail,
        b.joined,
        b.effective_status,
        coalesce(pl.name, ''),
        b.sdate,
        b.edate,
        count(*) OVER ()
    FROM base b
    LEFT JOIN public.plans pl
        ON pl.id = b.plan_id
       AND b.effective_status <> 'none'
    WHERE CASE coalesce(p_status, 'all')
        WHEN 'all' THEN true
        WHEN 'expiring' THEN
            b.effective_status = 'active'
            AND b.edate <= v_now + interval '7 days'
        ELSE b.effective_status = p_status
    END
    ORDER BY b.joined DESC
    LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
    OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Staff pending cash/gym payments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_pending_payments()
RETURNS TABLE(
    payment_id uuid,
    reference text,
    member_name text,
    member_email text,
    plan_name text,
    amount integer,
    kind text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    IF NOT public.is_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role = 'staff'
       )
    THEN
        RAISE EXCEPTION 'not_staff';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.reference,
        coalesce(pr.full_name, ''),
        coalesce(pr.email, ''),
        pl.name,
        p.amount,
        p.kind,
        p.created_at
    FROM public.payments p
    JOIN public.plans pl ON pl.id = p.plan_id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.status = 'pending'
      AND p.method = 'gym'
    ORDER BY p.created_at ASC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Staff payment approval/rejection
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_review_payment(
    p_payment_id uuid,
    p_approve boolean,
    p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_actor uuid := auth.uid();
    v_now timestamptz := now();
    v_pay public.payments;
    v_result jsonb;
    v_reason text;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'not_logged_in';
    END IF;

    IF NOT public.is_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = v_actor
             AND ur.role = 'staff'
       )
    THEN
        RAISE EXCEPTION 'not_staff';
    END IF;

    SELECT *
    INTO v_pay
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'payment_not_found';
    END IF;

    IF v_pay.status <> 'pending' THEN
        RAISE EXCEPTION 'payment_not_pending';
    END IF;

    IF v_pay.method <> 'gym' THEN
        RAISE EXCEPTION 'not_cash_payment';
    END IF;

    IF v_pay.user_id = v_actor THEN
        RAISE EXCEPTION 'cannot_review_own_payment';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_pay.user_id::text, 0)
    );

    IF p_approve THEN
        v_result := public._finalize_payment(
            v_pay.id,
            NULL,
            v_actor
        );

        UPDATE public.payments
        SET reviewed_by = v_actor,
            reviewed_at = v_now
        WHERE id = v_pay.id;

        RETURN v_result;
    END IF;

    v_reason := coalesce(
        nullif(trim(p_reason), ''),
        'Rejected by staff'
    );

    UPDATE public.payments
    SET status = 'rejected',
        rejection_reason = v_reason,
        reviewed_by = v_actor,
        reviewed_at = v_now
    WHERE id = v_pay.id;

    UPDATE public.subscriptions
    SET status = 'cancelled',
        cancelled_at = v_now,
        ended_reason = 'payment_rejected'
    WHERE id = v_pay.subscription_id
      AND status = 'pending';

    PERFORM public._log_payment_event(
        v_pay.id,
        'rejected',
        v_actor,
        jsonb_build_object('reason', v_reason)
    );

    RETURN jsonb_build_object(
        'result', 'rejected',
        'payment_id', v_pay.id,
        'reason', v_reason
    );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Attendance list
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_attendance_list(
    p_search text DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    full_name text,
    email text,
    checked_in_at timestamptz,
    checked_out_at timestamptz,
    recorded_by uuid,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_q text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
    IF NOT public.is_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role = 'staff'
       )
    THEN
        RAISE EXCEPTION 'not_staff';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.user_id,
        coalesce(pr.full_name, ''),
        coalesce(pr.email, ''),
        a.checked_in_at,
        a.checked_out_at,
        a.recorded_by,
        count(*) OVER ()
    FROM public.attendance_records a
    JOIN public.profiles pr ON pr.id = a.user_id
    WHERE (
        v_q IS NULL
        OR pr.full_name ILIKE '%' || v_q || '%'
        OR pr.email ILIKE '%' || v_q || '%'
    )
    ORDER BY a.checked_in_at DESC
    LIMIT greatest(1, least(coalesce(p_limit, 50), 100))
    OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Attendance check-in (requires a currently valid active membership)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_attendance_check_in(
    p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_id uuid;
BEGIN
    IF NOT public.is_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role = 'staff'
       )
    THEN
        RAISE EXCEPTION 'not_staff';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles pr
        WHERE pr.id = p_user_id
    ) THEN
        RAISE EXCEPTION 'member_not_found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM (
            SELECT s.status, s.start_date, s.end_date
            FROM public.subscriptions s
            WHERE s.user_id = p_user_id
            ORDER BY s.created_at DESC
            LIMIT 1
        ) latest
        WHERE latest.status = 'active'
          AND latest.start_date <= now()
          AND latest.end_date > now()
    ) THEN
        RAISE EXCEPTION 'active_membership_required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.attendance_records a
        WHERE a.user_id = p_user_id
          AND a.checked_out_at IS NULL
    ) THEN
        RAISE EXCEPTION 'member_already_checked_in';
    END IF;

    INSERT INTO public.attendance_records (user_id, recorded_by)
    VALUES (p_user_id, auth.uid())
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Attendance check-out
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_attendance_check_out(
    p_attendance_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    IF NOT public.is_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role = 'staff'
       )
    THEN
        RAISE EXCEPTION 'not_staff';
    END IF;

    UPDATE public.attendance_records
    SET checked_out_at = now()
    WHERE id = p_attendance_id
      AND checked_out_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'attendance_not_found_or_already_checked_out';
    END IF;

    RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Explicit RPC permissions
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.staff_members(text, text, integer, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_pending_payments()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_review_payment(uuid, boolean, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_attendance_list(text, integer, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_attendance_check_in(uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_attendance_check_out(uuid)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.staff_members(text, text, integer, integer)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_pending_payments()
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_review_payment(uuid, boolean, text)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_attendance_list(text, integer, integer)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_attendance_check_in(uuid)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_attendance_check_out(uuid)
    TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
