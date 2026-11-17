-- =====================================================================
-- GymFit PHASE 2: membership and subscription management
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. PLANS: the plan details now live in the database
--    (images stay in the app; everything else can be edited in Table Editor)
-- ---------------------------------------------------------------------
alter table public.plans
  add column if not exists best_for text,
  add column if not exists duration_label text,
  add column if not exists description text,
  add column if not exists benefits jsonb not null default '[]'::jsonb,
  add column if not exists access_note text,
  add column if not exists icon text,
  add column if not exists sort_order int not null default 0,
  add column if not exists is_active boolean not null default true;

alter table public.plans drop constraint if exists plans_positive_check;
alter table public.plans
  add constraint plans_positive_check check (days > 0 and amount > 0);

update public.plans set
  best_for = 'First-time visitors',
  duration_label = '1 day',
  description = 'One day of gym access. Good for trying out the gym.',
  benefits = '["Full access to the gym floor","Use of cardio and weight machines","Free locker for the day","Free drinking water"]'::jsonb,
  access_note = 'Valid for 1 day. Your access starts on the day you subscribe and ends after that day.',
  icon = 'lightning-bolt',
  sort_order = 1
where id = 1;

update public.plans set
  best_for = 'Regular gym-goers',
  duration_label = '30 days',
  description = 'Thirty days of gym access. Our most popular plan for regular gym-goers.',
  benefits = '["Unlimited gym visits for 30 days","Use of all gym equipment","Free locker and shower access","One free fitness assessment"]'::jsonb,
  access_note = 'Valid for 30 days. Visit as often as you like while your membership is active.',
  icon = 'calendar-month',
  sort_order = 2
where id = 2;

update public.plans set
  best_for = 'Building consistency',
  duration_label = '3 months',
  description = 'Three months of gym access at a lower monthly cost.',
  benefits = '["Unlimited gym visits for 3 months","Use of all gym equipment","Free locker and shower access","Two free fitness assessments","One free personal training session"]'::jsonb,
  access_note = 'Valid for 3 months. Visit as often as you like while your membership is active.',
  icon = 'calendar-range',
  sort_order = 3
where id = 3;

update public.plans set
  best_for = 'Long-term goals',
  duration_label = '6 months',
  description = 'Six months of gym access for members who want to build a habit.',
  benefits = '["Unlimited gym visits for 6 months","Use of all gym equipment","Free locker and shower access","Three free fitness assessments","Two free personal training sessions"]'::jsonb,
  access_note = 'Valid for 6 months. Visit as often as you like while your membership is active.',
  icon = 'calendar-star',
  sort_order = 4
where id = 4;

update public.plans set
  best_for = 'Committed members',
  duration_label = '12 months',
  description = 'A full year of gym access. The best value for committed members.',
  benefits = '["Unlimited gym visits for 12 months","Use of all gym equipment","Free locker and shower access","Four free fitness assessments","Three free personal training sessions","Bring a friend for free once a month"]'::jsonb,
  access_note = 'Valid for 12 months. Visit as often as you like while your membership is active.',
  icon = 'trophy',
  sort_order = 5
where id = 5;

-- ---------------------------------------------------------------------
-- 2. SUBSCRIPTIONS: scheduled plan change + why a membership ended
-- ---------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists next_plan_id int references public.plans(id),
  add column if not exists ended_reason text;

alter table public.subscriptions drop constraint if exists subscriptions_ended_reason_check;
alter table public.subscriptions
  add constraint subscriptions_ended_reason_check
  check (ended_reason in ('user_cancelled', 'upgraded', 'expired'));

alter table public.subscriptions drop constraint if exists subscriptions_active_has_dates;
alter table public.subscriptions
  add constraint subscriptions_active_has_dates
  check (status <> 'active' or (start_date is not null and end_date is not null));

update public.subscriptions set ended_reason = 'user_cancelled'
  where status = 'cancelled' and ended_reason is null;
update public.subscriptions set ended_reason = 'expired'
  where status = 'expired' and ended_reason is null;

create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. PAYMENTS: one row for every payment event (this feeds Payment History)
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists kind text not null default 'new',
  add column if not exists status text not null default 'paid';

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments
  add constraint payments_kind_check check (kind in ('new', 'renewal', 'upgrade'));
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check check (status in ('paid', 'pending', 'cancelled'));

create index if not exists payments_user_paid_idx
  on public.payments (user_id, paid_at desc);

-- Phase 1 kept history inside the subscriptions rows. Copy it into payments.
insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, paid_at)
select s.user_id, s.id, s.plan_id, p.amount, coalesce(s.method, 'gym'), 'new',
       case
         when s.status = 'pending' then 'pending'
         when s.status = 'cancelled' and s.start_date is null then 'cancelled'
         else 'paid'
       end,
       coalesce(s.start_date, s.created_at)
from public.subscriptions s
join public.plans p on p.id = s.plan_id
where not exists (select 1 from public.payments x where x.subscription_id = s.id);

