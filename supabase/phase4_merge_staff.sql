-- GymFit: merge the Staff role into Admin. Only two roles remain: admin and member.
-- Run AFTER phase4_roles.sql. Safe to run more than once.
--
-- What it does
--   1. Anyone who was "staff" becomes "admin" (they keep doing the same work, and the
--      Admin Console now has the Attendance screen they used).
--   2. user_roles may only hold 'admin' from now on (a member simply has no row).
--   3. Attendance moves to admin-only functions: admin_attendance_list,
--      admin_attendance_check_in, admin_attendance_check_out. Saved check-ins are kept.
--   4. The old staff_* functions are removed.
--
-- After this you do NOT need supabase/phase4_staff_portal.sql any more
-- (this file creates the attendance table by itself).
--
-- NOTE: step 1 gives former staff FULL admin rights (plans, prices, reports, cancelling
-- memberships). If someone should not have that, remove them first:
--   delete from public.user_roles where user_id = '<user uuid>' and role = 'staff';

begin;

-- 1 + 2. Roles
update public.user_roles set role = 'admin' where role = 'staff';

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.user_roles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.user_roles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.user_roles
  add constraint user_roles_role_check check (role = 'admin');

-- 3. Attendance table (already there if phase4_staff_portal.sql was run)
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint valid_attendance_times
    check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create unique index if not exists one_open_attendance_per_member
  on public.attendance_records(user_id) where checked_out_at is null;
create index if not exists attendance_user_history_idx
  on public.attendance_records(user_id, checked_in_at desc);
create index if not exists attendance_date_idx
  on public.attendance_records(checked_in_at desc);

alter table public.attendance_records enable row level security;
revoke all on table public.attendance_records from public, anon, authenticated;

create or replace function public.admin_attendance_list(
  p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, user_id uuid, full_name text, email text,
               checked_in_at timestamptz, checked_out_at timestamptz,
               recorded_by uuid, total_count bigint)
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
    select a.id, a.user_id, coalesce(pr.full_name, ''), coalesce(pr.email, ''),
           a.checked_in_at, a.checked_out_at, a.recorded_by, count(*) over ()
      from public.attendance_records a
      join public.profiles pr on pr.id = a.user_id
     where v_q is null or pr.full_name ilike v_q or pr.email ilike v_q
     order by a.checked_in_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_attendance_check_in(p_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  if not exists (select 1 from public.profiles pr where pr.id = p_user_id)
     or exists (select 1 from public.admins a where a.user_id = p_user_id) then
    raise exception 'member_not_found';
  end if;

  -- Only a membership that is running right now (the newest one) may check in.
  if not exists (
    select 1
      from (select s.status, s.start_date, s.end_date
              from public.subscriptions s
             where s.user_id = p_user_id
             order by s.created_at desc
             limit 1) latest
     where latest.status = 'active'
       and latest.start_date <= now()
       and latest.end_date > now()
  ) then
    raise exception 'active_membership_required';
  end if;

  if exists (select 1 from public.attendance_records a
              where a.user_id = p_user_id and a.checked_out_at is null) then
    raise exception 'member_already_checked_in';
  end if;

  insert into public.attendance_records (user_id, recorded_by)
  values (p_user_id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_attendance_check_out(p_attendance_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  update public.attendance_records
     set checked_out_at = now()
   where id = p_attendance_id and checked_out_at is null;

  if not found then
    raise exception 'attendance_not_found_or_already_checked_out';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_attendance_list(text, int, int)  from public, anon;
revoke all on function public.admin_attendance_check_in(uuid)        from public, anon;
revoke all on function public.admin_attendance_check_out(uuid)       from public, anon;
grant execute on function public.admin_attendance_list(text, int, int) to authenticated;
grant execute on function public.admin_attendance_check_in(uuid)       to authenticated;
grant execute on function public.admin_attendance_check_out(uuid)      to authenticated;

-- 4. Remove the old staff functions (the admin ones already do the same work).
drop function if exists public.staff_members(text, text, integer, integer);
drop function if exists public.staff_pending_payments();
drop function if exists public.staff_review_payment(uuid, boolean, text);
drop function if exists public.staff_attendance_list(text, integer, integer);
drop function if exists public.staff_attendance_check_in(uuid);
drop function if exists public.staff_attendance_check_out(uuid);

commit;

notify pgrst, 'reload schema';
