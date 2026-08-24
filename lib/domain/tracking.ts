export type GoalPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type TrackedHabit = {
  id?: number;
  goal: number;
  archived?: boolean;
  archivedAt?: string;
  category?: string;
  everyDay?: boolean;
  weekdaysOnly?: boolean;
  schedule?: HabitSchedule;
  history?: Record<string, number[]>;
  skips?: Record<string, number[]>;
};

export type HabitSchedule = {
  mode?: "selectedWeekdays" | "interval";
  weekdays?: number[];
  intervalDays?: number;
  startDate?: string;
  activeFrom?: string;
  activeUntil?: string;
  pausedFrom?: string;
  pausedUntil?: string;
};

export type ScoreCategory = { id: string; priority?: boolean };
export type CategoryScore = { categoryId: string; completed: number; scheduled: number; percent: number; weight: number };

export type LinkedGoal = {
  period: GoalPeriod;
  periodKey: string;
  dueDate: string;
  currentValue: number;
  linkedHabitId?: number;
  linkedHabitIds?: number[];
};

export type DailyScoreBreakdown = {
  baseScore: number;
  bonus: number;
  finalScore: number;
  completed: number;
  scheduled: number;
  eligibleWeeklyDoneToday: number;
};

export function habitAppliesOnDate(habit: TrackedHabit, dateKey: string) {
  if (!habit.archived) return true;
  return Boolean(habit.archivedAt && dateKey < habit.archivedAt);
}

export function isHabitVisibleInArchive(habit: TrackedHabit, today: Date) {
  if (!habit.archived) return false;
  if (!habit.archivedAt) return true;
  const archived = new Date(`${habit.archivedAt}T12:00:00`);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.floor((current.getTime() - archived.getTime()) / 86_400_000) < 7;
}

export type CalendarWeek = {
  start: string;
  end: string;
};

export function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

export function localDateKey(value: Date = new Date()) {
  return isoDate(value.getFullYear(), value.getMonth(), value.getDate());
}

export function calendarWeekForDate(value: Date): CalendarWeek {
  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();
  const mondayOffset = (value.getDay() + 6) % 7;
  const monday = new Date(Date.UTC(year, month, day - mondayOffset));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export function isWeekday(year: number, monthIndex: number, day: number) {
  const weekday = new Date(year, monthIndex, day).getDay();
  return weekday >= 1 && weekday <= 5;
}

function dateKeyToUtcDays(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function habitScheduledOnDate(habit: TrackedHabit, dateKey: string) {
  if (!habitAppliesOnDate(habit, dateKey)) return false;
  const schedule = habit.schedule;
  if (schedule?.activeFrom && dateKey < schedule.activeFrom) return false;
  if (schedule?.activeUntil && dateKey > schedule.activeUntil) return false;
  if (schedule?.pausedFrom && schedule?.pausedUntil && dateKey >= schedule.pausedFrom && dateKey <= schedule.pausedUntil) return false;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (schedule?.mode === "selectedWeekdays") {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return (schedule.weekdays ?? []).includes(weekday);
  }
  if (schedule?.mode === "interval") {
    const interval = Math.max(1, schedule.intervalDays ?? 1);
    const start = schedule.startDate ?? schedule.activeFrom;
    return Boolean(start && dateKey >= start && (dateKeyToUtcDays(dateKey) - dateKeyToUtcDays(start)) % interval === 0);
  }
  if (habit.weekdaysOnly) return isWeekday(year, month - 1, day);
  return true;
}

export function scheduledDaysInMonth(habit: TrackedHabit, year: number, monthIndex: number, throughDay?: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const limit = Math.min(throughDay ?? monthDays, monthDays);
  let count = 0;
  for (let day = 1; day <= limit; day += 1) {
    if (habitScheduledOnDate(habit, isoDate(year, monthIndex, day))) count += 1;
  }
  return count;
}

export function monthlyHabitProgressThrough(habit: TrackedHabit, year: number, monthIndex: number, throughDay: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const through = Math.max(0, Math.min(throughDay, monthDays));
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const scheduled = habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly
    ? scheduledDaysInMonth(habit, year, monthIndex, through)
    : Math.min(habit.goal, Math.ceil(habit.goal * through / Math.max(1, monthDays)));
  const skippedDays = (habit.skips?.[monthKey] ?? []).filter((day) => day <= through);
  const skipped = skippedDays.length;
  const eligible = Math.max(0, scheduled - skipped);
  const completed = (habit.history?.[monthKey] ?? []).filter((day) => (
    day <= through
    && !skippedDays.includes(day)
    && habitScheduledOnDate(habit, isoDate(year, monthIndex, day))
  )).length;
  return {
    completed,
    eligible,
    percent: eligible ? Math.min(100, completed / eligible * 100) : 0,
  };
}

export function weekdaysInMonth(year: number, monthIndex: number, throughDay?: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const limit = Math.min(throughDay ?? monthDays, monthDays);
  let count = 0;
  for (let day = 1; day <= limit; day += 1) {
    if (isWeekday(year, monthIndex, day)) count += 1;
  }
  return count;
}

export function monthCalendarWeeks(year: number, monthIndex: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const weeks: number[][] = [];
  let start = 1;
  while (start <= monthDays) {
    const weekday = new Date(year, monthIndex, start).getDay();
    const daysUntilSunday = (7 - weekday) % 7;
    const end = Math.min(monthDays, start + daysUntilSunday);
    weeks.push(Array.from({ length: end - start + 1 }, (_, index) => start + index));
    start = end + 1;
  }
  return weeks;
}

export function weekOfMonth(year: number, monthIndex: number, day: number) {
  return monthCalendarWeeks(year, monthIndex).findIndex((week) => week.includes(day)) + 1;
}

export function daysForMonthWeek(year: number, monthIndex: number, week: number) {
  return monthCalendarWeeks(year, monthIndex)[week - 1] ?? [];
}

export function isCalendarDayInFuture(year: number, monthIndex: number, day: number, today = new Date()) {
  return isoDate(year, monthIndex, day) > isoDate(today.getFullYear(), today.getMonth(), today.getDate());
}

export function availableDaysForMonthWeek(year: number, monthIndex: number, week: number, today = new Date()) {
  return daysForMonthWeek(year, monthIndex, week).filter((day) => !isCalendarDayInFuture(year, monthIndex, day, today));
}

export function goalPeriodDetails(period: GoalPeriod, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === "daily") return { key: isoDate(year, month, now.getDate()), due: isoDate(year, month, now.getDate()) };
  if (period === "weekly") {
    const week = calendarWeekForDate(now);
    return {
      key: week.start,
      due: week.end,
    };
  }
  if (period === "monthly") {
    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      due: isoDate(year, month, new Date(year, month + 1, 0).getDate()),
    };
  }
  return { key: String(year), due: `${year}-12-31` };
}

