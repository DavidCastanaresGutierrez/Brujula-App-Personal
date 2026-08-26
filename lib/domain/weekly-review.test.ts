import { describe, expect, it } from "vitest";
import { goalsForWeek, previousWeekBounds, summarizeWeek, weekBounds } from "./weekly-review";

describe("weekly planning", () => {
  it("uses Monday-to-Sunday weeks across month boundaries", () => {
    expect(weekBounds(new Date(2026, 7, 1, 12)).key).toBe("2026-07-27");
    expect(previousWeekBounds(new Date(2026, 7, 11, 12)).key).toBe("2026-08-03");
  });

  it("summarizes only scheduled, non-skipped habit days", () => {
    const daily = [{ id: 1, goal: 3, category: "health", schedule: { mode: "selectedWeekdays" as const, weekdays: [1, 3, 5] }, history: { "2026-08": [3, 5] }, skips: { "2026-08": [7] } }];
    const summary = summarizeWeek(new Date(2026, 7, 3, 12), daily, [], [{ id: "health" }]);
    expect(summary.categories[0]).toMatchObject({ categoryId: "health", completed: 2, scheduled: 2, percent: 100 });
  });

  it("does not penalize days without scheduled habits", () => {
    const daily = [{
      id: 1,
      goal: 1,
      category: "health",
      schedule: { mode: "selectedWeekdays" as const, weekdays: [1] },
      history: { "2026-08": [3] },
    }];
    const summary = summarizeWeek(new Date(2026, 7, 3, 12), daily, [], [{ id: "health" }]);

    expect(summary.score).toBe(10);
    expect([summary.completed, summary.scheduled]).toEqual([1, 1]);
  });

  it("selects weekly goals that overlap the requested week", () => {
    const goals = [{ period: "weekly", periodKey: "2026-08-03", dueDate: "2026-08-09", title: "Cerrar propuesta" }, { period: "monthly", periodKey: "2026-08", dueDate: "2026-08-31", title: "Mes" }];
    expect(goalsForWeek(goals, "2026-08-03").map((goal) => goal.title)).toEqual(["Cerrar propuesta"]);
  });
});