-- ---------------------------------------------------------------------
-- 4. LOCK THE TABLES: the app can only READ them.
--    Every change goes through the functions below, which enforce the rules.
-- ---------------------------------------------------------------------
drop policy if exists "create own subscriptions" on public.subscriptions;
drop policy if exists "update own subscriptions" on public.subscriptions;
drop policy if exists "create own payments" on public.payments;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.plans from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. FUNCTIONS (the rules)
-- ---------------------------------------------------------------------

-- Marks the caller's memberships that ran out as 'expired'.
create or replace function public.expire_my_memberships()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.subscriptions
     set status = 'expired', ended_reason = 'expired'
   where user_id = auth.uid()
     and status = 'active'
     and end_date <= now();
end;
$$;

-- Same, for everybody. Only for a scheduled job (not callable from the app).
create or replace function public.expire_all_memberships()
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  v_count int;
begin
  update public.subscriptions
     set status = 'expired', ended_reason = 'expired'
   where status = 'active' and end_date <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- NEW MEMBERSHIP. Pay online = active now. Pay at the gym = pending (reserved).
create or replace function public.subscribe_to_plan(p_plan_id int, p_method text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_plan public.plans;
  v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if p_method is null or p_method not in ('gcash', 'maya', 'card', 'gym') then
    raise exception 'invalid_method';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public.expire_my_memberships();

  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then raise exception 'plan_not_available'; end if;

  if exists (select 1 from public.subscriptions
              where user_id = v_uid and status in ('pending', 'active')) then
    raise exception 'already_has_membership';
  end if;

  if p_method = 'gym' then
    insert into public.subscriptions (user_id, plan_id, status, method)
    values (v_uid, v_plan.id, 'pending', 'gym')
    returning * into v_sub;
    insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, paid_at)
    values (v_uid, v_sub.id, v_plan.id, v_plan.amount, 'gym', 'new', 'pending', v_now);
    return jsonb_build_object('result', 'pending', 'subscription_id', v_sub.id);
  end if;

  insert into public.subscriptions (user_id, plan_id, status, method, start_date, end_date)
  values (v_uid, v_plan.id, 'active', p_method, v_now, v_now + make_interval(days => v_plan.days))
  returning * into v_sub;
  insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, paid_at)
  values (v_uid, v_sub.id, v_plan.id, v_plan.amount, p_method, 'new', 'paid', v_now);
  return jsonb_build_object('result', 'active', 'subscription_id', v_sub.id, 'ends', v_sub.end_date);
end;
$$;

-- PAY A RESERVATION: a pending membership becomes active.
create or replace function public.complete_pending_payment(p_method text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_plan public.plans;
  v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if p_method is null or p_method not in ('gcash', 'maya', 'card', 'gym') then
    raise exception 'invalid_method';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_sub from public.subscriptions
   where user_id = v_uid and status = 'pending' for update;
  if not found then raise exception 'no_pending_membership'; end if;
  select * into v_plan from public.plans where id = v_sub.plan_id;

  update public.subscriptions
     set status = 'active', method = p_method, start_date = v_now,
         end_date = v_now + make_interval(days => v_plan.days)
   where id = v_sub.id;
  update public.payments
     set status = 'paid', method = p_method, paid_at = v_now
   where subscription_id = v_sub.id and status = 'pending';
  return jsonb_build_object('result', 'active');
end;
$$;

-- CANCEL: a reservation is released, an active membership ends now (no refund).
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
  update public.payments set status = 'cancelled'
   where subscription_id = v_sub.id and status = 'pending';
  return jsonb_build_object('result', 'cancelled', 'was', v_sub.status);
end;
$$;

-- RENEW: an active membership is extended; an expired one starts again from now.
-- If a downgrade was scheduled, the renewal uses that plan.
create or replace function public.renew_my_subscription(p_method text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_plan public.plans;
  v_sub public.subscriptions;
  v_new public.subscriptions;
  v_end timestamptz;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if p_method is null or p_method not in ('gcash', 'maya', 'card') then
    raise exception 'online_payment_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public.expire_my_memberships();

  select * into v_sub from public.subscriptions
   where user_id = v_uid order by created_at desc limit 1 for update;
  if not found or v_sub.status = 'cancelled' then raise exception 'nothing_to_renew'; end if;
  if v_sub.status = 'pending' then raise exception 'payment_pending'; end if;

  select * into v_plan from public.plans
   where id = coalesce(v_sub.next_plan_id, v_sub.plan_id) and is_active;
  if not found then raise exception 'plan_not_available'; end if;

  if v_sub.status = 'active' then
    v_end := v_sub.end_date + make_interval(days => v_plan.days);
    update public.subscriptions
       set plan_id = v_plan.id, next_plan_id = null, method = p_method, end_date = v_end
     where id = v_sub.id;
    insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, paid_at)
    values (v_uid, v_sub.id, v_plan.id, v_plan.amount, p_method, 'renewal', 'paid', v_now);
    return jsonb_build_object('result', 'extended', 'ends', v_end);
  end if;

  -- expired: a fresh membership starts now
  v_end := v_now + make_interval(days => v_plan.days);
  insert into public.subscriptions (user_id, plan_id, status, method, start_date, end_date)
  values (v_uid, v_plan.id, 'active', p_method, v_now, v_end)
  returning * into v_new;
  insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, paid_at)
  values (v_uid, v_new.id, v_plan.id, v_plan.amount, p_method, 'renewal', 'paid', v_now);
  return jsonb_build_object('result', 'restarted', 'ends', v_end);
