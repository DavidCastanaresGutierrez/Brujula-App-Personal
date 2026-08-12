create table if not exists tracker_state_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

alter table tracker_state_versions enable row level security;

drop policy if exists "Users manage their tracker revision" on tracker_state_versions;
create policy "Users manage their tracker revision"
on tracker_state_versions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Applies one validated tracker snapshot atomically. PostgreSQL executes a
-- function call in a single transaction, so an error rolls back every table.
-- Deletions are limited to records present in the caller's baseline; a client
-- without a synchronized baseline cannot erase existing server data.
create or replace function public.apply_tracker_state_changes(payload jsonb, baseline jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_revision bigint;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if expected_revision is null or expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Revision no valida';
  end if;

  insert into tracker_state_versions (user_id, revision)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select revision into current_revision
  from tracker_state_versions
  where user_id = current_user_id
  for update;

  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'Conflicto de revision';
  end if;

  -- Categories must exist before habits are inserted or reassigned.
  insert into categories (user_id, id, label, icon, color, position)
  select current_user_id, item->>'id', item->>'label', coalesce(item->>'icon', '●'),
         item->>'color', ordinality::integer - 1
  from jsonb_array_elements(coalesce(payload->'categories', '[]'::jsonb))
       with ordinality as category_items(item, ordinality)
  on conflict (user_id, id) do update set
    label = excluded.label,
    icon = excluded.icon,
    color = excluded.color,
    position = excluded.position;

  -- Only delete habits the client proves existed in its synchronized baseline.
  if baseline is not null then
    delete from habits h
    where h.user_id = current_user_id
      and h.id in (
        select (item->>'id')::bigint
        from (
          select item from jsonb_array_elements(coalesce(baseline->'daily', '[]'::jsonb)) item
          union all
          select item from jsonb_array_elements(coalesce(baseline->'weekly', '[]'::jsonb)) item
        ) baseline_habits
      )
      and not exists (
        select 1
        from (
          select item from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
          union all
          select item from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb)) item
        ) next_habits
        where (next_habits.item->>'id')::bigint = h.id
      );
  end if;

  insert into habits (
    user_id, id, category_id, kind, name, goal, color, position,
    archived, every_day, weekdays_only, celebrated_streak_30
  )
  select current_user_id, (item->>'id')::bigint, item->>'category', habit_kind,
         item->>'name', (item->>'goal')::integer, item->>'color', position,
         coalesce((item->>'archived')::boolean, false),
         case when habit_kind = 'daily' then coalesce((item->>'everyDay')::boolean, false) else false end,
         case when habit_kind = 'daily' then coalesce((item->>'weekdaysOnly')::boolean, false) else false end,
         nullif(item->>'celebratedStreak30', '')
  from (
    select item, ordinality::integer - 1 as position, 'daily'::text as habit_kind
    from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb))
         with ordinality as daily_items(item, ordinality)
    union all
    select item,
           jsonb_array_length(coalesce(payload->'daily', '[]'::jsonb)) + ordinality::integer - 1,
           'weekly'::text as habit_kind
    from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb))
         with ordinality as weekly_items(item, ordinality)
  ) all_habits
  on conflict (user_id, id) do update set
    category_id = excluded.category_id,
    kind = excluded.kind,
    name = excluded.name,
    goal = excluded.goal,
    color = excluded.color,
    position = excluded.position,
    archived = excluded.archived,
    every_day = excluded.every_day,
    weekdays_only = excluded.weekdays_only,
    celebrated_streak_30 = excluded.celebrated_streak_30;

  -- Remove only completions present in the baseline and absent from the new state.
  if baseline is not null then
    delete from habit_completions c
    where c.user_id = current_user_id
      and exists (
        select 1
        from (
          select item as habit from jsonb_array_elements(coalesce(baseline->'daily', '[]'::jsonb)) item
          union all
          select item as habit from jsonb_array_elements(coalesce(baseline->'weekly', '[]'::jsonb)) item
        ) baseline_habits
        cross join lateral jsonb_each(coalesce(habit->'history', '{}'::jsonb)) history_entry
        cross join lateral jsonb_array_elements_text(history_entry.value) completion
        where (habit->>'id')::bigint = c.habit_id
          and history_entry.key = c.period_key
          and completion.value::integer = c.value
      )
      and not exists (
        select 1
        from (
          select item as habit from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
          union all
          select item as habit from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb)) item
        ) next_habits
        cross join lateral jsonb_each(coalesce(habit->'history', '{}'::jsonb)) history_entry
        cross join lateral jsonb_array_elements_text(history_entry.value) completion
        where (habit->>'id')::bigint = c.habit_id
          and history_entry.key = c.period_key
          and completion.value::integer = c.value
      );
  end if;

  insert into habit_completions (user_id, habit_id, period_key, value)
  select current_user_id, (habit->>'id')::bigint, history_entry.key, completion.value::integer
  from (
    select item as habit from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
    union all
    select item as habit from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb)) item
  ) all_habits
  cross join lateral jsonb_each(coalesce(habit->'history', '{}'::jsonb)) history_entry
  cross join lateral jsonb_array_elements_text(history_entry.value) completion
  on conflict do nothing;

  if coalesce(baseline->'motivations', '[]'::jsonb)
       is distinct from coalesce(payload->'motivations', '[]'::jsonb) then
    delete from motivational_quotes where user_id = current_user_id;
    insert into motivational_quotes (user_id, text, position)
    select current_user_id, value, ordinality::integer - 1
    from jsonb_array_elements_text(coalesce(payload->'motivations', '[]'::jsonb))
         with ordinality as quote_items(value, ordinality);
  end if;

  if baseline is not null then
    delete from goals g
    where g.user_id = current_user_id
      and g.id in (
        select (item->>'id')::bigint
        from jsonb_array_elements(coalesce(baseline->'goals', '[]'::jsonb)) item
      )
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(payload->'goals', '[]'::jsonb)) item
        where (item->>'id')::bigint = g.id
      );
  end if;

  insert into goals (
    user_id, id, title, category_id, period, period_key, measurement,
    target_value, current_value, unit, status, due_date, position,
    linked_habit_id, metadata, updated_at
  )
  select current_user_id, (item->>'id')::bigint, item->>'title', item->>'category',
         item->>'period', item->>'periodKey', item->>'measurement',
         coalesce((item->>'targetValue')::numeric, 1),
         coalesce((item->>'currentValue')::numeric, 0), nullif(item->>'unit', ''),
         coalesce(item->>'status', 'active'), (item->>'dueDate')::date,
         ordinality::integer - 1, null,
         jsonb_build_object(
           'template', item->'template',
           'linkedHabitIds', coalesce(item->'linkedHabitIds',
             case when item ? 'linkedHabitId' then jsonb_build_array((item->>'linkedHabitId')::bigint) else '[]'::jsonb end),
           'trackingStart', item->'trackingStart',
           'books', coalesce(item->'books', '[]'::jsonb),
           'fitnessEntries', coalesce(item->'fitnessEntries', '[]'::jsonb),
           'parentAnnualGoalId', item->'parentAnnualGoalId',
           'archived', coalesce((item->>'archived')::boolean, false)
         ), now()
  from jsonb_array_elements(coalesce(payload->'goals', '[]'::jsonb))
       with ordinality as goal_items(item, ordinality)
  on conflict (user_id, id) do update set
    title = excluded.title,
    category_id = excluded.category_id,
    period = excluded.period,
    period_key = excluded.period_key,
    measurement = excluded.measurement,
    target_value = excluded.target_value,
    current_value = excluded.current_value,
    unit = excluded.unit,
    status = excluded.status,
    due_date = excluded.due_date,
    position = excluded.position,
    linked_habit_id = excluded.linked_habit_id,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;

  -- Category deletion is last because habits reference categories.
  if baseline is not null then
    delete from categories c
    where c.user_id = current_user_id
      and c.id in (
        select item->>'id'
        from jsonb_array_elements(coalesce(baseline->'categories', '[]'::jsonb)) item
      )
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(payload->'categories', '[]'::jsonb)) item
        where item->>'id' = c.id
      );
  end if;

  update tracker_state_versions
  set revision = revision + 1, updated_at = now()
  where user_id = current_user_id
  returning revision into current_revision;

  return current_revision;
end;
$$;

revoke all on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) from public;
grant execute on function public.apply_tracker_state_changes(jsonb, jsonb, bigint) to authenticated;
