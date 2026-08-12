revoke execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from anon;
revoke execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
