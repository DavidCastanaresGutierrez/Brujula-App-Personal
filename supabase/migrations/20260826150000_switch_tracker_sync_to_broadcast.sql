-- Replace Postgres Changes with private Broadcast notifications for tracker revisions.
-- This avoids continuous WAL polling while keeping multi-device sync immediate.

drop policy if exists "brujula users receive own tracker broadcasts" on realtime.messages;

create policy "brujula users receive own tracker broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'brujula-sync:' || (select auth.uid())::text
);

create or replace function public.broadcast_tracker_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'brujula-sync:' || new.user_id::text,
    'revision',
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function public.broadcast_tracker_revision() from public, anon, authenticated;

drop trigger if exists broadcast_tracker_revision_change on public.tracker_state_versions;

create trigger broadcast_tracker_revision_change
after insert or update on public.tracker_state_versions
for each row
execute function public.broadcast_tracker_revision();

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tracker_state_versions'
  ) then
    alter publication supabase_realtime drop table public.tracker_state_versions;
  end if;
end;
$$;
