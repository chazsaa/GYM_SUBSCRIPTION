-- =====================================================================
-- GymFit PHASE 3: payment management
-- Run AFTER phase2.sql. Paste into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- IMPORTANT: this removes the functions that let a member mark their own
-- payment as paid. Copy the Phase 3 app files right after running it.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. SETTINGS and ADMIN
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
-- 'simulated' = test mode (no real money). 'gateway' = only the real payment gateway (or the admin, for cash) can mark paid.
insert into public.app_settings (key, value) values ('payments_mode', 'simulated')
  on conflict (key) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "settings readable" on public.app_settings;
create policy "settings readable" on public.app_settings for select to authenticated using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;

-- The people who can manage payments. There are only two kinds of user: members and admins.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.admins from anon, authenticated;

-- If an earlier draft of this phase (with a "staff" role) was run, carry those people over as admins.
do $$
begin
  if to_regclass('public.staff_members') is not null then
    insert into public.admins (user_id) select user_id from public.staff_members on conflict do nothing;
    drop table public.staff_members;
  end if;
end $$;
drop function if exists public.is_staff();
drop function if exists public.staff_pending_payments();
drop function if exists public.staff_review_payment(uuid, boolean, text);
drop function if exists public.staff_recent_payments(int);

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.payments_mode()
returns text
language sql stable
security definer set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = 'payments_mode'), 'simulated');
$$;

-- ---------------------------------------------------------------------
-- 2. PAYMENTS: reference codes, receipts, review details, gateway fields
-- ---------------------------------------------------------------------
-- paid_at is now only filled in when the payment is actually paid.
alter table public.payments alter column paid_at drop not null;
alter table public.payments alter column paid_at drop default;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'payments' and column_name = 'created_at') then
    alter table public.payments add column created_at timestamptz not null default now();
    update public.payments set created_at = paid_at;
    update public.payments set paid_at = null where status in ('pending', 'cancelled');
  end if;
end $$;

alter table public.payments
  add column if not exists reference text,
  add column if not exists receipt_number text,
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'paid', 'rejected', 'failed', 'cancelled'));

alter table public.subscriptions drop constraint if exists subscriptions_ended_reason_check;
alter table public.subscriptions
  add constraint subscriptions_ended_reason_check
  check (ended_reason in ('user_cancelled', 'upgraded', 'expired', 'payment_rejected'));

create sequence if not exists public.receipt_seq;

-- A short code the member can show at the front desk, e.g. GF-7K3Q9X.
create or replace function public.gen_payment_reference()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ref text;
  i int;
begin
  loop
    ref := 'GF-';
    for i in 1..6 loop
      ref := ref || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.payments where reference = ref);
  end loop;
  return ref;
end;
$$;

