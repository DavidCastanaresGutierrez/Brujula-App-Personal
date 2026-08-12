do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('categories', 'Users manage their categories'),
      ('habits', 'Users manage their habits'),
      ('habit_completions', 'Users manage their completions'),
      ('motivational_quotes', 'Users manage their motivational quotes'),
      ('goals', 'Users manage their goals'),
      ('tracker_state_versions', 'Users manage their tracker revision')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', target.policy_name, target.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      target.policy_name,
      target.table_name
    );
  end loop;
end
$$;

create index if not exists habits_user_id_category_id_idx
  on public.habits (user_id, category_id);
