alter table public.habits
  add column if not exists schedule jsonb;

alter function public.apply_tracker_state_changes(jsonb, jsonb, bigint)
  rename to apply_tracker_state_changes_before_schedules;

revoke all on function public.apply_tracker_state_changes_before_schedules(jsonb, jsonb, bigint) from public;

create function public.apply_tracker_state_changes(
  payload jsonb,
  baseline jsonb,
  expected_revision bigint
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := public.apply_tracker_state_changes_before_schedules(payload, baseline, expected_revision);

  update public.habits h
  set schedule = item->'schedule'
  from (
    select item from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
  ) habits_payload
  where h.user_id = auth.uid() and h.id = (item->>'id')::bigint;

  return next_revision;
end;
$$;

revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public;
revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from anon;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
