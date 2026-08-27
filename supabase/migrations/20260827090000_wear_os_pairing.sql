create table public.watch_pairings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now()
);
create table public.watch_devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique, name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(), last_seen_at timestamptz, revoked_at timestamptz
);
alter table public.watch_pairings enable row level security;
alter table public.watch_devices enable row level security;
revoke all on public.watch_pairings, public.watch_devices from anon, authenticated;

create or replace function public.set_watch_habit_completion(target_user_id uuid, target_habit_id bigint, target_date date, is_completed boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare target_period text := to_char(target_date, 'YYYY-MM'); target_day integer := extract(day from target_date); exists_habit boolean;
begin
  select exists(select 1 from habits where user_id = target_user_id and id = target_habit_id and kind = 'daily' and not archived) into exists_habit;
  if not exists_habit then return false; end if;
  if is_completed then
    insert into habit_completions(user_id, habit_id, period_key, value) values(target_user_id, target_habit_id, target_period, target_day) on conflict do nothing;
  else
    delete from habit_completions where user_id = target_user_id and habit_id = target_habit_id and period_key = target_period and value = target_day;
  end if;
  insert into tracker_state_versions(user_id, revision) values(target_user_id, 1)
  on conflict(user_id) do update set revision = tracker_state_versions.revision + 1, updated_at = now();
  return true;
end; $$;
revoke all on function public.set_watch_habit_completion(uuid,bigint,date,boolean) from public, anon, authenticated;
grant execute on function public.set_watch_habit_completion(uuid,bigint,date,boolean) to service_role;
