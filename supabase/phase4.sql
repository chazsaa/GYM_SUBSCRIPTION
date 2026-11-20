-- =====================================================================
-- GymFit PHASE 4: the Admin Dashboard
-- Run AFTER phase3.sql. Paste into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run more than once. Nothing from Phase 2 or 3 is changed or removed.
--
-- Why this file exists: the database only lets each person read their OWN rows.
-- So the admin screens cannot read "all members" or "all payments" directly.
-- Instead, each admin screen calls one function below. Every function starts by
-- checking that the caller is in the admins table, so a member who calls one
-- (even with a modified app) gets "not_admin" and nothing else.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. SMALL HELPERS
-- ---------------------------------------------------------------------
-- The gym's local time zone. "Today" and "this month" in the reports use it.
-- Change it here if the gym is not in the Philippines.
create or replace function public.gym_tz()
returns text
language sql immutable
set search_path = ''
as $$ select 'Asia/Manila'::text $$;

-- ---------------------------------------------------------------------
-- 2. GYM INFORMATION (Gym Management screen)
-- ---------------------------------------------------------------------
create table if not exists public.gym_info (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.gym_info enable row level security;
drop policy if exists "gym info readable" on public.gym_info;
create policy "gym info readable" on public.gym_info for select to authenticated using (true);
revoke insert, update, delete on public.gym_info from anon, authenticated;

insert into public.gym_info (key, value) values
  ('gym_name', 'GymFit'),
  ('address', ''),
  ('phone', ''),
  ('email', ''),
  ('hours_weekdays', ''),
  ('hours_weekends', ''),
  ('capacity', ''),
  ('announcement', '')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3. AUDIT LOG: who did what. Nobody can read or write it from the app.
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public._log_admin_action(
  p_action text, p_target_type text, p_target_id text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer set search_path = ''
as $$
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- 4. ADMINS ARE NOT MEMBERS
--    An admin account cannot hold a membership or make a payment.
--    (This is enforced here, in the database, so a modified app cannot get around it.)
-- ---------------------------------------------------------------------
-- A membership an admin ended on purpose.
alter table public.subscriptions drop constraint if exists subscriptions_ended_reason_check;
alter table public.subscriptions
  add constraint subscriptions_ended_reason_check
  check (ended_reason in ('user_cancelled', 'upgraded', 'expired', 'payment_rejected', 'admin_cancelled'));

create or replace function public._block_admin_membership()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.admins where user_id = new.user_id) then
    raise exception 'admin_cannot_subscribe';
  end if;
  return new;
end;
$$;

drop trigger if exists block_admin_subscriptions on public.subscriptions;
create trigger block_admin_subscriptions
  before insert on public.subscriptions
  for each row execute function public._block_admin_membership();

drop trigger if exists block_admin_payments on public.payments;
create trigger block_admin_payments
  before insert on public.payments
  for each row execute function public._block_admin_membership();

-- ---------------------------------------------------------------------
-- 5. DASHBOARD OVERVIEW
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_tz text := public.gym_tz();
  v_today date := (now() at time zone public.gym_tz())::date;
  v_day_start timestamptz := (date_trunc('day', now() at time zone public.gym_tz())) at time zone public.gym_tz();
  v_month_start timestamptz := (date_trunc('month', now() at time zone public.gym_tz())) at time zone public.gym_tz();
  v_total int;
  v_new30 int;
  v_active int;
  v_expiring int;
  v_expired int;
  v_no_membership int;
  v_pending int;
  v_pending_amount bigint;
  v_rev_today bigint;
  v_rev_month bigint;
  v_rev_total bigint;
  v_daily jsonb;
  v_expiring_list jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  select count(*) into v_total from public.profiles p
   where not exists (select 1 from public.admins a where a.user_id = p.id);
  select count(*) into v_new30 from public.profiles p
   where p.created_at >= v_now - interval '30 days'
     and not exists (select 1 from public.admins a where a.user_id = p.id);

  -- Each member's newest membership decides their status (same rule as the member app).
  with latest as (
    select distinct on (s.user_id) s.user_id, s.status, s.end_date
      from public.subscriptions s
     where not exists (select 1 from public.admins a where a.user_id = s.user_id)
     order by s.user_id, s.created_at desc
  ), members as (
    select p.id as user_id, l.status, l.end_date
      from public.profiles p left join latest l on l.user_id = p.id
     where not exists (select 1 from public.admins a where a.user_id = p.id)
  )
  select
    count(*) filter (where m.status = 'active' and m.end_date > v_now),
    count(*) filter (where m.status = 'active' and m.end_date > v_now and m.end_date <= v_now + interval '7 days'),
    count(*) filter (where (m.status = 'active' and m.end_date <= v_now) or m.status = 'expired'),
    count(*) filter (where m.status is null or m.status = 'cancelled')
    into v_active, v_expiring, v_expired, v_no_membership
    from members m;

  select count(*), coalesce(sum(p.amount), 0) into v_pending, v_pending_amount
    from public.payments p where p.status = 'pending' and p.method = 'gym';

  select coalesce(sum(p.amount) filter (where p.paid_at >= v_day_start), 0),
         coalesce(sum(p.amount) filter (where p.paid_at >= v_month_start), 0),
         coalesce(sum(p.amount), 0)
    into v_rev_today, v_rev_month, v_rev_total
    from public.payments p where p.status = 'paid';

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day::text, 'amount', coalesce(r.amount, 0))
                            order by d.day), '[]'::jsonb)
    into v_daily
    from (select (v_today - g) as day from generate_series(0, 6) g) d
    left join (
      select (p.paid_at at time zone v_tz)::date as day, sum(p.amount) as amount
        from public.payments p
       where p.status = 'paid' and p.paid_at >= v_now - interval '9 days'
       group by 1
    ) r on r.day = d.day;

  select coalesce(jsonb_agg(x order by x.end_date), '[]'::jsonb) into v_expiring_list
    from (
      with latest as (
        select distinct on (s.user_id) s.* from public.subscriptions s
         where not exists (select 1 from public.admins a where a.user_id = s.user_id)
         order by s.user_id, s.created_at desc
      )
      select s.user_id, coalesce(pr.full_name, '') as member_name, coalesce(pr.email, '') as member_email,
             pl.name as plan_name, s.end_date,
             greatest(0, ceil(extract(epoch from (s.end_date - v_now)) / 86400))::int as days_left
        from latest s join public.plans pl on pl.id = s.plan_id
        left join public.profiles pr on pr.id = s.user_id
       where s.status = 'active' and s.end_date > v_now and s.end_date <= v_now + interval '7 days'
       order by s.end_date limit 6
    ) x;

  return jsonb_build_object(
    'total_members', v_total,
    'new_members_30d', v_new30,
    'active_members', v_active,
    'expiring_soon', v_expiring,
    'expired_members', v_expired,
    'no_membership', v_no_membership,
    'pending_cash_count', v_pending,
    'pending_cash_amount', v_pending_amount,
    'revenue_today', v_rev_today,
    'revenue_month', v_rev_month,
    'revenue_total', v_rev_total,
    'daily_revenue', v_daily,
    'expiring_list', v_expiring_list
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. MEMBER MANAGEMENT
-- ---------------------------------------------------------------------
-- p_status: all | active | expiring | pending | expired | none
create or replace function public.admin_members(
  p_search text default null, p_status text default 'all',
  p_limit int default 50, p_offset int default 0)
returns table (user_id uuid, full_name text, email text, joined_at timestamptz,
               status text, plan_name text, start_date timestamptz, end_date timestamptz,
               total_paid bigint, total_count bigint)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    with latest as (
      select distinct on (s.user_id) s.user_id, s.plan_id, s.status as sub_status, s.start_date, s.end_date
        from public.subscriptions s
       order by s.user_id, s.created_at desc
    ), base as (
      select pr.id as uid, coalesce(pr.full_name, '') as fname, coalesce(pr.email, '') as femail,
             pr.created_at as joined,
             case
               when l.user_id is null or l.sub_status = 'cancelled' then 'none'
               when l.sub_status = 'active' and l.end_date <= v_now then 'expired'
               else l.sub_status
             end as eff,
             l.plan_id, l.start_date as sdate, l.end_date as edate
        from public.profiles pr
        left join latest l on l.user_id = pr.id
       where not exists (select 1 from public.admins a where a.user_id = pr.id)
         and (v_q is null or pr.full_name ilike v_q or pr.email ilike v_q)
    )
    select b.uid, b.fname, b.femail, b.joined, b.eff,
           coalesce(pl.name, ''), b.sdate, b.edate,
           coalesce((select sum(p.amount) from public.payments p
                      where p.user_id = b.uid and p.status = 'paid'), 0)::bigint,
           count(*) over ()
      from base b
      left join public.plans pl on pl.id = b.plan_id and b.eff <> 'none'
     where case coalesce(p_status, 'all')
             when 'all' then true
             when 'expiring' then b.eff = 'active' and b.edate <= v_now + interval '7 days'
             else b.eff = p_status
           end
     order by b.joined desc
     limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_member_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_profile public.profiles;
  v_latest public.subscriptions;
  v_status text;
  v_subs jsonb;
  v_pays jsonb;
  v_paid bigint;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_profile from public.profiles where id = p_user_id
     and not exists (select 1 from public.admins a where a.user_id = p_user_id);
  if not found then raise exception 'member_not_found'; end if;

  select * into v_latest from public.subscriptions
   where user_id = p_user_id order by created_at desc limit 1;
  v_status := case
    when not found or v_latest.status = 'cancelled' then 'none'
    when v_latest.status = 'active' and v_latest.end_date <= v_now then 'expired'
    else v_latest.status
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'subscription_id', s.id, 'plan_name', pl.name,
           'status', case when s.status = 'active' and s.end_date <= v_now then 'expired' else s.status end,
           'method', s.method, 'start_date', s.start_date, 'end_date', s.end_date,
           'ended_reason', s.ended_reason, 'created_at', s.created_at)
           order by s.created_at desc), '[]'::jsonb)
    into v_subs
    from (select * from public.subscriptions where user_id = p_user_id
           and coalesce(ended_reason, '') <> 'upgraded'
           order by created_at desc limit 20) s
    join public.plans pl on pl.id = s.plan_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'payment_id', p.id, 'reference', p.reference, 'receipt_number', p.receipt_number,
           'plan_name', pl.name, 'amount', p.amount, 'kind', p.kind, 'method', p.method,
           'status', p.status, 'created_at', p.created_at, 'paid_at', p.paid_at,
           'rejection_reason', p.rejection_reason)
           order by p.created_at desc), '[]'::jsonb)
    into v_pays
    from (select * from public.payments where user_id = p_user_id
           order by created_at desc limit 30) p
    join public.plans pl on pl.id = p.plan_id;

  select coalesce(sum(amount), 0) into v_paid
    from public.payments where user_id = p_user_id and status = 'paid';

  return jsonb_build_object(
    'user_id', v_profile.id,
    'full_name', coalesce(v_profile.full_name, ''),
    'email', coalesce(v_profile.email, ''),
    'joined_at', v_profile.created_at,
    'status', v_status,
    'current_subscription_id', case when v_status in ('active', 'pending', 'expired') then v_latest.id end,
    'current_plan_id', case when v_status <> 'none' then v_latest.plan_id end,
    'current_start', case when v_status <> 'none' then v_latest.start_date end,
    'current_end', case when v_status <> 'none' then v_latest.end_date end,
    'total_paid', v_paid,
    'subscriptions', v_subs,
    'payments', v_pays
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. SUBSCRIPTION MANAGEMENT
-- ---------------------------------------------------------------------
-- p_status: all | active | expiring | pending | expired | cancelled
-- (A membership replaced by an upgrade is hidden: the new one shows instead.)
create or replace function public.admin_subscriptions(
  p_status text default 'active', p_search text default null,
  p_limit int default 50, p_offset int default 0)
returns table (subscription_id uuid, user_id uuid, member_name text, member_email text,
               plan_id int, plan_name text, status text, method text,
               start_date timestamptz, end_date timestamptz, days_left int,
               next_plan_name text, created_at timestamptz, ended_reason text,
               total_count bigint)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    with base as (
      select s.id as sid, s.user_id as uid, s.plan_id as pid, s.method as smethod,
             s.start_date as sdate, s.end_date as edate, s.next_plan_id as nid,
             s.created_at as screated, s.ended_reason as sreason,
             case when s.status = 'active' and s.end_date <= v_now then 'expired' else s.status end as eff
        from public.subscriptions s
       where coalesce(s.ended_reason, '') <> 'upgraded'
         and not exists (select 1 from public.admins a where a.user_id = s.user_id)
    )
    select b.sid, b.uid, coalesce(pr.full_name, ''), coalesce(pr.email, ''),
           b.pid, pl.name, b.eff, b.smethod, b.sdate, b.edate,
           case when b.eff = 'active'
                then greatest(0, ceil(extract(epoch from (b.edate - v_now)) / 86400))::int end,
           np.name, b.screated, b.sreason,
           count(*) over ()
      from base b
      join public.plans pl on pl.id = b.pid
      left join public.plans np on np.id = b.nid
      left join public.profiles pr on pr.id = b.uid
     where (v_q is null or pr.full_name ilike v_q or pr.email ilike v_q)
       and case coalesce(p_status, 'all')
             when 'all' then true
             when 'expiring' then b.eff = 'active' and b.edate <= v_now + interval '7 days'
             else b.eff = p_status
           end
     order by (case when p_status in ('active', 'expiring') then b.edate end) asc nulls last,
              b.screated desc
     limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Give a member extra days on a running membership (a goodwill gesture, a correction, ...).
create or replace function public.admin_extend_subscription(p_subscription_id uuid, p_days int)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_sub public.subscriptions;
  v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'invalid_days'; end if;

  select user_id into v_uid from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'subscription_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_sub from public.subscriptions
   where id = p_subscription_id and status = 'active' and end_date > now() for update;
  if not found then raise exception 'subscription_not_active'; end if;

  v_end := v_sub.end_date + make_interval(days => p_days);
  update public.subscriptions set end_date = v_end where id = v_sub.id;
  perform public._log_admin_action('extend_subscription', 'subscription', v_sub.id::text,
            jsonb_build_object('user_id', v_uid, 'days', p_days,
                               'old_end', v_sub.end_date, 'new_end', v_end));
  return jsonb_build_object('result', 'extended', 'ends', v_end);
end;
$$;

-- End a membership. A reservation is released; a running membership stops now (no refund).
create or replace function public.admin_cancel_subscription(p_subscription_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_now timestamptz := now();
  v_sub public.subscriptions;
  v_pid uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  select user_id into v_uid from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'subscription_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_sub from public.subscriptions
   where id = p_subscription_id
     and (status = 'pending' or (status = 'active' and end_date > v_now)) for update;
  if not found then raise exception 'subscription_not_active'; end if;

  update public.subscriptions
     set status = 'cancelled', cancelled_at = v_now, ended_reason = 'admin_cancelled',
         next_plan_id = null,
         end_date = case when v_sub.status = 'active' then v_now else v_sub.end_date end
   where id = v_sub.id;

  -- Any unfinished payment for this membership is cancelled with it.
  for v_pid in
    select id from public.payments where subscription_id = v_sub.id and status = 'pending'
  loop
    update public.payments set status = 'cancelled' where id = v_pid;
    perform public._log_payment_event(v_pid, 'cancelled_by_admin', auth.uid(), '{}'::jsonb);
  end loop;

  perform public._log_admin_action('cancel_subscription', 'subscription', v_sub.id::text,
            jsonb_build_object('user_id', v_uid, 'was', v_sub.status,
                               'reason', nullif(trim(coalesce(p_reason, '')), '')));
  return jsonb_build_object('result', 'cancelled', 'was', v_sub.status);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. PLANS (part of Subscription Management)
--    The length of a plan (days) is fixed on purpose: running memberships and
--    upgrade credits depend on it. A new price applies to future purchases only.
-- ---------------------------------------------------------------------
create or replace function public.admin_plans()
returns table (plan_id int, name text, days int, amount int, duration_label text,
               description text, best_for text, is_active boolean, sort_order int,
               active_members bigint, total_revenue bigint)
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select pl.id, pl.name, pl.days, pl.amount, coalesce(pl.duration_label, pl.days || ' days'),
           coalesce(pl.description, ''), coalesce(pl.best_for, ''), pl.is_active, pl.sort_order,
           (select count(*) from public.subscriptions s
             where s.plan_id = pl.id and s.status = 'active' and s.end_date > now()
               and not exists (select 1 from public.admins a where a.user_id = s.user_id)),
           coalesce((select sum(p.amount) from public.payments p
                      where p.plan_id = pl.id and p.status = 'paid'), 0)::bigint
      from public.plans pl
     order by pl.sort_order, pl.id;
end;
$$;

-- Only the fields you pass are changed (null = leave as is).
create or replace function public.admin_update_plan(
  p_plan_id int, p_name text default null, p_amount int default null,
  p_description text default null, p_is_active boolean default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_old public.plans;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_desc text := case when p_description is null then null else trim(p_description) end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_old from public.plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found'; end if;

  if p_name is not null and (v_name is null or char_length(v_name) < 2 or char_length(v_name) > 60) then
    raise exception 'invalid_plan_name';
  end if;
  if p_amount is not null and (p_amount < 1 or p_amount > 1000000) then
    raise exception 'invalid_amount';
  end if;
  if v_desc is not null and char_length(v_desc) > 500 then
    raise exception 'text_too_long';
  end if;
  if p_is_active is false and v_old.is_active
     and not exists (select 1 from public.plans where id <> p_plan_id and is_active) then
    raise exception 'last_active_plan';
  end if;

  update public.plans
     set name = coalesce(v_name, name),
         amount = coalesce(p_amount, amount),
         description = coalesce(v_desc, description),
         is_active = coalesce(p_is_active, is_active)
   where id = p_plan_id;

  perform public._log_admin_action('update_plan', 'plan', p_plan_id::text,
            jsonb_build_object('old_name', v_old.name, 'old_amount', v_old.amount, 'old_active', v_old.is_active,
                               'new_name', v_name, 'new_amount', p_amount, 'new_active', p_is_active));
  return jsonb_build_object('result', 'updated');
end;
$$;

-- ---------------------------------------------------------------------
-- 9. PAYMENT MANAGEMENT (the cash approve/reject functions from Phase 3 are reused)
-- ---------------------------------------------------------------------
-- p_status: all | paid | pending | unsuccessful (rejected, failed, cancelled)
-- p_method: all | gym | gcash | maya | card
create or replace function public.admin_payments(
  p_status text default 'all', p_method text default 'all', p_search text default null,
  p_limit int default 50, p_offset int default 0)
returns table (payment_id uuid, reference text, receipt_number text, member_id uuid,
               member_name text, member_email text, plan_name text, amount int, kind text,
               method text, status text, created_at timestamptz, paid_at timestamptz,
               reviewed_at timestamptz, reviewed_by_name text, rejection_reason text,
               total_count bigint)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    select p.id, p.reference, p.receipt_number, p.user_id,
           coalesce(pr.full_name, ''), coalesce(pr.email, ''), pl.name, p.amount, p.kind,
           p.method, p.status, p.created_at, p.paid_at, p.reviewed_at,
           coalesce(rv.full_name, rv.email, ''), p.rejection_reason,
           count(*) over ()
      from public.payments p
      join public.plans pl on pl.id = p.plan_id
      left join public.profiles pr on pr.id = p.user_id
      left join public.profiles rv on rv.id = p.reviewed_by
     where (coalesce(p_status, 'all') = 'all'
            or (p_status = 'unsuccessful' and p.status in ('rejected', 'failed', 'cancelled'))
            or p.status = p_status)
       and (coalesce(p_method, 'all') = 'all' or p.method = p_method)
       and (v_q is null or p.reference ilike v_q or p.receipt_number ilike v_q
            or pr.full_name ilike v_q or pr.email ilike v_q)
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. GYM MANAGEMENT
-- ---------------------------------------------------------------------
create or replace function public.admin_save_gym_info(p_values jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_key text;
  v_val text;
  v_max int;
  v_allowed constant text[] :=
    array['gym_name', 'address', 'phone', 'email', 'hours_weekdays', 'hours_weekends', 'capacity', 'announcement'];
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then raise exception 'invalid_setting'; end if;

  for v_key in select jsonb_object_keys(p_values) loop
    if not (v_key = any (v_allowed)) then raise exception 'invalid_setting'; end if;
    v_val := trim(coalesce(p_values ->> v_key, ''));
    v_max := case when v_key = 'announcement' then 500 else 200 end;
    if char_length(v_val) > v_max then raise exception 'text_too_long'; end if;
    if v_key = 'gym_name' and v_val = '' then raise exception 'gym_name_required'; end if;
    if v_key = 'capacity' and v_val <> '' and v_val !~ '^[0-9]{1,6}$' then raise exception 'invalid_capacity'; end if;

    insert into public.gym_info (key, value, updated_at, updated_by)
    values (v_key, v_val, now(), auth.uid())
    on conflict (key) do update
      set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end loop;

  perform public._log_admin_action('update_gym_info', 'gym_info', null,
            jsonb_build_object('keys', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p_values) k)));
  return jsonb_build_object('result', 'saved');
end;
$$;

-- ---------------------------------------------------------------------
-- 11. REPORTS AND ANALYTICS
--     p_from / p_to are dates in the gym's time zone, both included (at most 366 days).
-- ---------------------------------------------------------------------
create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_tz text := public.gym_tz();
  v_now timestamptz := now();
  v_span int;
  v_unit text;
  v_total bigint;
  v_count int;
  v_series jsonb;
  v_method jsonb;
  v_plan jsonb;
  v_kind jsonb;
  v_outcomes jsonb;
  v_new_members int;
  v_cancelled int;
  v_active int;
  v_expiring int;
  v_expired int;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 365 then
    raise exception 'invalid_range';
  end if;
  v_span := (p_to - p_from) + 1;
  v_unit := case when v_span <= 31 then 'day' when v_span <= 120 then 'week' else 'month' end;

  select coalesce(sum(p.amount), 0), count(*) into v_total, v_count
    from public.payments p
   where p.status = 'paid' and (p.paid_at at time zone v_tz)::date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object('label', b.bucket::text, 'amount', coalesce(r.amount, 0),
                                               'count', coalesce(r.cnt, 0)) order by b.bucket), '[]'::jsonb)
    into v_series
    from (select g::date as bucket
            from generate_series(date_trunc(v_unit, p_from::timestamp),
                                 date_trunc(v_unit, p_to::timestamp),
                                 ('1 ' || v_unit)::interval) g) b
    left join (
      select date_trunc(v_unit, (p.paid_at at time zone v_tz))::date as bucket,
             sum(p.amount) as amount, count(*) as cnt
        from public.payments p
       where p.status = 'paid' and (p.paid_at at time zone v_tz)::date between p_from and p_to
       group by 1
    ) r on r.bucket = b.bucket;

  select coalesce(jsonb_agg(jsonb_build_object('key', x.method, 'amount', x.amount, 'count', x.cnt)
                            order by x.amount desc), '[]'::jsonb) into v_method
    from (select p.method, sum(p.amount) as amount, count(*) as cnt from public.payments p
           where p.status = 'paid' and (p.paid_at at time zone v_tz)::date between p_from and p_to
           group by p.method) x;

  select coalesce(jsonb_agg(jsonb_build_object('key', x.name, 'amount', x.amount, 'count', x.cnt)
                            order by x.amount desc), '[]'::jsonb) into v_plan
    from (select pl.name, sum(p.amount) as amount, count(*) as cnt
            from public.payments p join public.plans pl on pl.id = p.plan_id
           where p.status = 'paid' and (p.paid_at at time zone v_tz)::date between p_from and p_to
           group by pl.name) x;

  select coalesce(jsonb_agg(jsonb_build_object('key', x.kind, 'amount', x.amount, 'count', x.cnt)
                            order by x.amount desc), '[]'::jsonb) into v_kind
    from (select p.kind, sum(p.amount) as amount, count(*) as cnt from public.payments p
           where p.status = 'paid' and (p.paid_at at time zone v_tz)::date between p_from and p_to
           group by p.kind) x;

  select jsonb_build_object(
           'paid', count(*) filter (where p.status = 'paid'),
           'pending', count(*) filter (where p.status = 'pending'),
           'rejected', count(*) filter (where p.status = 'rejected'),
           'failed', count(*) filter (where p.status = 'failed'),
           'cancelled', count(*) filter (where p.status = 'cancelled'))
    into v_outcomes
    from public.payments p
   where (p.created_at at time zone v_tz)::date between p_from and p_to;

  select count(*) into v_new_members from public.profiles pr
   where (pr.created_at at time zone v_tz)::date between p_from and p_to
     and not exists (select 1 from public.admins a where a.user_id = pr.id);

  select count(*) into v_cancelled from public.subscriptions s
   where s.ended_reason in ('user_cancelled', 'admin_cancelled')
     and (s.cancelled_at at time zone v_tz)::date between p_from and p_to
     and not exists (select 1 from public.admins a where a.user_id = s.user_id);

  with latest as (
    select distinct on (s.user_id) s.status, s.end_date
      from public.subscriptions s
     where not exists (select 1 from public.admins a where a.user_id = s.user_id)
     order by s.user_id, s.created_at desc
  )
  select count(*) filter (where l.status = 'active' and l.end_date > v_now),
         count(*) filter (where l.status = 'active' and l.end_date > v_now
                            and l.end_date <= v_now + interval '7 days'),
         count(*) filter (where (l.status = 'active' and l.end_date <= v_now) or l.status = 'expired')
    into v_active, v_expiring, v_expired
    from latest l;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'unit', v_unit,
    'revenue_total', v_total,
    'paid_count', v_count,
    'average_payment', case when v_count > 0 then round(v_total::numeric / v_count) else 0 end,
    'series', v_series,
    'by_method', v_method,
    'by_plan', v_plan,
    'by_kind', v_kind,
    'outcomes', v_outcomes,
    'new_members', v_new_members,
    'cancellations', v_cancelled,
    'membership_now', jsonb_build_object('active', v_active, 'expiring_soon', v_expiring, 'expired', v_expired)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 12. WHO MAY CALL WHAT
