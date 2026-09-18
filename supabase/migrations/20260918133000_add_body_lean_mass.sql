alter table public.body_composition_entries
  add column lean_mass numeric check (lean_mass >= 0 and lean_mass <= 500);
