-- GymFit Phase 4 fixes (dashboard and reports)
-- Run AFTER phase4.sql. Safe to run more than once. Nothing is dropped.
--
-- What this fixes:
--   1. A paid payment with an empty paid_at date now counts in today, this month,
--      the daily chart and the reports (it already counted in the all-time total).
--   2. Reports now separate real cancellations (a paid membership that was ended)
--      from reservations that were released before any payment cleared.
--
-- Already correct in phase4.sql, so unchanged: "Without a membership" and the
-- "Expiring soon" list both use each member's newest membership.

begin;

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

  select coalesce(sum(p.amount) filter (where coalesce(p.paid_at, p.created_at) >= v_day_start), 0),
         coalesce(sum(p.amount) filter (where coalesce(p.paid_at, p.created_at) >= v_month_start), 0),
         coalesce(sum(p.amount), 0)
    into v_rev_today, v_rev_month, v_rev_total
    from public.payments p where p.status = 'paid';

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day::text, 'amount', coalesce(r.amount, 0))
                            order by d.day), '[]'::jsonb)
    into v_daily
    from (select (v_today - g) as day from generate_series(0, 6) g) d
    left join (
      select (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date as day, sum(p.amount) as amount
        from public.payments p
       where p.status = 'paid' and coalesce(p.paid_at, p.created_at) >= v_now - interval '9 days'
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
  v_released int;
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
   where p.status = 'paid' and (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object('label', b.bucket::text, 'amount', coalesce(r.amount, 0),
                                               'count', coalesce(r.cnt, 0)) order by b.bucket), '[]'::jsonb)
    into v_series
    from (select g::date as bucket
            from generate_series(date_trunc(v_unit, p_from::timestamp),
                                 date_trunc(v_unit, p_to::timestamp),
                                 ('1 ' || v_unit)::interval) g) b
    left join (
      select date_trunc(v_unit, (coalesce(p.paid_at, p.created_at) at time zone v_tz))::date as bucket,
             sum(p.amount) as amount, count(*) as cnt
        from public.payments p
       where p.status = 'paid' and (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date between p_from and p_to
       group by 1
    ) r on r.bucket = b.bucket;

  select coalesce(jsonb_agg(jsonb_build_object('key', x.method, 'amount', x.amount, 'count', x.cnt)
                            order by x.amount desc), '[]'::jsonb) into v_method
    from (select p.method, sum(p.amount) as amount, count(*) as cnt from public.payments p
           where p.status = 'paid' and (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date between p_from and p_to
           group by p.method) x;

  select coalesce(jsonb_agg(jsonb_build_object('key', x.name, 'amount', x.amount, 'count', x.cnt)
                            order by x.amount desc), '[]'::jsonb) into v_plan
    from (select pl.name, sum(p.amount) as amount, count(*) as cnt
            from public.payments p join public.plans pl on pl.id = p.plan_id
           where p.status = 'paid' and (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date between p_from and p_to
           group by pl.name) x;

  select coalesce(jsonb_agg(jsonb_build_object('key', x.kind, 'amount', x.amount, 'count', x.cnt)
                            order by x.amount desc), '[]'::jsonb) into v_kind
    from (select p.kind, sum(p.amount) as amount, count(*) as cnt from public.payments p
           where p.status = 'paid' and (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date between p_from and p_to
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

  -- A real cancellation ends a membership that was paid for. A reservation that was
  -- released before any payment cleared is counted separately.
  select count(*) filter (where paid.has_paid),
         count(*) filter (where not paid.has_paid)
    into v_cancelled, v_released
    from public.subscriptions s
    cross join lateral (
      select exists (select 1 from public.payments p
                      where p.subscription_id = s.id and p.status = 'paid') as has_paid
    ) paid
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
    'released_reservations', v_released,
    'membership_now', jsonb_build_object('active', v_active, 'expiring_soon', v_expiring, 'expired', v_expired)
  );
end;
$$;

-- create or replace keeps the existing permissions; set them again to be explicit.
revoke all on function public.admin_dashboard_stats() from public, anon;
revoke all on function public.admin_report(date, date) from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_report(date, date) to authenticated;

commit;

notify pgrst, 'reload schema';
