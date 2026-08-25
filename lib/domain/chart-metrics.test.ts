import { describe, expect, it } from "vitest";
import { buildChartMetrics } from "./chart-metrics";
import type { Category, Habit } from "./tracker-state";

const categories: Category[] = [
  { id: "health", label: "Salud", icon: "♡", color: "#39c6a4" },
  { id: "growth", label: "Crecimiento", icon: "◇", color: "#8b7cf6" },
];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const resolveCategory = (habit: Habit) => habit.category ?? "health";

describe("chart metrics", () => {
  it("builds cumulative monthly progress without future days", () => {
    const habit: Habit = {
      id: 1, name: "Caminar", goal: 31, color: "#39c6a4", category: "health", everyDay: true,
      history: { "2026-08": [1, 2] }, checks: [],
    };
    const result = buildChartMetrics({
      habits: [habit], categories, fallbackCategory: categories[0], selectedHabitId: 1,
      selectedCategoryId: "health", period: "monthly", scope: "general", year: 2026, month: 7,
      elapsedDays: 2, isPastMonth: false, isCurrentMonth: true, today: new Date(2026, 7, 2, 12),
      monthNames, resolveCategory,
    });
    expect(result.series[0].data).toEqual([{ label: "1", value: 100 }, { label: "2", value: 100 }]);
  });

  it("creates one series per block when all blocks are selected", () => {
    const habits: Habit[] = categories.map((category, index) => ({
      id: index + 1, name: category.label, goal: 31, color: category.color, category: category.id, checks: [],
    }));
    const result = buildChartMetrics({
      habits, categories, fallbackCategory: categories[0], selectedHabitId: 0,
      selectedCategoryId: "__all__", period: "monthly", scope: "category", year: 2026, month: 7,
      elapsedDays: 1, isPastMonth: false, isCurrentMonth: true, today: new Date(2026, 7, 1, 12),
      monthNames, resolveCategory,
    });
    expect(result.allCategoriesSelected).toBe(true);
    expect(result.series.map((series) => series.name)).toEqual(["Salud", "Crecimiento"]);
  });

  it("does not invent weekly values for a future month", () => {
    const result = buildChartMetrics({
      habits: [], categories, fallbackCategory: categories[0], selectedHabitId: 0,
      selectedCategoryId: "health", period: "weekly", scope: "general", year: 2026, month: 8,
      elapsedDays: 0, isPastMonth: false, isCurrentMonth: false, today: new Date(2026, 7, 25, 12),
      monthNames, resolveCategory,
    });
    expect(result.series[0].data).toEqual([]);
  });
});
