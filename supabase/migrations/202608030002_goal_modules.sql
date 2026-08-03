alter table public.goals
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.goals.metadata is
  'Datos específicos de módulos de objetivo: lectura, forma física y vínculos múltiples.';
