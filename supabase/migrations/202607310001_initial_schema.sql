create table public.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  label text not null check (char_length(label) between 1 and 80),
  icon text not null default '●',
  color text not null,
  position integer not null default 0,
  primary key (user_id, id)
);

create table public.habits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null,
  category_id text not null,
  kind text not null check (kind in ('daily', 'weekly')),
  name text not null check (char_length(name) between 1 and 120),
  goal integer not null check (goal > 0),
  color text not null,
  position integer not null default 0,
  archived boolean not null default false,
  every_day boolean not null default false,
  weekdays_only boolean not null default false,
  celebrated_streak_30 text,
  primary key (user_id, id),
  foreign key (user_id, category_id)
    references public.categories(user_id, id)
    on update cascade
);

create table public.habit_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id bigint not null,
  period_key text not null check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  value integer not null check (value between 1 and 31),
  primary key (user_id, habit_id, period_key, value),
  foreign key (user_id, habit_id)
    references public.habits(user_id, id)
    on delete cascade
);

create index habit_completions_user_period_idx
  on public.habit_completions(user_id, period_key);

alter table public.categories enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

create policy "Users manage their categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their completions" on public.habit_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.replace_tracker_state(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  delete from habit_completions where user_id = current_user_id;
  delete from habits where user_id = current_user_id;
  delete from categories where user_id = current_user_id;

  insert into categories (user_id, id, label, icon, color, position)
  select current_user_id,
         item->>'id',
         item->>'label',
         coalesce(item->>'icon', '●'),
         item->>'color',
         ordinality::integer - 1
  from jsonb_array_elements(coalesce(payload->'categories', '[]'::jsonb))
       with ordinality as category_items(item, ordinality);

  insert into habits (
    user_id, id, category_id, kind, name, goal, color, position,
    archived, every_day, weekdays_only, celebrated_streak_30
  )
  select current_user_id,
         (item->>'id')::bigint,
         item->>'category',
         habit_kind,
         item->>'name',
         (item->>'goal')::integer,
         item->>'color',
         ordinality::integer - 1,
         coalesce((item->>'archived')::boolean, false),
         case when habit_kind = 'daily'
              then coalesce((item->>'everyDay')::boolean, false)
              else false end,
         case when habit_kind = 'daily'
              then coalesce((item->>'weekdaysOnly')::boolean, false)
              else false end,
         nullif(item->>'celebratedStreak30', '')
  from (
    select item, ordinality, 'daily'::text as habit_kind
    from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb))
         with ordinality as daily_items(item, ordinality)
    union all
    select item, ordinality, 'weekly'::text as habit_kind
    from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb))
         with ordinality as weekly_items(item, ordinality)
  ) all_habits;

  insert into habit_completions (user_id, habit_id, period_key, value)
  select current_user_id,
         (habit->>'id')::bigint,
         history_entry.key,
         completion.value::integer
  from (
    select item as habit
    from jsonb_array_elements(coalesce(payload->'daily', '[]'::jsonb)) item
    union all
    select item as habit
    from jsonb_array_elements(coalesce(payload->'weekly', '[]'::jsonb)) item
  ) all_habits
  cross join lateral jsonb_each(coalesce(habit->'history', '{}'::jsonb)) history_entry
  cross join lateral jsonb_array_elements_text(history_entry.value) completion
  on conflict do nothing;
end;
$$;

revoke all on function public.replace_tracker_state(jsonb) from public;
grant execute on function public.replace_tracker_state(jsonb) to authenticated;
