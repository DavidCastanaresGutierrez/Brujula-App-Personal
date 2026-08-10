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

  it("accepts explicit missed days and rejects malformed missed-day history", () => {
    const state = validState();
    Object.assign(state.daily[0], { misses: { "2026-08": [2, 4] } });
    expect(validateTrackerState(state).success).toBe(true);

    const malformed = validState();
    Object.assign(malformed.daily[0], { misses: { "2026-08": [2, 2] } });
    expect(validateTrackerState(malformed)).toEqual({ success: false, error: "Hay hábitos con datos no válidos" });
  });

  it("accepts priority blocks and dated archives while preserving legacy data", () => {
    const state = validState();
    Object.assign(state.categories[0], { priority: true });
    Object.assign(state.daily[0], { archived: true, archivedAt: "2026-08-10" });
    expect(validateTrackerState(state).success).toBe(true);
  });

  it("accepts legacy completed books and new reading entries", () => {
    const legacy = validState();
    Object.assign(legacy.goals[0], { template: "reading", books: [{ id: 10, title: "Sapiens", format: "paper", completedAt: "2026-08-01" }] });
    expect(validateTrackerState(legacy).success).toBe(true);

    const current = validState();
    Object.assign(current.goals[0], { template: "reading", books: [{ id: 11, title: "Dune", author: "Frank Herbert", format: "digital", status: "reading", startedAt: "2026-08-10" }] });
    expect(validateTrackerState(current).success).toBe(true);
  });

  it("rejects a completed book without a completion date", () => {
    const state = validState();
    Object.assign(state.goals[0], { template: "reading", books: [{ id: 12, title: "Dune", author: "Frank Herbert", format: "paper", status: "completed" }] });
    expect(validateTrackerState(state).success).toBe(false);
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
