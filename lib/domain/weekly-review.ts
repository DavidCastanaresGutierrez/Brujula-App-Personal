import { calculateDailyScore, habitScheduledOnDate, isoDate, weeklyGoalIncludesDate, type ScoreCategory, type TrackedHabit } from "./tracking";

export type WeeklyReview = {
  weekStart: string;
  priorities: string[];
  adjustment: string;
  reflection: string;
  updatedAt: string;
};

export type WeeklyCategorySummary = { categoryId: string; percent: number; completed: number; scheduled: number };

export function weekBounds(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  const offset = (date.getDay() + 6) % 7;
  const start = new Date(date); start.setDate(date.getDate() - offset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start, end, key: isoDate(start.getFullYear(), start.getMonth(), start.getDate()) };
}

export function previousWeekBounds(value: Date) {
  const current = weekBounds(value);
  const date = new Date(current.start); date.setDate(date.getDate() - 7);
  return weekBounds(date);
}

export function shiftWeekBounds(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + amount * 7);
  return weekBounds(date);
}

export function summarizeWeek(
  start: Date,
  daily: TrackedHabit[],
  weekly: TrackedHabit[],
  categories: ScoreCategory[],
) {
  const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  const dayScores = dates.map((date) => calculateDailyScore(date, daily, weekly, categories));
  const categoryTotals = new Map<string, WeeklyCategorySummary>();
  dates.forEach((date) => {
    const dateKey = isoDate(date.getFullYear(), date.getMonth(), date.getDate());
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const day = date.getDate();
    daily.forEach((habit) => {
      const categoryId = habit.category ?? "uncategorized";
      const scheduled = habitScheduledOnDate(habit, dateKey) && !(habit.skips?.[monthKey] ?? []).includes(day);
      if (!scheduled) return;
      const current = categoryTotals.get(categoryId) ?? { categoryId, percent: 0, completed: 0, scheduled: 0 };
      current.scheduled += 1;
      if ((habit.history?.[monthKey] ?? []).includes(day)) current.completed += 1;
      categoryTotals.set(categoryId, current);
    });
  });
  const categorySummaries = [...categoryTotals.values()].map((item) => ({ ...item, percent: item.scheduled ? item.completed / item.scheduled * 100 : 0 }));
  return {
    score: dayScores.reduce((sum, item) => sum + item.finalScore, 0) / Math.max(1, dayScores.length),
    completed: dayScores.reduce((sum, item) => sum + item.completed, 0),
    scheduled: dayScores.reduce((sum, item) => sum + item.scheduled, 0),
    categories: categorySummaries.sort((a, b) => b.percent - a.percent),
  };
}

export function goalsForWeek<T extends { period: string; periodKey: string; dueDate: string }>(goals: T[], start: string) {
  const end = new Date(`${start}T12:00:00`); end.setDate(end.getDate() + 6);
  const endKey = isoDate(end.getFullYear(), end.getMonth(), end.getDate());
  return goals.filter((goal) => goal.period === "weekly" && weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, start) || goal.period === "weekly" && weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, endKey));
}
