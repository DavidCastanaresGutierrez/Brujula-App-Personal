alter table public.nutrition_entries
  add column quantity numeric not null default 1 check (quantity > 0 and quantity <= 100000),
  add column unit text not null default 'unit' check (unit in ('unit','serving','cup','glass','package','g','ml')),
  add column fiber numeric not null default 0 check (fiber >= 0 and fiber <= 100000),
  add column sugars numeric not null default 0 check (sugars >= 0 and sugars <= 100000),
  add column saturated_fat numeric not null default 0 check (saturated_fat >= 0 and saturated_fat <= 100000),
  add column salt numeric not null default 0 check (salt >= 0 and salt <= 100000);

alter table public.frequent_meals
  add column quantity numeric not null default 1 check (quantity > 0 and quantity <= 100000),
  add column unit text not null default 'unit' check (unit in ('unit','serving','cup','glass','package','g','ml')),
  add column fiber numeric not null default 0 check (fiber >= 0 and fiber <= 100000),
  add column sugars numeric not null default 0 check (sugars >= 0 and sugars <= 100000),
  add column saturated_fat numeric not null default 0 check (saturated_fat >= 0 and saturated_fat <= 100000),
  add column salt numeric not null default 0 check (salt >= 0 and salt <= 100000);
