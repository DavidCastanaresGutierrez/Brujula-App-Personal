alter table public.nutrition_entries
  add column trans_fat numeric not null default 0 check (trans_fat >= 0 and trans_fat <= 100000),
  add column cholesterol numeric not null default 0 check (cholesterol >= 0 and cholesterol <= 100000),
  add column sodium numeric not null default 0 check (sodium >= 0 and sodium <= 100000),
  add column potassium numeric not null default 0 check (potassium >= 0 and potassium <= 100000),
  add column vitamin_a numeric not null default 0 check (vitamin_a >= 0 and vitamin_a <= 100000),
  add column vitamin_c numeric not null default 0 check (vitamin_c >= 0 and vitamin_c <= 100000),
  add column calcium numeric not null default 0 check (calcium >= 0 and calcium <= 100000),
  add column iron numeric not null default 0 check (iron >= 0 and iron <= 100000);

alter table public.frequent_meals
  add column trans_fat numeric not null default 0 check (trans_fat >= 0 and trans_fat <= 100000),
  add column cholesterol numeric not null default 0 check (cholesterol >= 0 and cholesterol <= 100000),
  add column sodium numeric not null default 0 check (sodium >= 0 and sodium <= 100000),
  add column potassium numeric not null default 0 check (potassium >= 0 and potassium <= 100000),
  add column vitamin_a numeric not null default 0 check (vitamin_a >= 0 and vitamin_a <= 100000),
  add column vitamin_c numeric not null default 0 check (vitamin_c >= 0 and vitamin_c <= 100000),
  add column calcium numeric not null default 0 check (calcium >= 0 and calcium <= 100000),
  add column iron numeric not null default 0 check (iron >= 0 and iron <= 100000);

alter table public.nutrition_goals
  add column fiber numeric not null default 30 check (fiber >= 0 and fiber <= 100000),
  add column sugars numeric not null default 50 check (sugars >= 0 and sugars <= 100000),
  add column saturated_fat numeric not null default 20 check (saturated_fat >= 0 and saturated_fat <= 100000),
  add column trans_fat numeric not null default 2.5 check (trans_fat >= 0 and trans_fat <= 100000),
  add column cholesterol numeric not null default 300 check (cholesterol >= 0 and cholesterol <= 100000),
  add column sodium numeric not null default 2000 check (sodium >= 0 and sodium <= 100000),
  add column potassium numeric not null default 3500 check (potassium >= 0 and potassium <= 100000),
  add column vitamin_a numeric not null default 900 check (vitamin_a >= 0 and vitamin_a <= 100000),
  add column vitamin_c numeric not null default 90 check (vitamin_c >= 0 and vitamin_c <= 100000),
  add column calcium numeric not null default 1000 check (calcium >= 0 and calcium <= 100000),
  add column iron numeric not null default 8 check (iron >= 0 and iron <= 100000),
  add column salt numeric not null default 5 check (salt >= 0 and salt <= 100000);

create table public.body_composition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at date not null default current_date check (recorded_at between '1900-01-01' and '9999-12-31'),
  weight numeric not null check (weight > 0 and weight <= 500),
  body_fat numeric not null check (body_fat >= 0 and body_fat <= 100),
  muscle numeric not null check (muscle >= 0 and muscle <= 200),
  fat_mass numeric check (fat_mass >= 0 and fat_mass <= 300),
  body_water numeric check (body_water >= 0 and body_water <= 300),
  bmi numeric check (bmi >= 0 and bmi <= 100),
  basal_metabolic_rate numeric check (basal_metabolic_rate >= 0 and basal_metabolic_rate <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index body_composition_entries_user_date_idx on public.body_composition_entries(user_id, recorded_at);
alter table public.body_composition_entries enable row level security;
revoke all on public.body_composition_entries from anon;
grant select, insert, update, delete on public.body_composition_entries to authenticated;
create policy body_composition_owner on public.body_composition_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger body_composition_updated_at before update on public.body_composition_entries
  for each row execute function public.nutrition_set_updated_at();