end;
$$;

-- QUOTE: what would changing to another plan do? (the app shows this before paying)
--   upgrade   -> starts now; the unused part of the current plan is credited
--   downgrade -> takes effect when the current membership ends
--   clear     -> cancels a downgrade that was scheduled
create or replace function public.quote_plan_change(p_plan_id int)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_sub public.subscriptions;
  v_old public.plans;
  v_new public.plans;
  v_credit int;
  v_charge int;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  perform public.expire_my_memberships();

  select * into v_sub from public.subscriptions
   where user_id = v_uid and status = 'active' and end_date > v_now;
  if not found then raise exception 'no_active_membership'; end if;
  select * into v_old from public.plans where id = v_sub.plan_id;
  select * into v_new from public.plans where id = p_plan_id and is_active;
  if not found then raise exception 'plan_not_available'; end if;

  if v_new.id = v_old.id then
    if v_sub.next_plan_id is not null then
      return jsonb_build_object('kind', 'clear', 'charge', 0);
    end if;
    raise exception 'same_plan';
  end if;

  if v_new.amount > v_old.amount then
    v_credit := floor(v_old.amount * extract(epoch from (v_sub.end_date - v_now))
                      / (v_old.days * 86400.0));
    v_charge := greatest(v_new.amount - v_credit, 0);
    return jsonb_build_object('kind', 'upgrade', 'credit', v_credit, 'charge', v_charge,
                              'new_amount', v_new.amount,
                              'ends', v_now + make_interval(days => v_new.days));
  end if;

  return jsonb_build_object('kind', 'downgrade', 'charge', 0, 'effective', v_sub.end_date);
end;
$$;

-- CHANGE PLAN: runs the quote above.
create or replace function public.change_my_plan(p_plan_id int, p_method text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_quote jsonb;
  v_sub public.subscriptions;
  v_new public.plans;
  v_created public.subscriptions;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  v_quote := public.quote_plan_change(p_plan_id);
  select * into v_sub from public.subscriptions
   where user_id = v_uid and status = 'active' for update;

  if v_quote->>'kind' = 'clear' then
    update public.subscriptions set next_plan_id = null where id = v_sub.id;
    return v_quote;
  end if;

  if v_quote->>'kind' = 'downgrade' then
    update public.subscriptions set next_plan_id = p_plan_id where id = v_sub.id;
    return v_quote;
  end if;

  -- upgrade
  if p_method is null or p_method not in ('gcash', 'maya', 'card') then
    raise exception 'online_payment_required';
  end if;
  select * into v_new from public.plans where id = p_plan_id;

  update public.subscriptions
     set status = 'cancelled', cancelled_at = v_now, ended_reason = 'upgraded',
         next_plan_id = null, end_date = v_now
   where id = v_sub.id;
  insert into public.subscriptions (user_id, plan_id, status, method, start_date, end_date)
  values (v_uid, v_new.id, 'active', p_method, v_now, v_now + make_interval(days => v_new.days))
  returning * into v_created;
  insert into public.payments (user_id, subscription_id, plan_id, amount, method, kind, status, paid_at)
  values (v_uid, v_created.id, v_new.id, (v_quote->>'charge')::int, p_method, 'upgrade', 'paid', v_now);
  return v_quote;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. WHO MAY CALL WHAT
-- ---------------------------------------------------------------------
revoke all on function public.expire_my_memberships()          from public, anon;
revoke all on function public.expire_all_memberships()         from public, anon, authenticated;
revoke all on function public.subscribe_to_plan(int, text)     from public, anon;
revoke all on function public.complete_pending_payment(text)   from public, anon;
revoke all on function public.cancel_my_subscription()         from public, anon;
revoke all on function public.renew_my_subscription(text)      from public, anon;
revoke all on function public.quote_plan_change(int)           from public, anon;
revoke all on function public.change_my_plan(int, text)        from public, anon;

grant execute on function public.expire_my_memberships()        to authenticated;
grant execute on function public.subscribe_to_plan(int, text)   to authenticated;
grant execute on function public.complete_pending_payment(text) to authenticated;
grant execute on function public.cancel_my_subscription()       to authenticated;
grant execute on function public.renew_my_subscription(text)    to authenticated;
grant execute on function public.quote_plan_change(int)         to authenticated;
grant execute on function public.change_my_plan(int, text)      to authenticated;

commit;

-- Make sure the app sees the new functions right away.
notify pgrst, 'reload schema';
