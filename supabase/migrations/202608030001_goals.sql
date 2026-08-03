create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null,
  title text not null check (char_length(title) between 1 and 160),
  category_id text not null,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  period_key text not null,
  measurement text not null check (measurement in ('complete', 'quantity')),
  target_value numeric not null default 1 check (target_value > 0),
  current_value numeric not null default 0 check (current_value >= 0),
  unit text,
  status text not null default 'active' check (status in ('active', 'completed', 'discarded')),
  due_date date not null,
  position integer not null default 0,
  linked_habit_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.goals enable row level security;
drop policy if exists "Users manage their goals" on public.goals;
create policy "Users manage their goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists goals_user_period_idx on public.goals(user_id, period, period_key);
