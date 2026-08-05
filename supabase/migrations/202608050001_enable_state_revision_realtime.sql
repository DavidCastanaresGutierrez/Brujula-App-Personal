-- Emit one synchronization signal after each successful transactional save.
-- Clients then fetch the complete, RLS-protected state through the API.
alter publication supabase_realtime add table public.tracker_state_versions;
