-- Normalize legacy Sunday-to-Saturday weekly goals to Monday-to-Sunday.
-- IDs, progress, links, metadata, status and archive state remain unchanged.
-- The predicate makes the migration idempotent: normalized Monday rows are ignored.
with changed_users as (
  update public.goals
  set period_key = ((period_key::date + 1)::date)::text,
      due_date = due_date + 1,
      updated_at = now()
  where period = 'weekly'
    and case
      when period_key ~ '^\d{4}-\d{2}-\d{2}$' then
        extract(isodow from period_key::date) = 7
        and due_date = period_key::date + 6
      else false
    end
  returning user_id
), affected_users as (
  select distinct user_id from changed_users
)
insert into public.tracker_state_versions (user_id, revision, updated_at)
select user_id, 1, now()
from affected_users
on conflict (user_id) do update
set revision = public.tracker_state_versions.revision + 1,
    updated_at = now();
