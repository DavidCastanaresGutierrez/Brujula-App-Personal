export type GoalPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type TrackedHabit = {
  goal: number;
  archived?: boolean;
  weekdaysOnly?: boolean;
  history?: Record<string, number[]>;
};

export type DailyScoreBreakdown = {
  baseScore: number;
  bonus: number;
  finalScore: number;
  completed: number;
  scheduled: number;
  eligibleWeeklyDoneToday: number;
};

export function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
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

export function goalPeriodDetails(period: GoalPeriod, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === "daily") return { key: isoDate(year, month, now.getDate()), due: isoDate(year, month, now.getDate()) };
  if (period === "weekly") {
    const day = now.getDay() || 7;
    const monday = new Date(year, month, now.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      key: isoDate(monday.getFullYear(), monday.getMonth(), monday.getDate()),
      due: isoDate(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
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
