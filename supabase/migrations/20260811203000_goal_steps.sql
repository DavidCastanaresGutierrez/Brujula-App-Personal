comment on column public.goals.metadata is
  'Datos específicos del objetivo: módulos, vínculos, archivo, hitos y acciones fechadas.';

alter function public.apply_tracker_state_changes(jsonb, jsonb, bigint)
  rename to apply_tracker_state_changes_before_goal_steps;

revoke all on function public.apply_tracker_state_changes_before_goal_steps(jsonb, jsonb, bigint) from public, anon, authenticated;

create function public.apply_tracker_state_changes(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := public.apply_tracker_state_changes_before_goal_steps(payload, baseline, expected_revision);

  update public.goals goal
  set metadata = jsonb_set(goal.metadata, '{steps}', coalesce(item->'steps', '[]'::jsonb), true)
  from jsonb_array_elements(coalesce(payload->'goals', '[]'::jsonb)) item
  where goal.user_id = auth.uid()
    and goal.id = (item->>'id')::bigint;

  return next_revision;
end;
$$;

revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public, anon;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
