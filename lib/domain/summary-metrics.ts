import {
  calculateDailyScore,
  calculateWeeklyGoalBonus,
  habitScheduledOnDate,
  isoDate,
  linkedGoalProgress,
  longestHabitStreak,
  monthCalendarWeeks,
  monthlyHabitProgressThrough,
  weeklyGoalIncludesDate,
} from "./tracking";
import type { Category, Goal, Habit, WeeklyHabit } from "./tracker-state";

export type RankingView = "best" | "watch" | "streak";

type Options = {
  daily: Habit[];
  weekly: WeeklyHabit[];
  categories: Category[];
  goals: Goal[];
  rankingView: RankingView;
  year: number;
  month: number;
  days: number;
  isPastMonth: boolean;
  isCurrentMonth: boolean;
  today: Date;
  monthNames: string[];
};

export function buildSummaryMetrics({
  daily, weekly, categories, goals, rankingView, year, month, days,
  isPastMonth, isCurrentMonth, today, monthNames,
}: Options) {
  const activeDaily = daily.filter((habit) => !habit.archived);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const checksFor = (habit: Habit) => habit.history?.[monthKey] ?? [];
  const skipsFor = (habit: Habit) => habit.skips?.[monthKey] ?? [];
  const evaluatedThrough = isCurrentMonth ? today.getDate() : isPastMonth ? days : 0;
  const evaluatedHabitProgress = activeDaily.map((habit) => monthlyHabitProgressThrough(habit, year, month, evaluatedThrough));
  const totalChecks = evaluatedHabitProgress.reduce((sum, progress) => sum + progress.completed, 0);
  const totalGoal = evaluatedHabitProgress.reduce((sum, progress) => sum + progress.eligible, 0);
  const globalProgress = totalGoal ? totalChecks / totalGoal * 100 : 0;
  const scoreFromPercent = (percent: number) => Math.min(10, Math.max(0, percent / 10));
  const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dailyScoreForDate = (value: Date) => calculateDailyScore(value, daily, weekly, categories);
  const referenceDay = isCurrentMonth ? today.getDate() : days;
  const referenceDate = new Date(year, month, referenceDay);
  const mondayOffset = (referenceDate.getDay() + 6) % 7;
  const weekStart = Math.max(1, referenceDay - mondayOffset);
  const weekEnd = Math.min(days, weekStart + 6);
  const evaluatedWeekEnd = isCurrentMonth ? Math.min(weekEnd, today.getDate()) : weekEnd;
  const habitsScheduledForDay = (day: number) => {
    const dateKey = isoDate(year, month, day);
    return daily.filter((habit) => habitScheduledOnDate(habit, dateKey) && !skipsFor(habit).includes(day));
  };
  const referenceDayHabits = habitsScheduledForDay(referenceDay);
  const dayChecks = referenceDayHabits.filter((habit) => checksFor(habit).includes(referenceDay)).length;
  const currentDayProgress = referenceDayHabits.length ? dayChecks / referenceDayHabits.length * 100 : 0;
  const pastMonthDailyValues = isPastMonth
    ? Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const scheduled = habitsScheduledForDay(day);
        const completed = scheduled.filter((habit) => checksFor(habit).includes(day)).length;
        return scheduled.length ? completed / scheduled.length * 100 : null;
      }).filter((progress): progress is number => progress !== null)
    : [];
  const pastMonthDailyProgress = pastMonthDailyValues.length
    ? pastMonthDailyValues.reduce((sum, progress) => sum + progress, 0) / pastMonthDailyValues.length
    : 0;
  const dayProgress = isPastMonth ? pastMonthDailyProgress : currentDayProgress;
  const weekDates = Array.from({ length: Math.max(0, evaluatedWeekEnd - weekStart + 1) }, (_, index) => new Date(year, month, weekStart + index));
  const adjustedWeekBaseScore = weekDates.length ? weekDates.reduce((sum, item) => sum + dailyScoreForDate(item).finalScore, 0) / weekDates.length : 0;
  const referenceDateKey = isoDate(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const currentWeeklyGoals = goals
    .filter((goal) => goal.period === "weekly" && weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, referenceDateKey) && goal.status !== "discarded")
    .map((goal) => {
      if (!(goal.linkedHabitIds?.length || goal.linkedHabitId)) return goal;
      const currentValue = linkedGoalProgress(goal, daily);
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    });
  const weeklyGoalResult = calculateWeeklyGoalBonus(adjustedWeekBaseScore, currentWeeklyGoals);
  const currentDayBreakdown = dailyScoreForDate(referenceDate);
  const dayScore = isPastMonth ? scoreFromPercent(dayProgress) : currentDayBreakdown.finalScore;
  const dayScoreTitle = isPastMonth ? "Nota media diaria" : "Nota del día";
  const dayScoreDetail = isPastMonth
    ? `Media de ${pastMonthDailyValues.length} días con hábitos en ${monthNames[month].toLowerCase()}`
    : `${dayChecks} de ${referenceDayHabits.length} hábitos completados${currentDayBreakdown.bonus > 0 ? ` · +${scoreLabel(currentDayBreakdown.bonus)} bonus` : ""}`;
  const habitCompletion = (habit: Habit) => monthlyHabitProgressThrough(habit, year, month, evaluatedThrough).percent / 100;
  const ranked = [...activeDaily].sort((a, b) => habitCompletion(b) - habitCompletion(a));
  const streakRanked = [...activeDaily].sort((a, b) => longestHabitStreak(b) - longestHabitStreak(a));
  const rankingItems = rankingView === "best" ? ranked : rankingView === "watch" ? [...ranked].reverse() : streakRanked;
  const longestVisibleStreak = Math.max(1, ...streakRanked.slice(0, 5).map(longestHabitStreak));
  const monthWeeks = monthCalendarWeeks(year, month);
  const currentMonthWeek = isCurrentMonth ? monthWeeks.findIndex((week) => week.includes(today.getDate())) + 1 : 0;
  const weeklyProgress = monthWeeks.map((weekDays) => {
    const start = weekDays[0];
    const end = weekDays.at(-1)!;
    const projected = !isPastMonth && new Date(year, month, start) > today;
    const evaluatedEnd = projected ? start - 1 : Math.min(end, isCurrentMonth ? today.getDate() : end);
    let completed = 0;
    let possible = 0;
    for (let day = start; day <= evaluatedEnd; day += 1) {
      const scheduled = habitsScheduledForDay(day);
      possible += scheduled.length;
      completed += scheduled.filter((habit) => checksFor(habit).includes(day)).length;
    }
    return { value: projected ? null : possible ? Math.round(completed / possible * 100) : 0, projected, range: `${start}–${end} ${monthNames[month].slice(0, 3).toLowerCase()}` };
  });

  return {
    evaluatedThrough,
    totalChecks,
    totalGoal,
    dayProgress,
    dayScore,
    dayScoreTitle,
    dayScoreDetail,
    weekStart,
    evaluatedWeekEnd,
    weeklyGoalBonus: weeklyGoalResult.bonus,
    weekScore: weeklyGoalResult.finalScore,
    monthScore: scoreFromPercent(globalProgress),
    habitCompletion,
    ranked,
    rankingItems,
    longestVisibleStreak,
    monthWeeks,
    currentMonthWeek,
    weeklyProgress,
  };
}
