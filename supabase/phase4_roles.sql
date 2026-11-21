-- GymFit: one source of truth for roles.
-- Run AFTER phase3.sql and phase4.sql. Safe to run more than once.
--
-- BEFORE: two places said who was an admin (public.admins and public.user_roles), and
--         is_admin() read a different table than the Staff portal.
-- AFTER:  public.user_roles decides everything.
--           * is_admin() reads user_roles.
--           * Existing admins are copied into user_roles first, so nobody loses access.
--           * public.admins stays as a READ-ONLY mirror kept in sync by a trigger, because
--             phase3/phase4 policies and functions still refer to it. Nothing is dropped.
--
-- To give or remove a role from now on, change ONLY user_roles:
--   insert into public.user_roles (user_id, role) values ('<user uuid>', 'admin')
--   on conflict (user_id) do nothing;                              -- make an admin
--   delete from public.user_roles where user_id = '<user uuid>';   -- back to member
-- There are only two roles: admin (a row here) and member (no row).
-- A direct write to public.admins is refused.

begin;

-- 1. The table (only created on a project that does not have it yet).
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

-- A signed-in user may read only their own role (the app needs this at login).
drop policy if exists "read own role" on public.user_roles;
create policy "read own role" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- Nobody can change roles from the app. Without this, a member could promote themselves.
grant select on public.user_roles to authenticated;
revoke insert, update, delete on public.user_roles from anon, authenticated;

-- 2. Copy every existing admin across BEFORE anything else changes.
update public.user_roles ur
   set role = 'admin'
  from public.admins a
 where ur.user_id = a.user_id and ur.role <> 'admin';

insert into public.user_roles (user_id, role)
select a.user_id, 'admin'
  from public.admins a
 where not exists (select 1 from public.user_roles ur where ur.user_id = a.user_id);

-- 3. is_admin() now reads user_roles. (create or replace keeps its permissions.)
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- 4. Keep the legacy admins table as a mirror of user_roles.
create or replace function public._sync_admins_mirror()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.user_id <> old.user_id) then
    delete from public.admins where user_id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.role = 'admin' then
    insert into public.admins (user_id) values (new.user_id) on conflict do nothing;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_admins_mirror on public.user_roles;
create trigger sync_admins_mirror
  after insert or update or delete on public.user_roles
  for each row execute function public._sync_admins_mirror();

-- 5. Refuse direct edits of the mirror. A change made by the sync trigger runs one
--    trigger level deeper, so it is allowed; a hand-made INSERT/UPDATE/DELETE is not.
create or replace function public._admins_is_read_only()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if pg_trigger_depth() < 2 then
    raise exception 'admins_is_read_only: change public.user_roles instead';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists admins_is_read_only on public.admins;
create trigger admins_is_read_only
  before insert or update or delete on public.admins
  for each row execute function public._admins_is_read_only();

revoke all on function public._sync_admins_mirror() from public, anon, authenticated;
revoke all on function public._admins_is_read_only() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