-- ---------------------------------------------------------------------
revoke all on function public.gym_tz()                                       from public, anon, authenticated;
revoke all on function public._log_admin_action(text, text, text, jsonb)     from public, anon, authenticated;
revoke all on function public._block_admin_membership()                      from public, anon, authenticated;

revoke all on function public.admin_dashboard_stats()                        from public, anon;
revoke all on function public.admin_members(text, text, int, int)            from public, anon;
revoke all on function public.admin_member_detail(uuid)                      from public, anon;
revoke all on function public.admin_subscriptions(text, text, int, int)      from public, anon;
revoke all on function public.admin_extend_subscription(uuid, int)           from public, anon;
revoke all on function public.admin_cancel_subscription(uuid, text)          from public, anon;
revoke all on function public.admin_plans()                                  from public, anon;
revoke all on function public.admin_update_plan(int, text, int, text, boolean) from public, anon;
revoke all on function public.admin_payments(text, text, text, int, int)     from public, anon;
revoke all on function public.admin_save_gym_info(jsonb)                     from public, anon;
revoke all on function public.admin_report(date, date)                       from public, anon;

grant execute on function public.admin_dashboard_stats()                     to authenticated;
grant execute on function public.admin_members(text, text, int, int)         to authenticated;
grant execute on function public.admin_member_detail(uuid)                   to authenticated;
grant execute on function public.admin_subscriptions(text, text, int, int)   to authenticated;
grant execute on function public.admin_extend_subscription(uuid, int)        to authenticated;
grant execute on function public.admin_cancel_subscription(uuid, text)       to authenticated;
grant execute on function public.admin_plans()                               to authenticated;
grant execute on function public.admin_update_plan(int, text, int, text, boolean) to authenticated;
grant execute on function public.admin_payments(text, text, text, int, int)  to authenticated;
grant execute on function public.admin_save_gym_info(jsonb)                  to authenticated;
grant execute on function public.admin_report(date, date)                    to authenticated;

commit;

-- Make sure the app sees the new functions right away.
notify pgrst, 'reload schema';
