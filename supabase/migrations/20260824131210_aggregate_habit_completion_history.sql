create or replace function public.get_habit_completion_history()
returns table (habit_id bigint, history jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select grouped.habit_id,
         jsonb_object_agg(grouped.period_key, grouped.period_values order by grouped.period_key) as history
  from (
    select completion.habit_id,
           completion.period_key,
           jsonb_agg(completion.value order by completion.value) as period_values
    from public.habit_completions as completion
    where completion.user_id = (select auth.uid())
    group by completion.habit_id, completion.period_key
  ) as grouped
  group by grouped.habit_id
  order by grouped.habit_id;
$$;

revoke execute on function public.get_habit_completion_history() from public;
revoke execute on function public.get_habit_completion_history() from anon;
grant execute on function public.get_habit_completion_history() to authenticated;
