-- Keep implementation helpers out of the exposed API schema while allowing
-- the authenticated, security-invoker entry point to execute the full chain.
create schema if not exists private;

alter function public.apply_tracker_state_changes_legacy(jsonb, jsonb, bigint)
  set schema private;
alter function public.apply_tracker_state_changes_before_skips(jsonb, jsonb, bigint)
  set schema private;
alter function public.apply_tracker_state_changes_before_schedules(jsonb, jsonb, bigint)
  set schema private;
alter function public.apply_tracker_state_changes_before_weekly_reviews(jsonb, jsonb, bigint)
  set schema private;
alter function public.apply_tracker_state_changes_before_goal_steps(jsonb, jsonb, bigint)
  set schema private;

create or replace function private.apply_tracker_state_changes_before_skips(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := private.apply_tracker_state_changes_legacy(payload, baseline, expected_revision);

  update public.categories c
  set priority = coalesce((item->>'priority')::boolean, false)
  from jsonb_array_elements(coalesce(payload->'categories', '[]'::jsonb)) item
  where c.user_id = auth.uid() and c.id = item->>'id';

  update public.habits h
  set archived_at = nullif(item->>'archivedAt', '')::date,
      misses = coalesce(item->'misses', '{}'::jsonb)
  from (
    select item from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
    union all
    select item from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb)) item
  ) habits_payload
  where h.user_id = auth.uid() and h.id = (item->>'id')::bigint;

  return next_revision;
end;
$$;

create or replace function private.apply_tracker_state_changes_before_schedules(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := private.apply_tracker_state_changes_before_skips(payload, baseline, expected_revision);

  update public.habits h
  set skips = coalesce(item->'skips', '{}'::jsonb)
  from (
    select item from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
    union all
    select item from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb)) item
  ) habits_payload
  where h.user_id = auth.uid() and h.id = (item->>'id')::bigint;

  return next_revision;
end;
$$;

create or replace function private.apply_tracker_state_changes_before_weekly_reviews(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := private.apply_tracker_state_changes_before_schedules(payload, baseline, expected_revision);

  update public.habits h
  set schedule = item->'schedule'
  from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
  where h.user_id = auth.uid() and h.id = (item->>'id')::bigint;

  return next_revision;
end;
$$;

create or replace function private.apply_tracker_state_changes_before_goal_steps(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := private.apply_tracker_state_changes_before_weekly_reviews(payload, baseline, expected_revision);

  if baseline is not null then
    delete from public.weekly_reviews review
    where review.user_id = auth.uid()
      and review.week_start in (
        select (item->>'weekStart')::date from jsonb_array_elements(coalesce(baseline->'weeklyReviews', '[]'::jsonb)) item
      )
      and not exists (
        select 1 from jsonb_array_elements(coalesce(payload->'weeklyReviews', '[]'::jsonb)) item
        where (item->>'weekStart')::date = review.week_start
      );
  end if;

  insert into public.weekly_reviews (user_id, week_start, priorities, adjustment, reflection, updated_at)
  select auth.uid(), (item->>'weekStart')::date, coalesce(item->'priorities', '[]'::jsonb),
         coalesce(item->>'adjustment', ''), coalesce(item->>'reflection', ''),
         coalesce((item->>'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(payload->'weeklyReviews', '[]'::jsonb)) item
  on conflict (user_id, week_start) do update set
    priorities = excluded.priorities,
    adjustment = excluded.adjustment,
    reflection = excluded.reflection,
    updated_at = excluded.updated_at;

  return next_revision;
end;
$$;

create or replace function public.apply_tracker_state_changes(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := private.apply_tracker_state_changes_before_goal_steps(payload, baseline, expected_revision);

  update public.goals goal
  set metadata = jsonb_set(goal.metadata, '{steps}', coalesce(item->'steps', '[]'::jsonb), true)
  from jsonb_array_elements(coalesce(payload->'goals', '[]'::jsonb)) item
  where goal.user_id = auth.uid()
    and goal.id = (item->>'id')::bigint;

  return next_revision;
end;
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.apply_tracker_state_changes_legacy(jsonb, jsonb, bigint) to authenticated;
grant execute on function private.apply_tracker_state_changes_before_skips(jsonb, jsonb, bigint) to authenticated;
grant execute on function private.apply_tracker_state_changes_before_schedules(jsonb, jsonb, bigint) to authenticated;
grant execute on function private.apply_tracker_state_changes_before_weekly_reviews(jsonb, jsonb, bigint) to authenticated;
grant execute on function private.apply_tracker_state_changes_before_goal_steps(jsonb, jsonb, bigint) to authenticated;

revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public, anon;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