export function weeklyGoalIncludesDate(periodKey: string, dueDate: string, date: string) {
  return periodKey <= date && date <= dueDate;
}

export function toggleCompletionForDay(checks: number[], day: number) {
  return checks.includes(day) ? checks.filter((item) => item !== day) : [...checks, day].sort((a, b) => a - b);
}

export function linkedGoalProgress(goal: LinkedGoal, habits: TrackedHabit[]) {
  const linkedIds = new Set([...(goal.linkedHabitIds ?? []), ...(goal.linkedHabitId ? [goal.linkedHabitId] : [])]);
  if (!linkedIds.size) return goal.currentValue;
  const linkedHabits = habits.filter((habit) => habit.id !== undefined && linkedIds.has(habit.id));
  if (!linkedHabits.length) return goal.currentValue;

  return linkedHabits.reduce((count, habit) => count + Object.entries(habit.history ?? {}).reduce((habitCount, [monthKey, values]) => (
    habitCount + values.filter((value) => {
      const date = `${monthKey}-${String(value).padStart(2, "0")}`;
      if (goal.period === "daily") return date === goal.periodKey;
      if (goal.period === "weekly") return date >= goal.periodKey && date <= goal.dueDate;
      if (goal.period === "monthly") return monthKey === goal.periodKey;
      return monthKey.startsWith(`${goal.periodKey}-`);
    }).length
  ), 0), 0);
}

export function calculateWeightedHabitDays(
  habits: TrackedHabit[],
  habitIds: number[],
  trackingStart: string | undefined,
  through: Date,
) {
  const selected = habits.filter((habit) => habit.id !== undefined && habitIds.includes(habit.id));
  if (!selected.length) return 0;

  const year = through.getFullYear();
  const start = trackingStart ? new Date(`${trackingStart}T12:00:00`) : through;
  const firstMonth = start.getFullYear() === year ? start.getMonth() : 0;
  let completedWeight = 0;
  for (let month = firstMonth; month <= through.getMonth(); month += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthDays = new Date(year, month + 1, 0).getDate();
    const lastDay = month === through.getMonth() ? through.getDate() : monthDays;
    const firstDay = start.getFullYear() === year && month === start.getMonth() ? start.getDate() : 1;
    for (let day = firstDay; day <= lastDay; day += 1) {
      const completed = selected.filter((habit) => (habit.history?.[key] ?? []).includes(day)).length;
      completedWeight += completed / selected.length;
    }
  }
  return Math.round(completedWeight * 100) / 100;
}

