alter table public.categories add column if not exists priority boolean not null default false;
alter table public.habits add column if not exists archived_at date;
alter table public.habits add column if not exists misses jsonb not null default '{}'::jsonb;

alter function public.apply_tracker_state_changes(jsonb, jsonb, bigint)
  rename to apply_tracker_state_changes_legacy;

revoke all on function public.apply_tracker_state_changes_legacy(jsonb, jsonb, bigint) from public;

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
  next_revision := public.apply_tracker_state_changes_legacy(payload, baseline, expected_revision);

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

revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
