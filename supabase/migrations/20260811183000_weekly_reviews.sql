create table if not exists public.weekly_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  priorities jsonb not null default '[]'::jsonb check (jsonb_typeof(priorities) = 'array' and jsonb_array_length(priorities) <= 3),
  adjustment text not null default '' check (char_length(adjustment) <= 500),
  reflection text not null default '' check (char_length(reflection) <= 1500),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;

create policy "Users manage their weekly reviews"
on public.weekly_reviews for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.weekly_reviews to authenticated;
revoke all on public.weekly_reviews from anon;

alter function public.apply_tracker_state_changes(jsonb, jsonb, bigint)
  rename to apply_tracker_state_changes_before_weekly_reviews;

revoke all on function public.apply_tracker_state_changes_before_weekly_reviews(jsonb, jsonb, bigint) from public, anon, authenticated;

create function public.apply_tracker_state_changes(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_revision bigint;
begin
  next_revision := public.apply_tracker_state_changes_before_weekly_reviews(payload, baseline, expected_revision);

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

revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public, anon;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
