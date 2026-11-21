-- =====================================================================
-- GymFit Phase 5: persistent member profiles and Admin-managed Home banner
-- Run once in Supabase SQL Editor after the existing Phase 1-4 migrations.
-- Reuses the existing profiles table, gym_info table, auth and Supabase Storage.
-- =====================================================================

begin;

-- Extend the existing member profile row; do not create a second profile table.
alter table public.profiles
  add column if not exists phone text not null default '',
  add column if not exists address text not null default '',
  add column if not exists avatar_url text;

alter table public.profiles enable row level security;
drop policy if exists "members update own profile details" on public.profiles;
create policy "members update own profile details"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- One persistent public bucket: profile pictures are public URLs, while object
-- ownership is enforced by folder-level policies. Banner objects are Admin-only
-- to upload/delete and publicly readable by the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-media', 'gym-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

 drop policy if exists "gym media public read" on storage.objects;
create policy "gym media public read"
  on storage.objects for select to public
  using (bucket_id = 'gym-media');

drop policy if exists "members upload own avatar" on storage.objects;
create policy "members upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gym-media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "members update own avatar" on storage.objects;
create policy "members update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'gym-media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'gym-media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "members delete own avatar" on storage.objects;
create policy "members delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gym-media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "admins upload gym banner" on storage.objects;
create policy "admins upload gym banner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gym-media'
    and (storage.foldername(name))[1] = 'banners'
    and public.is_admin()
  );

drop policy if exists "admins delete gym banner" on storage.objects;
create policy "admins delete gym banner"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gym-media'
    and (storage.foldername(name))[1] = 'banners'
    and public.is_admin()
  );

-- The banner URL is readable through the existing gym_info SELECT policy.
insert into public.gym_info (key, value) values ('banner_url', '')
on conflict (key) do nothing;

create or replace function public.admin_set_banner_url(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_url is null then raise exception 'invalid_banner_url'; end if;
  if char_length(p_url) > 2048 then raise exception 'invalid_banner_url'; end if;
  if p_url <> '' and p_url not like '%/storage/v1/object/public/gym-media/banners/%' then
    raise exception 'invalid_banner_url';
  end if;

  insert into public.gym_info (key, value, updated_at, updated_by)
  values ('banner_url', p_url, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  perform public._log_admin_action(
    case when p_url = '' then 'remove_home_banner' else 'update_home_banner' end,
    'gym_info', 'banner_url', '{}'::jsonb
  );
  return jsonb_build_object('result', 'saved');
end;
$$;

revoke all on function public.admin_set_banner_url(text) from public, anon;
grant execute on function public.admin_set_banner_url(text) to authenticated;

commit;