export function calculateDailyScore(
  value: Date,
  dailyHabits: TrackedHabit[],
  weeklyHabits: TrackedHabit[],
  categories: ScoreCategory[] = [],
): DailyScoreBreakdown {
  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const dateKey = isoDate(year, month, day);
  const activeDaily = dailyHabits.filter((habit) => habitScheduledOnDate(habit, dateKey));
  const activeWeekly = weeklyHabits.filter((habit) => habitAppliesOnDate(habit, dateKey));
  const scheduled = activeDaily.filter((habit) => !(habit.skips?.[monthKey] ?? []).includes(day));
  const completed = scheduled.filter((habit) => (habit.history?.[monthKey] ?? []).includes(day)).length;
  const categoryScores = calculateCategoryScores(value, scheduled, categories);
  const weightedScore = categoryScores.reduce((sum, category) => sum + category.percent / 10 * category.weight, 0);
  const totalWeight = categoryScores.reduce((sum, category) => sum + category.weight, 0);
  const baseScore = totalWeight ? weightedScore / totalWeight : 0;
  const weekDays = daysForMonthWeek(year, month, weekOfMonth(year, month, day));
  const totalWeeklyTarget = activeWeekly.reduce((sum, habit) => sum + Math.min(weekDays.length, Math.max(1, habit.goal)), 0);
  const eligibleWeeklyDoneToday = activeWeekly.reduce((sum, habit) => {
    const history = habit.history?.[monthKey] ?? [];
    if (!history.includes(day)) return sum;
    const checksThroughToday = history.filter((checkedDay) => weekDays.includes(checkedDay) && checkedDay <= day).length;
    return sum + (checksThroughToday <= Math.min(weekDays.length, habit.goal) ? 1 : 0);
  }, 0);
  const contribution = totalWeeklyTarget ? Math.min(1, eligibleWeeklyDoneToday / totalWeeklyTarget) : 0;
  const bonus = (10 - baseScore) * 0.2 * contribution;
  return {
    baseScore,
    bonus,
    finalScore: Math.min(10, baseScore + bonus),
    completed,
    scheduled: scheduled.length,
    eligibleWeeklyDoneToday,
  };
}

export function calculateCategoryScores(value: Date, habits: TrackedHabit[], categories: ScoreCategory[]): CategoryScore[] {
  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const grouped = new Map<string, TrackedHabit[]>();
  habits.filter((habit) => !(habit.skips?.[monthKey] ?? []).includes(day)).forEach((habit, index) => {
    const key = habit.category ?? `__uncategorized-${index}`;
    grouped.set(key, [...(grouped.get(key) ?? []), habit]);
  });
  return [...grouped.entries()].map(([categoryId, items]) => {
    const completed = items.filter((habit) => (habit.history?.[monthKey] ?? []).includes(day)).length;
    return {
      categoryId,
      completed,
      scheduled: items.length,
      percent: completed / items.length * 100,
      weight: categoryById.get(categoryId)?.priority ? 2 : 1,
    };
  });
}

export function calculateWeeklyGoalBonus(baseScore: number, goals: Array<{ status: string; currentValue: number; targetValue: number }>) {
  const earned = goals.length > 0 && goals.every((goal) => goal.status === "completed" || goal.currentValue >= goal.targetValue);
  const bonus = earned ? (10 - baseScore) * 0.1 : 0;
  return { earned, bonus, finalScore: Math.min(10, baseScore + bonus) };
}

export function calculateProportionalGoalBonus(baseScore: number, goals: Array<{ status: string; currentValue: number; targetValue: number }>) {
  const completed = goals.filter((goal) => goal.status === "completed" || goal.currentValue >= goal.targetValue).length;
  const completionRate = goals.length ? completed / goals.length : 0;
  const bonus = (10 - baseScore) * 0.1 * completionRate;
  return { completed, total: goals.length, completionRate, bonus, finalScore: Math.min(10, baseScore + bonus) };
}
