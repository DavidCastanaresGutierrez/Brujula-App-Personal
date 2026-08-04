-- Weekly completions used to store the week number (1..5). Weekly habits now
-- store the actual day of the month so several completions can belong to a week.
update public.habit_completions as completion
set value = ((completion.value - 1) * 7) + 1
from public.habits as habit
where habit.user_id = completion.user_id
  and habit.id = completion.habit_id
  and habit.kind = 'weekly'
  and completion.value between 1 and 5;

-- Every existing weekly habit was binary: once per week. Reset the old monthly
-- week target before the column starts representing repetitions per week.
update public.habits
set goal = 1
where kind = 'weekly';

comment on column public.habits.goal is
  'Daily: monthly target. Weekly: target number of completions per week.';
