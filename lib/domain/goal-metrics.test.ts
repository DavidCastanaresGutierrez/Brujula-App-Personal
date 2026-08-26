import { describe, expect, it } from "vitest";
import { resolveGoals, visibleGoalsForPeriod } from "./goal-metrics";
import type { Goal, Habit } from "./tracker-state";

const baseGoal: Goal = {
  id: 1,
  title: "Objetivo",
  category: "health",
  period: "yearly",
  periodKey: "2026",
  measurement: "quantity",
  targetValue: 2,
  currentValue: 0,
  status: "active",
  dueDate: "2026-12-31",
};

const completedBook = (book: { status?: string; completedAt?: string }) => book.status === "completed" || Boolean(book.completedAt);

describe("goal metrics", () => {
  it("resolves reading, fitness and linked-habit progress", () => {
    const daily: Habit[] = [{
      id: 10, name: "Entrenar", goal: 31, color: "#fff", checks: [],
      history: { "2026-08": [1, 2] },
    }];
    const goals: Goal[] = [
      { ...baseGoal, id: 1, template: "reading", books: [{ id: 1, title: "Uno", format: "paper", completedAt: "2026-01-01" }] },
      { ...baseGoal, id: 2, template: "fitness", targetValue: 2, linkedHabitIds: [10], trackingStart: "2026-08-01" },
      { ...baseGoal, id: 3, linkedHabitIds: [10] },
    ];

    const result = resolveGoals({ goals, daily, today: new Date(2026, 7, 2, 12), isBookCompleted: completedBook });

    expect(result.map((goal) => [goal.currentValue, goal.status])).toEqual([
      [1, "active"],
      [2, "completed"],
      [2, "completed"],
    ]);
  });

  it("derives annual progress only from active weekly and monthly milestones", () => {
    const goals: Goal[] = [
      baseGoal,
      { ...baseGoal, id: 2, period: "monthly", periodKey: "2026-08", dueDate: "2026-08-31", parentAnnualGoalId: 1, status: "completed" },
      { ...baseGoal, id: 3, period: "weekly", periodKey: "2026-08-24", dueDate: "2026-08-30", parentAnnualGoalId: 1, status: "active" },
      { ...baseGoal, id: 4, period: "monthly", parentAnnualGoalId: 1, status: "discarded" },
    ];

    const [annual] = resolveGoals({ goals, daily: [], today: new Date(2026, 7, 26), isBookCompleted: completedBook });

    expect(annual).toMatchObject({ currentValue: 1, targetValue: 2, unit: "hitos", status: "active" });
  });

  it("keeps current and overdue active weekly goals visible", () => {
    const goals: Goal[] = [
      { ...baseGoal, period: "weekly", periodKey: "2026-08-24", dueDate: "2026-08-30" },
      { ...baseGoal, id: 2, period: "weekly", periodKey: "2026-08-10", dueDate: "2026-08-16" },
      { ...baseGoal, id: 3, period: "weekly", periodKey: "2026-08-10", dueDate: "2026-08-16", status: "completed" },
    ];

    expect(visibleGoalsForPeriod({ goals, period: "weekly", category: "all", todayKey: "2026-08-26" }).map((goal) => goal.id)).toEqual([1, 2]);
  });
});
