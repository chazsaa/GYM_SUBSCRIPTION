
-- =========================================================
-- GYMFIT - PHASE 3: PAYMENT MANAGEMENT
-- COMPLETE STAFF / ADMIN PAYMENT SECURITY MIGRATION
-- =========================================================


-- =========================================================
-- 1. USER ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member'
        CHECK (role IN ('member', 'staff', 'admin')),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 2. ADMIN VERIFICATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = (SELECT auth.uid())
          AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- =========================================================
-- 3. STAFF / ADMIN VERIFICATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = (SELECT auth.uid())
          AND role IN ('staff', 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.is_staff_or_admin()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_staff_or_admin()
TO authenticated;


-- =========================================================
-- 4. USER ROLE POLICIES
-- =========================================================

DROP POLICY IF EXISTS "Users can read own role"
ON public.user_roles;

DROP POLICY IF EXISTS "Admins can read all roles"
ON public.user_roles;

CREATE POLICY "Users can read own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((SELECT public.is_admin()));


-- =========================================================
-- 5. ADMIN-ONLY ROLE ASSIGNMENT
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_user_role(
    p_user_id uuid,
    p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    IF p_role IS NULL
       OR p_role NOT IN ('member', 'staff', 'admin') THEN
        RAISE EXCEPTION 'invalid_role';
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role)
    ON CONFLICT (user_id)
    DO UPDATE SET role = EXCLUDED.role;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text)
TO authenticated;


-- =========================================================
-- 6. USER ROLE TABLE PERMISSIONS
-- =========================================================

REVOKE ALL PRIVILEGES
ON TABLE public.user_roles
FROM anon, authenticated;

GRANT SELECT
ON TABLE public.user_roles
TO authenticated;


-- =========================================================
-- 7. PAYMENT REVIEW COLUMNS
-- =========================================================

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS reviewed_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS rejection_reason text;


-- =========================================================
-- 8. STAFF PAYMENT VISIBILITY
-- =========================================================

DROP POLICY IF EXISTS "Staff can read all payments"
ON public.payments;

CREATE POLICY "Staff can read all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
    (SELECT public.is_staff_or_admin())
);


-- =========================================================
-- 9. SECURE PENDING PAYMENT COMPLETION
-- Members cannot self-approve cash payments.
-- Online methods remain simulated until gateway verification.
-- =========================================================

CREATE OR REPLACE FUNCTION public.complete_pending_payment(
    p_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_uid uuid := auth.uid();
    v_now timestamptz := now();
    v_plan public.plans;
    v_sub public.subscriptions;
    v_payment public.payments;

BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_logged_in';
    END IF;

    IF p_method IS NULL
       OR p_method NOT IN ('gcash', 'maya', 'card') THEN
        RAISE EXCEPTION 'invalid_method';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_uid::text, 0)
    );

    SELECT *
    INTO v_sub
    FROM public.subscriptions
    WHERE user_id = v_uid
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'no_pending_membership';
    END IF;

    IF v_sub.method IS DISTINCT FROM p_method THEN
        RAISE EXCEPTION 'payment_method_mismatch';
    END IF;

    SELECT *
    INTO v_payment
    FROM public.payments
    WHERE subscription_id = v_sub.id
      AND user_id = v_uid
      AND status = 'pending'
      AND method = p_method
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'no_pending_payment';
    END IF;

    SELECT *
    INTO v_plan
    FROM public.plans
    WHERE id = v_sub.plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'plan_not_found';
    END IF;

    UPDATE public.subscriptions
    SET status = 'active',
        start_date = v_now,
        end_date = v_now + make_interval(days => v_plan.days)
    WHERE id = v_sub.id;

    UPDATE public.payments
    SET status = 'paid',
        paid_at = v_now
    WHERE id = v_payment.id;

    RETURN jsonb_build_object('result', 'active');
END;

$function$;

