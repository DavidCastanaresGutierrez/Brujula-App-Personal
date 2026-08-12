revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from anon;

grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
