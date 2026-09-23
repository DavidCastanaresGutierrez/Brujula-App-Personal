alter table public.body_composition_entries
  add column height_cm numeric check (height_cm > 0 and height_cm <= 300),
  add column imme numeric check (imme >= 0 and imme <= 100),
  add column skeletal_muscle_mass numeric check (skeletal_muscle_mass >= 0 and skeletal_muscle_mass <= 200);