REVOKE ALL ON FUNCTION public.complete_pending_payment(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_pending_payment(text)
TO authenticated;


-- =========================================================
-- 10. STAFF APPROVES CASH PAYMENT
-- =========================================================

CREATE OR REPLACE FUNCTION public.approve_cash_payment(
    p_payment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_uid uuid := auth.uid();
    v_now timestamptz := now();
    v_payment public.payments;
    v_sub public.subscriptions;
    v_plan public.plans;

BEGIN
    IF v_uid IS NULL
       OR NOT public.is_staff_or_admin() THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    SELECT *
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'payment_not_found';
    END IF;

    IF v_payment.method IS DISTINCT FROM 'gym' THEN
        RAISE EXCEPTION 'not_a_cash_payment';
    END IF;

    IF v_payment.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'payment_not_pending';
    END IF;

    IF v_payment.subscription_id IS NULL THEN
        RAISE EXCEPTION 'subscription_not_found';
    END IF;

    SELECT *
    INTO v_sub
    FROM public.subscriptions
    WHERE id = v_payment.subscription_id
      AND user_id = v_payment.user_id
    FOR UPDATE;

    IF NOT FOUND OR v_sub.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'membership_not_pending';
    END IF;

    SELECT *
    INTO v_plan
    FROM public.plans
    WHERE id = v_sub.plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'plan_not_found';
    END IF;

    UPDATE public.payments
    SET status = 'paid',
        paid_at = v_now,
        reviewed_by = v_uid,
        reviewed_at = v_now,
        rejection_reason = NULL
    WHERE id = v_payment.id;

    UPDATE public.subscriptions
    SET status = 'active',
        method = 'gym',
        start_date = v_now,
        end_date = v_now + make_interval(days => v_plan.days)
    WHERE id = v_sub.id;

    RETURN jsonb_build_object(
        'result', 'approved',
        'payment_id', v_payment.id,
        'subscription_id', v_sub.id
    );
END;

$function$;

REVOKE ALL ON FUNCTION public.approve_cash_payment(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_cash_payment(uuid)
TO authenticated;


-- =========================================================
-- 11. STAFF REJECTS CASH PAYMENT
-- =========================================================

CREATE OR REPLACE FUNCTION public.reject_cash_payment(
    p_payment_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_uid uuid := auth.uid();
    v_now timestamptz := now();
    v_payment public.payments;
    v_sub public.subscriptions;

BEGIN
    IF v_uid IS NULL
       OR NOT public.is_staff_or_admin() THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    IF p_reason IS NULL
       OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'rejection_reason_required';
    END IF;

    IF length(trim(p_reason)) > 500 THEN
        RAISE EXCEPTION 'rejection_reason_too_long';
    END IF;

    SELECT *
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'payment_not_found';
    END IF;

    IF v_payment.method IS DISTINCT FROM 'gym' THEN
        RAISE EXCEPTION 'not_a_cash_payment';
    END IF;

    IF v_payment.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'payment_not_pending';
    END IF;

    IF v_payment.subscription_id IS NULL THEN
        RAISE EXCEPTION 'subscription_not_found';
    END IF;

    SELECT *
    INTO v_sub
    FROM public.subscriptions
    WHERE id = v_payment.subscription_id
      AND user_id = v_payment.user_id
    FOR UPDATE;

    IF NOT FOUND OR v_sub.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'membership_not_pending';
    END IF;

    UPDATE public.payments
    SET status = 'cancelled',
        reviewed_by = v_uid,
        reviewed_at = v_now,
        rejection_reason = trim(p_reason)
    WHERE id = v_payment.id;

    UPDATE public.subscriptions
    SET status = 'cancelled',
        cancelled_at = v_now
    WHERE id = v_sub.id;

    RETURN jsonb_build_object(
        'result', 'rejected',
        'payment_id', v_payment.id,
        'subscription_id', v_sub.id
    );
END;

$function$;

REVOKE ALL ON FUNCTION public.reject_cash_payment(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reject_cash_payment(uuid, text)
TO authenticated;


-- =========================================================
-- END OF PHASE 3 DATABASE MIGRATION
-- =========================================================
