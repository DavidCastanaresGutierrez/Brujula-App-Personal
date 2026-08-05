export type GoalPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type TrackedHabit = {
  id?: number;
  goal: number;
  archived?: boolean;
  weekdaysOnly?: boolean;
  history?: Record<string, number[]>;
};

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

export type CalendarWeek = {
  start: string;
  end: string;
};

export function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
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

export function weekdaysInMonth(year: number, monthIndex: number, throughDay?: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const limit = Math.min(throughDay ?? monthDays, monthDays);
  let count = 0;
  for (let day = 1; day <= limit; day += 1) {
    if (isWeekday(year, monthIndex, day)) count += 1;
  }
  return count;
}

export function weekOfMonth(day: number) {
  return Math.floor((day - 1) / 7) + 1;
}

export function daysForMonthWeek(year: number, monthIndex: number, week: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const start = (week - 1) * 7 + 1;
  const end = Math.min(start + 6, monthDays);
  return start > monthDays ? [] : Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
): DailyScoreBreakdown {
  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const activeDaily = dailyHabits.filter((habit) => !habit.archived);
  const activeWeekly = weeklyHabits.filter((habit) => !habit.archived);
  const scheduled = activeDaily.filter((habit) => !habit.weekdaysOnly || isWeekday(year, month, day));
  const completed = scheduled.filter((habit) => (habit.history?.[monthKey] ?? []).includes(day)).length;
  const baseScore = scheduled.length ? completed / scheduled.length * 10 : 0;
  const weekDays = daysForMonthWeek(year, month, weekOfMonth(day));
  const totalWeeklyTarget = activeWeekly.reduce((sum, habit) => sum + Math.max(1, habit.goal), 0);
  const eligibleWeeklyDoneToday = activeWeekly.reduce((sum, habit) => {
    const history = habit.history?.[monthKey] ?? [];
    if (!history.includes(day)) return sum;
    const checksThroughToday = history.filter((checkedDay) => weekDays.includes(checkedDay) && checkedDay <= day).length;
    return sum + (checksThroughToday <= habit.goal ? 1 : 0);
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
