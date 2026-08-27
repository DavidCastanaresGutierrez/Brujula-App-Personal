create or replace function public.set_watch_habit_status(
  target_user_id uuid, target_habit_id bigint, target_date date, target_status text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  target_period text := to_char(target_date, 'YYYY-MM');
  target_day integer := extract(day from target_date);
  current_misses jsonb;
  current_skips jsonb;
  next_misses jsonb;
  next_skips jsonb;
begin
  if target_status not in ('pending', 'completed', 'missed', 'skipped') then return false; end if;
  select misses, skips into current_misses, current_skips from habits
  where user_id = target_user_id and id = target_habit_id and kind in ('daily', 'weekly') and not archived
  for update;
  if not found then return false; end if;

  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into next_misses
  from (select distinct value::integer from jsonb_array_elements_text(coalesce(current_misses->target_period, '[]'::jsonb)) item(value) where value::integer <> target_day) values_without_day;
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into next_skips
  from (select distinct value::integer from jsonb_array_elements_text(coalesce(current_skips->target_period, '[]'::jsonb)) item(value) where value::integer <> target_day) values_without_day;
  if target_status = 'missed' then next_misses := next_misses || to_jsonb(target_day); end if;
  if target_status = 'skipped' then next_skips := next_skips || to_jsonb(target_day); end if;

  update habits set
    misses = jsonb_set(coalesce(current_misses, '{}'::jsonb), array[target_period], next_misses, true),
    skips = jsonb_set(coalesce(current_skips, '{}'::jsonb), array[target_period], next_skips, true)
  where user_id = target_user_id and id = target_habit_id;

  delete from habit_completions where user_id = target_user_id and habit_id = target_habit_id and period_key = target_period and value = target_day;
  if target_status = 'completed' then
    insert into habit_completions(user_id, habit_id, period_key, value)
    values(target_user_id, target_habit_id, target_period, target_day) on conflict do nothing;
  end if;
  insert into tracker_state_versions(user_id, revision) values(target_user_id, 1)
  on conflict(user_id) do update set revision = tracker_state_versions.revision + 1, updated_at = now();
  return true;
end; $$;

create or replace function public.set_watch_weekly_goal_status(
  target_user_id uuid, target_goal_id bigint, target_status text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if target_status not in ('active', 'completed', 'discarded') then return false; end if;
  update goals set
    status = target_status,
    current_value = case when target_status = 'completed' then target_value when measurement = 'complete' then 0 else current_value end,
    updated_at = now()
  where user_id = target_user_id and id = target_goal_id and period = 'weekly';
  if not found then return false; end if;
  insert into tracker_state_versions(user_id, revision) values(target_user_id, 1)
  on conflict(user_id) do update set revision = tracker_state_versions.revision + 1, updated_at = now();
  return true;
end; $$;

revoke all on function public.set_watch_habit_status(uuid,bigint,date,text) from public, anon, authenticated;
revoke all on function public.set_watch_weekly_goal_status(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.set_watch_habit_status(uuid,bigint,date,text) to service_role;
grant execute on function public.set_watch_weekly_goal_status(uuid,bigint,text) to service_role;
