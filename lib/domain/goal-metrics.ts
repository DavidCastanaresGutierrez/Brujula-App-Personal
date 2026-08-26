import type { BookEntry, Goal, Habit, HabitCategory } from "./tracker-state";
import { calculateWeightedHabitDays, linkedGoalProgress, weeklyGoalIncludesDate } from "./tracking";

type ResolveGoalsOptions = {
  goals: Goal[];
  daily: Habit[];
  today: Date;
  isBookCompleted: (book: BookEntry) => boolean;
};

export function resolveGoals({ goals, daily, today, isBookCompleted }: ResolveGoalsOptions) {
  const progressResolved = goals.map((goal) => {
    if (goal.status === "discarded") return goal;
    if (goal.template === "reading") {
      const currentValue = (goal.books ?? []).filter(isBookCompleted).length;
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    }
    if (goal.template === "fitness") {
      const currentValue = calculateWeightedHabitDays(daily, goal.linkedHabitIds ?? [], goal.trackingStart, today);
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    }
    if (!(goal.linkedHabitIds?.length || goal.linkedHabitId)) return goal;
    const currentValue = linkedGoalProgress(goal, daily);
    return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
  });

  return progressResolved.map((goal) => {
    if (goal.period !== "yearly") return goal;
    const milestones = progressResolved.filter((item) => (
      (item.period === "weekly" || item.period === "monthly")
      && item.parentAnnualGoalId === goal.id
      && item.status !== "discarded"
    ));
    if (!milestones.length) return goal;
    const completed = milestones.filter((item) => item.status === "completed").length;
    return {
      ...goal,
      currentValue: completed,
      targetValue: milestones.length,
      unit: "hitos",
      status: completed === milestones.length ? "completed" as const : "active" as const,
    };
  });
}

type VisibleGoalsOptions = {
  goals: Goal[];
  period: "weekly" | "monthly" | "yearly";
  category: HabitCategory | "all";
  todayKey: string;
};

export function visibleGoalsForPeriod({ goals, period, category, todayKey }: VisibleGoalsOptions) {
  return goals.filter((goal) => (
    goal.period === period
    && goal.status !== "discarded"
    && !goal.archived
    && (category === "all" || goal.category === category)
    && (goal.period !== "weekly"
      || weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, todayKey)
      || (goal.status === "active" && goal.dueDate < todayKey))
  ));
}
