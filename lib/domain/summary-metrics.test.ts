import { describe, expect, it } from "vitest";
import { buildSummaryMetrics } from "./summary-metrics";
import type { Category, Habit } from "./tracker-state";

const categories: Category[] = [{ id: "health", label: "Salud", icon: "♡", color: "#39c6a4" }];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function metrics(daily: Habit[], overrides: Partial<Parameters<typeof buildSummaryMetrics>[0]> = {}) {
  return buildSummaryMetrics({
    daily,
    weekly: [],
    categories,
    goals: [],
    rankingView: "best",
    year: 2026,
    month: 7,
    days: 31,
    isPastMonth: false,
    isCurrentMonth: true,
    today: new Date(2026, 7, 1, 12),
    monthNames,
    ...overrides,
  });
}

describe("summary metrics", () => {
  it("calculates current-day and monthly scores from eligible habits", () => {
    const result = metrics([
      { id: 1, name: "Caminar", goal: 31, color: "#39c6a4", category: "health", everyDay: true, history: { "2026-08": [1] }, checks: [] },
      { id: 2, name: "Meditar", goal: 31, color: "#8b7cf6", category: "health", everyDay: true, history: {}, checks: [] },
    ]);
    expect(result.dayProgress).toBe(50);
    expect(result.dayScore).toBe(5);
    expect(result.monthScore).toBe(5);
    expect([result.totalChecks, result.totalGoal]).toEqual([1, 2]);
  });

  it("orders habits by completion and by longest streak", () => {
    const habits: Habit[] = [
      { id: 1, name: "Irregular", goal: 31, color: "#39c6a4", everyDay: true, history: { "2026-08": [1] }, checks: [] },
      { id: 2, name: "Constante", goal: 31, color: "#8b7cf6", everyDay: true, history: { "2026-08": [1, 2] }, checks: [] },
    ];
    expect(metrics(habits, { today: new Date(2026, 7, 3, 12), rankingView: "streak" }).rankingItems[0].name).toBe("Constante");
    expect(metrics(habits, { today: new Date(2026, 7, 3, 12), rankingView: "watch" }).rankingItems[0].name).toBe("Irregular");
  });

  it("repeats a shared seven-day week in adjacent month views", () => {
    const habit: Habit = {
      id: 1,
      name: "Caminar",
      goal: 31,
      color: "#39c6a4",
      category: "health",
      everyDay: true,
      history: { "2026-08": [31], "2026-09": [1, 2] },
      checks: [],
    };
    const august = metrics([habit], {
      isCurrentMonth: false,
      isPastMonth: true,
      today: new Date(2026, 8, 10, 12),
    });
    const september = metrics([habit], {
      year: 2026,
      month: 8,
      days: 30,
      isCurrentMonth: true,
      isPastMonth: false,
      today: new Date(2026, 8, 10, 12),
    });

    expect(august.weeklyProgress.at(-1)).toEqual(september.weeklyProgress[0]);
    expect(august.weeklyProgress.at(-1)?.range).toBe("31 ago–6 sep");
  });

  it("marks weeks after today as projected", () => {
    const result = metrics([], { today: new Date(2026, 7, 5, 12) });
    expect(result.weeklyProgress.some((week) => week.projected)).toBe(true);
    expect(result.weeklyProgress.filter((week) => week.projected).every((week) => week.value === null)).toBe(true);
  });
});