-- Receipt numbers, e.g. RC-2026-000123.
create or replace function public.next_receipt_number(p_at timestamptz)
returns text
language sql
set search_path = ''
as $$
  select 'RC-' || to_char(p_at, 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
$$;

-- Give every existing payment a reference, and every paid one a receipt number.
update public.payments set reference = public.gen_payment_reference() where reference is null;
update public.payments p
   set receipt_number = public.next_receipt_number(p.paid_at)
  from (select id from public.payments
         where status = 'paid' and receipt_number is null
         order by paid_at, created_at) o
 where p.id = o.id;

-- Only one unfinished payment per member (older duplicates are cancelled first).
update public.payments p set status = 'cancelled'
 where p.status = 'pending'
   and exists (select 1 from public.payments q
                where q.user_id = p.user_id and q.status = 'pending' and q.created_at > p.created_at);

create unique index if not exists payments_reference_key on public.payments (reference);
create unique index if not exists payments_receipt_key on public.payments (receipt_number)
  where receipt_number is not null;
create unique index if not exists one_pending_payment_per_user on public.payments (user_id)
  where status = 'pending';
alter table public.payments alter column reference set not null;

-- Audit trail. Nobody can read or write it from the app.
create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments(id) on delete set null,
  event text not null,
  actor uuid,
  provider_event_id text unique,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

create or replace function public._log_payment_event(
  p_payment_id uuid, p_event text, p_actor uuid, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer set search_path = ''
as $$
  insert into public.payment_events (payment_id, event, actor, detail)
  values (p_payment_id, p_event, p_actor, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- 3. REMOVE the Phase 2 functions that let a member confirm their own payment
-- ---------------------------------------------------------------------
drop function if exists public.subscribe_to_plan(int, text);
drop function if exists public.complete_pending_payment(text);
drop function if exists public.renew_my_subscription(text);
drop function if exists public.change_my_plan(int, text);

-- ---------------------------------------------------------------------
-- 4. THE CORE: turn a pending payment into a paid one (and apply its effect)
--    Used by admin approval, the gateway webhook and test mode. Never by the app directly.
-- ---------------------------------------------------------------------
create or replace function public._fail_payment(p_payment_id uuid, p_reason text, p_actor uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.payments set status = 'failed', rejection_reason = p_reason
   where id = p_payment_id and status = 'pending';
  perform public._log_payment_event(p_payment_id, 'failed', p_actor, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('result', 'failed', 'reason', p_reason, 'payment_id', p_payment_id);
end;
$$;

create or replace function public._finalize_payment(
  p_payment_id uuid, p_provider_ref text default null, p_actor uuid default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.payments;
  v_plan public.plans;
  v_sub public.subscriptions;
  v_new public.subscriptions;
  v_now timestamptz := now();
  v_end timestamptz;
  v_sub_id uuid;
  v_receipt text;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if v_pay.status = 'paid' then
    return jsonb_build_object('result', 'already_paid', 'payment_id', v_pay.id,
                              'receipt_number', v_pay.receipt_number);
  end if;
  if v_pay.status <> 'pending' then raise exception 'payment_not_pending'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_pay.user_id::text, 0));
  update public.subscriptions set status = 'expired', ended_reason = 'expired'
   where user_id = v_pay.user_id and status = 'active' and end_date <= v_now;
  select * into v_plan from public.plans where id = v_pay.plan_id;

  if v_pay.kind = 'new' then
    select * into v_sub from public.subscriptions
     where id = v_pay.subscription_id and status = 'pending' for update;
    if not found then return public._fail_payment(v_pay.id, 'membership_no_longer_available', p_actor); end if;
    v_end := v_now + make_interval(days => v_plan.days);
    update public.subscriptions
       set status = 'active', method = v_pay.method, start_date = v_now, end_date = v_end
     where id = v_sub.id;
    v_sub_id := v_sub.id;

  elsif v_pay.kind = 'renewal' then
    select * into v_sub from public.subscriptions
     where user_id = v_pay.user_id order by created_at desc limit 1 for update;
    if not found or v_sub.status in ('cancelled', 'pending') then
      return public._fail_payment(v_pay.id, 'nothing_to_renew', p_actor);
    end if;
    if v_sub.status = 'active' then
      v_end := v_sub.end_date + make_interval(days => v_plan.days);
      update public.subscriptions
         set plan_id = v_plan.id, next_plan_id = null, method = v_pay.method, end_date = v_end
       where id = v_sub.id;
      v_sub_id := v_sub.id;
    else
      v_end := v_now + make_interval(days => v_plan.days);
      insert into public.subscriptions (user_id, plan_id, status, method, start_date, end_date)
      values (v_pay.user_id, v_plan.id, 'active', v_pay.method, v_now, v_end)
      returning * into v_new;
      v_sub_id := v_new.id;
    end if;

  elsif v_pay.kind = 'upgrade' then
    select * into v_sub from public.subscriptions
     where user_id = v_pay.user_id and status = 'active' and end_date > v_now for update;
    if not found then return public._fail_payment(v_pay.id, 'no_active_membership', p_actor); end if;
    update public.subscriptions
       set status = 'cancelled', cancelled_at = v_now, ended_reason = 'upgraded',
           next_plan_id = null, end_date = v_now
     where id = v_sub.id;
    v_end := v_now + make_interval(days => v_plan.days);
    insert into public.subscriptions (user_id, plan_id, status, method, start_date, end_date)
    values (v_pay.user_id, v_plan.id, 'active', v_pay.method, v_now, v_end)
    returning * into v_new;
    v_sub_id := v_new.id;
  end if;

  v_receipt := public.next_receipt_number(v_now);
  update public.payments
     set status = 'paid', paid_at = v_now, receipt_number = v_receipt,
         subscription_id = v_sub_id,
         provider_payment_id = coalesce(p_provider_ref, provider_payment_id)
   where id = v_pay.id;
  perform public._log_payment_event(v_pay.id, 'paid', p_actor,
            jsonb_build_object('receipt_number', v_receipt, 'provider_ref', p_provider_ref));
  return jsonb_build_object('result', 'paid', 'payment_id', v_pay.id, 'kind', v_pay.kind,
                            'receipt_number', v_receipt, 'ends', v_end, 'subscription_id', v_sub_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. MEMBER FUNCTIONS
-- ---------------------------------------------------------------------

-- PAY AT THE GYM: reserves the membership and records a pending cash payment.
-- Only the admin can mark it paid.
create or replace function public.reserve_membership(p_plan_id int)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_plan public.plans;
  v_sub public.subscriptions;
  v_pay public.payments;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public.expire_my_memberships();

  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then raise exception 'plan_not_available'; end if;
  if exists (select 1 from public.subscriptions
              where user_id = v_uid and status in ('pending', 'active')) then
    raise exception 'already_has_membership';
  end if;

  insert into public.subscriptions (user_id, plan_id, status, method)
  values (v_uid, v_plan.id, 'pending', 'gym')
  returning * into v_sub;
  insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, reference, created_at)
  values (v_uid, v_sub.id, v_plan.id, v_plan.amount, 'gym', 'new', 'pending',
          public.gen_payment_reference(), v_now)
  returning * into v_pay;
  perform public._log_payment_event(v_pay.id, 'created', v_uid, jsonb_build_object('method', 'gym'));
  return jsonb_build_object('payment_id', v_pay.id, 'reference', v_pay.reference,
                            'amount', v_pay.amount, 'status', 'pending');
end;
$$;

-- ONLINE PAYMENT: records a pending payment. The membership changes only when it is paid.
--   p_kind 'new'     -> a new membership (or paying a reservation online)
--   p_kind 'renewal' -> renew (uses a scheduled downgrade plan if there is one)
--   p_kind 'upgrade' -> switch to a more expensive plan (credit for unused days)
create or replace function public.start_payment(p_kind text, p_plan_id int, p_method text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_plan public.plans;
  v_sub public.subscriptions;
  v_pay public.payments;
  v_quote jsonb;
  v_amount int;
  v_sub_id uuid;
  v_done jsonb;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if p_kind is null or p_kind not in ('new', 'renewal', 'upgrade') then
    raise exception 'invalid_kind';
  end if;
  if p_method is null or p_method not in ('gcash', 'maya', 'card') then
    raise exception 'online_payment_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public.expire_my_memberships();

  -- An unfinished online attempt is replaced by this one. Cash reservations stay.
  update public.payments set status = 'cancelled'
   where user_id = v_uid and status = 'pending' and method <> 'gym';

  if p_kind = 'new' then
    select * into v_plan from public.plans where id = p_plan_id and is_active;
    if not found then raise exception 'plan_not_available'; end if;
    select * into v_sub from public.subscriptions
     where user_id = v_uid and status = 'pending' for update;
    if found then
      if v_sub.plan_id <> v_plan.id then raise exception 'already_has_membership'; end if;
      v_sub_id := v_sub.id;
      -- A cash reservation for this plan: pay it online instead.
      select * into v_pay from public.payments
       where user_id = v_uid and status = 'pending' and subscription_id = v_sub.id;
      if found then
        update public.payments set method = p_method where id = v_pay.id returning * into v_pay;
        update public.subscriptions set method = p_method where id = v_sub.id;
        perform public._log_payment_event(v_pay.id, 'switched_to_online', v_uid,
                  jsonb_build_object('method', p_method));
        return jsonb_build_object('payment_id', v_pay.id, 'reference', v_pay.reference,
                                  'amount', v_pay.amount, 'status', 'pending',
                                  'mode', public.payments_mode());
      end if;
    elsif exists (select 1 from public.subscriptions
                   where user_id = v_uid and status in ('pending', 'active')) then
      raise exception 'already_has_membership';
    else
      insert into public.subscriptions (user_id, plan_id, status, method)
      values (v_uid, v_plan.id, 'pending', p_method)
      returning id into v_sub_id;
    end if;
    v_amount := v_plan.amount;

  elsif p_kind = 'renewal' then
    select * into v_sub from public.subscriptions
     where user_id = v_uid order by created_at desc limit 1 for update;
    if not found or v_sub.status = 'cancelled' then raise exception 'nothing_to_renew'; end if;
    if v_sub.status = 'pending' then raise exception 'payment_pending'; end if;
    select * into v_plan from public.plans
     where id = coalesce(v_sub.next_plan_id, v_sub.plan_id) and is_active;
    if not found then raise exception 'plan_not_available'; end if;
    v_sub_id := v_sub.id;
    v_amount := v_plan.amount;

  else
    v_quote := public.quote_plan_change(p_plan_id);
    if v_quote->>'kind' <> 'upgrade' then raise exception 'not_an_upgrade'; end if;
    select * into v_plan from public.plans where id = p_plan_id;
    select id into v_sub_id from public.subscriptions
     where user_id = v_uid and status = 'active' and end_date > v_now;
    v_amount := (v_quote->>'charge')::int;
  end if;

  insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, reference, created_at)
  values (v_uid, v_sub_id, v_plan.id, v_amount, p_method, p_kind, 'pending',
          public.gen_payment_reference(), v_now)
  returning * into v_pay;
  perform public._log_payment_event(v_pay.id, 'created', v_uid,
            jsonb_build_object('method', p_method, 'kind', p_kind));

  -- Nothing to pay (the credit covers the whole upgrade): finish it right away.
  if v_amount = 0 then
    v_done := public._finalize_payment(v_pay.id, 'no_charge', null);
    return v_done || jsonb_build_object('reference', v_pay.reference, 'amount', 0,
                                        'status', 'paid', 'mode', public.payments_mode());
  end if;

  return jsonb_build_object('payment_id', v_pay.id, 'reference', v_pay.reference,
                            'amount', v_pay.amount, 'status', 'pending',
                            'mode', public.payments_mode());
end;
$$;

-- TEST MODE ONLY: lets the app pretend an online payment succeeded.
-- Stops working the moment payments_mode is set to 'live'.
create or replace function public.confirm_simulated_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pay public.payments;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if public.payments_mode() <> 'simulated' then raise exception 'simulation_disabled'; end if;
  select * into v_pay from public.payments where id = p_payment_id and user_id = v_uid;
  if not found then raise exception 'payment_not_found'; end if;
  if v_pay.method = 'gym' then raise exception 'admin_confirmation_required'; end if;
  return public._finalize_payment(v_pay.id, 'simulated', null);
end;
$$;

-- DOWNGRADE (or undo a scheduled one): no payment involved.
create or replace function public.schedule_plan_change(p_plan_id int)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  v_quote := public.quote_plan_change(p_plan_id);
  select * into v_sub from public.subscriptions where user_id = v_uid and status = 'active' for update;

  if v_quote->>'kind' = 'clear' then
    update public.subscriptions set next_plan_id = null where id = v_sub.id;
  elsif v_quote->>'kind' = 'downgrade' then
    update public.subscriptions set next_plan_id = p_plan_id where id = v_sub.id;
  else
    raise exception 'upgrade_requires_payment';
  end if;
  return v_quote;
end;
$$;

-- CANCEL: a reservation is released, an active membership ends now (no refund).
-- Any unfinished payment is cancelled with it.
create or replace function public.cancel_my_subscription()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public.expire_my_memberships();

  select * into v_sub from public.subscriptions
   where user_id = v_uid and status in ('pending', 'active') for update;
  if not found then raise exception 'no_membership_to_cancel'; end if;

  update public.subscriptions
     set status = 'cancelled', cancelled_at = v_now, ended_reason = 'user_cancelled',
         next_plan_id = null,
         end_date = case when v_sub.status = 'active' then v_now else v_sub.end_date end
   where id = v_sub.id;
  update public.payments set status = 'cancelled' where user_id = v_uid and status = 'pending';
  return jsonb_build_object('result', 'cancelled', 'was', v_sub.status);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. ADMIN FUNCTIONS (verify cash payments, see transactions)
-- ---------------------------------------------------------------------
create or replace function public.admin_pending_payments()
returns table (payment_id uuid, reference text, member_name text, member_email text,
               plan_name text, amount int, kind text, created_at timestamptz)
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select p.id, p.reference, coalesce(pr.full_name, ''), coalesce(pr.email, ''),
           pl.name, p.amount, p.kind, p.created_at
      from public.payments p
      join public.plans pl on pl.id = p.plan_id
      left join public.profiles pr on pr.id = p.user_id
     where p.status = 'pending' and p.method = 'gym'
     order by p.created_at;
end;
$$;

create or replace function public.admin_review_payment(
  p_payment_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_now timestamptz := now();
  v_pay public.payments;
  v_result jsonb;
  v_reason text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if v_pay.status <> 'pending' then raise exception 'payment_not_pending'; end if;
  if v_pay.method <> 'gym' then raise exception 'not_cash_payment'; end if;
  if v_pay.user_id = v_admin then raise exception 'cannot_review_own_payment'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_pay.user_id::text, 0));

  if p_approve then
    v_result := public._finalize_payment(v_pay.id, null, v_admin);
    update public.payments set reviewed_by = v_admin, reviewed_at = v_now where id = v_pay.id;
    return v_result;
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'Rejected by admin');
  update public.payments
     set status = 'rejected', rejection_reason = v_reason, reviewed_by = v_admin, reviewed_at = v_now
   where id = v_pay.id;
  update public.subscriptions
     set status = 'cancelled', cancelled_at = v_now, ended_reason = 'payment_rejected'
   where id = v_pay.subscription_id and status = 'pending';
  perform public._log_payment_event(v_pay.id, 'rejected', v_admin, jsonb_build_object('reason', v_reason));
  return jsonb_build_object('result', 'rejected', 'payment_id', v_pay.id, 'reason', v_reason);
end;
$$;

create or replace function public.admin_recent_payments(p_limit int default 30)
returns table (payment_id uuid, reference text, receipt_number text, member_name text,
               member_email text, plan_name text, amount int, kind text, method text,
               status text, created_at timestamptz, paid_at timestamptz,
               reviewed_at timestamptz, rejection_reason text)
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select p.id, p.reference, p.receipt_number, coalesce(pr.full_name, ''), coalesce(pr.email, ''),
           pl.name, p.amount, p.kind, p.method, p.status, p.created_at, p.paid_at,
           p.reviewed_at, p.rejection_reason
      from public.payments p
      join public.plans pl on pl.id = p.plan_id
      left join public.profiles pr on pr.id = p.user_id
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

-- ---------------------------------------------------------------------
-- 7. GATEWAY HOOKS (only the server-side "service role" may call these;
--    the Edge Functions in supabase/functions use them)
-- ---------------------------------------------------------------------
create or replace function public.gateway_attach_checkout(
  p_payment_id uuid, p_provider text, p_checkout_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.payments set provider = p_provider, provider_payment_id = p_checkout_id
   where id = p_payment_id and status = 'pending';
  perform public._log_payment_event(p_payment_id, 'checkout_created', null,
            jsonb_build_object('provider', p_provider, 'checkout_id', p_checkout_id));
end;
$$;

-- Each provider event is processed once, even if the provider sends it again.
create or replace function public.gateway_finalize_payment(
  p_payment_id uuid, p_provider_event_id text, p_provider_ref text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rows int;
begin
  insert into public.payment_events (payment_id, event, provider_event_id, detail)
  values (p_payment_id, 'gateway_paid', p_provider_event_id,
          jsonb_build_object('provider_ref', p_provider_ref))
  on conflict (provider_event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('result', 'duplicate_event'); end if;
  return public._finalize_payment(p_payment_id, p_provider_ref, null);
end;
$$;

create or replace function public.gateway_fail_payment(
  p_payment_id uuid, p_provider_event_id text, p_reason text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rows int;
begin
  insert into public.payment_events (payment_id, event, provider_event_id, detail)
  values (p_payment_id, 'gateway_failed', p_provider_event_id, jsonb_build_object('reason', p_reason))
  on conflict (provider_event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('result', 'duplicate_event'); end if;
  return public._fail_payment(p_payment_id, coalesce(p_reason, 'gateway_failed'), null);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. WHO MAY CALL WHAT
-- ---------------------------------------------------------------------
revoke all on function public._log_payment_event(uuid, text, uuid, jsonb)   from public, anon, authenticated;
revoke all on function public._fail_payment(uuid, text, uuid)               from public, anon, authenticated;
revoke all on function public._finalize_payment(uuid, text, uuid)           from public, anon, authenticated;
revoke all on function public.gen_payment_reference()                       from public, anon, authenticated;
revoke all on function public.next_receipt_number(timestamptz)              from public, anon, authenticated;
revoke all on function public.gateway_attach_checkout(uuid, text, text)     from public, anon, authenticated;
revoke all on function public.gateway_finalize_payment(uuid, text, text)    from public, anon, authenticated;
revoke all on function public.gateway_fail_payment(uuid, text, text)        from public, anon, authenticated;

revoke all on function public.is_admin()                                    from public, anon;
revoke all on function public.payments_mode()                               from public, anon;
revoke all on function public.reserve_membership(int)                       from public, anon;
revoke all on function public.start_payment(text, int, text)                from public, anon;
revoke all on function public.confirm_simulated_payment(uuid)               from public, anon;
revoke all on function public.schedule_plan_change(int)                     from public, anon;
revoke all on function public.cancel_my_subscription()                      from public, anon;
revoke all on function public.admin_pending_payments()                      from public, anon;
revoke all on function public.admin_review_payment(uuid, boolean, text)     from public, anon;
revoke all on function public.admin_recent_payments(int)                    from public, anon;

grant execute on function public.is_admin()                                 to authenticated;
grant execute on function public.payments_mode()                            to authenticated;
grant execute on function public.reserve_membership(int)                    to authenticated;
grant execute on function public.start_payment(text, int, text)             to authenticated;
grant execute on function public.confirm_simulated_payment(uuid)            to authenticated;
grant execute on function public.schedule_plan_change(int)                  to authenticated;
grant execute on function public.cancel_my_subscription()                   to authenticated;
grant execute on function public.admin_pending_payments()                   to authenticated;
grant execute on function public.admin_review_payment(uuid, boolean, text)  to authenticated;
grant execute on function public.admin_recent_payments(int)                 to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.gateway_attach_checkout(uuid, text, text)  to service_role;
    grant execute on function public.gateway_finalize_payment(uuid, text, text) to service_role;
    grant execute on function public.gateway_fail_payment(uuid, text, text)     to service_role;
  end if;
end $$;

commit;

-- Make sure the app sees the new functions right away.
notify pgrst, 'reload schema';
