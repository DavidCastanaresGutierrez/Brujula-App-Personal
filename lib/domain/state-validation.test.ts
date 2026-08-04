import { describe, expect, it } from "vitest";
import { isValidStateRevision, validateTrackerState } from "./state-validation";

const validState = () => ({
  categories: [{ id: "health", label: "Salud", icon: "♥", color: "#39c6a4" }],
  daily: [{ id: 1, name: "Entrenar", goal: 20, color: "#39c6a4", checks: [], category: "health", history: { "2026-08": [1, 3] } }],
  weekly: [{ id: 2, name: "Compra", goal: 1, color: "#fbbf24", checks: [], category: "health" }],
  motivations: ["La dirección importa más que la velocidad."],
  goals: [{ id: 3, title: "Mejorar forma física", category: "health", period: "yearly", periodKey: "2026", measurement: "quantity", targetValue: 100, currentValue: 2, status: "active", dueDate: "2026-12-31", linkedHabitIds: [1] }],
});

describe("tracker state validation", () => {
  it("accepts a complete valid state", () => {
    expect(validateTrackerState(validState()).success).toBe(true);
  });

  it("rejects duplicate identifiers across daily and weekly habits", () => {
    const state = validState();
    state.weekly[0].id = 1;
    expect(validateTrackerState(state)).toEqual({ success: false, error: "Hay hábitos duplicados" });
  });

  it("rejects invalid calendar dates and non-finite values", () => {
    const state = validState();
    state.goals[0].dueDate = "2026-02-31";
    state.goals[0].targetValue = Number.POSITIVE_INFINITY;
    expect(validateTrackerState(state).success).toBe(false);
  });

  it("rejects references to missing categories or habits", () => {
    const state = validState();
    state.daily[0].category = "missing";
    expect(validateTrackerState(state)).toEqual({ success: false, error: "Un hábito hace referencia a una categoría inexistente" });
  });

  it("rejects duplicate completion days", () => {
    const state = validState();
    state.daily[0].history = { "2026-08": [1, 1] };
    expect(validateTrackerState(state)).toEqual({ success: false, error: "Hay hábitos con datos no válidos" });
  });
});

describe("state revision validation", () => {
  it("accepts non-negative safe integer revisions", () => {
    expect(isValidStateRevision(0)).toBe(true);
    expect(isValidStateRevision(42)).toBe(true);
  });

  it("rejects missing, negative, decimal and unsafe revisions", () => {
    expect(isValidStateRevision(undefined)).toBe(false);
    expect(isValidStateRevision(-1)).toBe(false);
    expect(isValidStateRevision(1.5)).toBe(false);
    expect(isValidStateRevision(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});
