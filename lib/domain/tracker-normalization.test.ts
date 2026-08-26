import { describe, expect, it } from "vitest";
import { inferCategory, normalizeTrackerState, streakContaining } from "./tracker-normalization";
import type { Category, TrackerState } from "./tracker-state";

const defaults: Category[] = [
  { id: "health", label: "Salud", icon: "♥", color: "green" },
  { id: "family", label: "Familia", icon: "⌂", color: "pink" },
];

describe("tracker normalization", () => {
  it("infers the built-in category from Spanish habit names", () => {
    expect(inferCategory("Tiempo con mi hija")).toBe("family");
    expect(inferCategory("Preparar una oferta")).toBe("work");
    expect(inferCategory("Revisar presupuesto")).toBe("finance");
    expect(inferCategory("Leer 20 minutos")).toBe("growth");
    expect(inferCategory("Beber agua")).toBe("health");
  });

  it("fills incomplete state and preserves archived habits with a migration date", () => {
    const state: TrackerState = {
      daily: [{ id: 1, name: "Leer", goal: 1, color: "blue", checks: [], archived: true }],
      weekly: [{ id: 2, name: "Colada", goal: 1, color: "pink", checks: [] }],
      categories: [{ id: "health", label: "", icon: "", color: "" }],
      motivations: ["Sigue", "  "],
    };

    expect(normalizeTrackerState(state, {
      defaultCategories: defaults,
      palette: ["fallback"],
      archiveMigrationDate: "2026-08-26",
    })).toMatchObject({
      daily: [{ category: "growth", archivedAt: "2026-08-26" }],
      weekly: [{ category: "family" }],
      categories: [{ id: "health", label: "Salud", icon: "♥", color: "green", priority: false }],
      motivations: ["Sigue"],
      goals: [],
      weeklyReviews: [],
    });
  });

  it("calculates a streak across month and year boundaries", () => {
    const history = { "2025-12": [31], "2026-01": [1, 2, 4] };
    expect(streakContaining(history, "2026-01-01")).toEqual({ length: 3, start: "2025-12-31" });
    expect(streakContaining(history, "2026-01-03")).toEqual({ length: 0, start: "2026-01-03" });
  });
});
