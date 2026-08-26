import {
  calendarWeekForDate,
  calculateDailyScore,
  calculateWeeklyGoalBonus,
  habitScheduledOnDate,
  isoDate,
  linkedGoalProgress,
  longestHabitStreak,
  monthCalendarDateWeeks,
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
  const evaluatedHabitProgress = daily.map((habit) => monthlyHabitProgressThrough(habit, year, month, evaluatedThrough));
  const totalChecks = evaluatedHabitProgress.reduce((sum, progress) => sum + progress.completed, 0);
  const totalGoal = evaluatedHabitProgress.reduce((sum, progress) => sum + progress.eligible, 0);
  const scoreFromPercent = (percent: number) => Math.min(10, Math.max(0, percent / 10));
  const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dailyScoreForDate = (value: Date) => calculateDailyScore(value, daily, weekly, categories);
  const evaluatedDailyScores = Array.from({ length: evaluatedThrough }, (_, index) => (
    dailyScoreForDate(new Date(year, month, index + 1, 12))
  )).filter((score) => score.scheduled > 0);
  const monthScore = evaluatedDailyScores.length
    ? evaluatedDailyScores.reduce((sum, score) => sum + score.finalScore, 0) / evaluatedDailyScores.length
    : 0;
  const referenceDay = isCurrentMonth ? today.getDate() : days;
  const referenceDate = new Date(year, month, referenceDay, 12);
  const referenceWeek = calendarWeekForDate(referenceDate);
  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const weekHasStarted = referenceWeek.start <= todayKey;
  const evaluatedWeekEndKey = referenceWeek.end < todayKey ? referenceWeek.end : todayKey;
  const displayedWeekEndKey = weekHasStarted ? evaluatedWeekEndKey : referenceWeek.end;
  const weekCursor = new Date(`${referenceWeek.start}T00:00:00Z`);
  const weekLimit = new Date(`${evaluatedWeekEndKey}T00:00:00Z`);
  const weekDates: Date[] = [];
  while (weekHasStarted && weekCursor <= weekLimit) {
    weekDates.push(new Date(
      weekCursor.getUTCFullYear(),
      weekCursor.getUTCMonth(),
      weekCursor.getUTCDate(),
      12,
    ));
    weekCursor.setUTCDate(weekCursor.getUTCDate() + 1);
  }
  const evaluatedWeekScores = weekDates
    .map(dailyScoreForDate)
    .filter((score) => score.scheduled > 0);
  const adjustedWeekBaseScore = evaluatedWeekScores.length
    ? evaluatedWeekScores.reduce((sum, score) => sum + score.finalScore, 0) / evaluatedWeekScores.length
    : 0;
  const shortMonth = (monthIndex: number) => monthNames[monthIndex].slice(0, 3).toLowerCase();
  const formatShortDate = (dateKey: string) => {
    const [, dateMonth, dateDay] = dateKey.split("-").map(Number);
    return `${dateDay} ${shortMonth(dateMonth - 1)}`;
  };
  const weekRange = `${formatShortDate(referenceWeek.start)}–${formatShortDate(displayedWeekEndKey)}`;
  const weekStart = Number(referenceWeek.start.slice(-2));
  const evaluatedWeekEnd = Number(displayedWeekEndKey.slice(-2));
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
  const topHabitPercent = ranked[0] ? Math.round(habitCompletion(ranked[0]) * 100) : 0;
  const streakRanked = [...activeDaily].sort((a, b) => longestHabitStreak(b) - longestHabitStreak(a));
  const rankingItems = rankingView === "best" ? ranked : rankingView === "watch" ? [...ranked].reverse() : streakRanked;
  const longestVisibleStreak = Math.max(1, ...streakRanked.slice(0, 5).map(longestHabitStreak));
  const monthWeeks = monthCalendarWeeks(year, month);
  const currentMonthWeek = isCurrentMonth ? monthWeeks.findIndex((week) => week.includes(today.getDate())) + 1 : 0;
  const chartWeeks = monthCalendarDateWeeks(year, month);
  const weeklyProgress = chartWeeks.map((weekDates) => {
    const startKey = weekDates[0];
    const endKey = weekDates.at(-1)!;
    const projected = startKey > todayKey;
    let accumulatedScore = 0;
    let evaluatedDays = 0;

    weekDates.filter((dateKey) => dateKey <= todayKey).forEach((dateKey) => {
      const [dateYear, dateMonth, day] = dateKey.split("-").map(Number);
      const dailyBreakdown = dailyScoreForDate(new Date(dateYear, dateMonth - 1, day, 12));
      if (!dailyBreakdown.scheduled) return;
      accumulatedScore += dailyBreakdown.baseScore * 10;
      evaluatedDays += 1;
    });

    const [, startMonth, startDay] = startKey.split("-").map(Number);
    const [, endMonth, endDay] = endKey.split("-").map(Number);
    const range = startMonth === endMonth
      ? `${startDay}–${endDay} ${shortMonth(startMonth - 1)}`
      : `${startDay} ${shortMonth(startMonth - 1)}–${endDay} ${shortMonth(endMonth - 1)}`;

    return { value: projected ? null : evaluatedDays ? Math.round(accumulatedScore / evaluatedDays) : 0, projected, range };
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
    weekRange,
    weeklyGoalBonus: weeklyGoalResult.bonus,
    weekScore: weeklyGoalResult.finalScore,
    monthScore,
    habitCompletion,
    ranked,
    topHabitPercent,
    rankingItems,
    longestVisibleStreak,
    monthWeeks,
    currentMonthWeek,
    weeklyProgress,
  };
}
