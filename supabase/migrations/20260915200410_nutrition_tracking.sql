-- Nutrition is independent of tracker state and does not add polling.
create table public.nutrition_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories numeric not null check (calories > 0 and calories <= 100000),
  protein numeric not null check (protein > 0 and protein <= 100000),
  carbs numeric not null check (carbs > 0 and carbs <= 100000),
  fat numeric not null check (fat > 0 and fat <= 100000),
  goal_mode text check (goal_mode in ('fat_loss', 'maintenance', 'muscle_gain')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  type text not null check (type in ('breakfast','mid_morning','lunch','snack','dinner','other')),
  calories numeric not null check (calories >= 0 and calories <= 100000),
  protein numeric not null check (protein >= 0 and protein <= 100000),
  carbs numeric not null check (carbs >= 0 and carbs <= 100000),
  fat numeric not null check (fat >= 0 and fat <= 100000),
  date date not null check (date between '1900-01-01' and '9999-12-31'),
  import_key text check (char_length(import_key) <= 100),
  unique (user_id, import_key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.frequent_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  type text not null check (type in ('breakfast','mid_morning','lunch','snack','dinner','other')),
  calories numeric not null check (calories >= 0 and calories <= 100000),
  protein numeric not null check (protein >= 0 and protein <= 100000),
  carbs numeric not null check (carbs >= 0 and carbs <= 100000),
  fat numeric not null check (fat >= 0 and fat <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nutrition_entries_user_date_idx on public.nutrition_entries(user_id, date);
create index frequent_meals_user_name_idx on public.frequent_meals(user_id, name);
create function public.nutrition_set_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.nutrition_set_updated_at() from public, anon, authenticated;
alter table public.nutrition_goals enable row level security;
revoke all on public.nutrition_goals from anon;
grant select, insert, update, delete on public.nutrition_goals to authenticated;
create policy nutrition_owner on public.nutrition_goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger nutrition_updated_at before update on public.nutrition_goals
  for each row execute function public.nutrition_set_updated_at();
alter table public.nutrition_entries enable row level security;
revoke all on public.nutrition_entries from anon;
grant select, insert, update, delete on public.nutrition_entries to authenticated;
create policy nutrition_owner on public.nutrition_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger nutrition_updated_at before update on public.nutrition_entries
  for each row execute function public.nutrition_set_updated_at();
alter table public.frequent_meals enable row level security;
revoke all on public.frequent_meals from anon;
grant select, insert, update, delete on public.frequent_meals to authenticated;
create policy nutrition_owner on public.frequent_meals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger nutrition_updated_at before update on public.frequent_meals
  for each row execute function public.nutrition_set_updated_at();
