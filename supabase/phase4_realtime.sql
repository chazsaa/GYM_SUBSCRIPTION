-- GymFit: turn on realtime for the tables the member app listens to.
-- Run once in the Supabase SQL Editor. Safe to run more than once.
-- Without this, an admin's edit to gym info or plans only reaches members after
-- they reopen the app (the app also refreshes when it returns to the foreground).

do $$
declare
  t text;
begin
  -- Hosted Supabase already has this publication; create it only on a bare Postgres.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['gym_info', 'plans'] loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
