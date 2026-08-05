import { describe, expect, it } from "vitest";
import { createTrackerBackup, parseTrackerBackup } from "./backup";

const state = { daily: [{ id: 1, name: "Leer", goal: 20, color: "#123456", category: "growth", checks: [] }], weekly: [], categories: [{ id: "growth", label: "Crecimiento", icon: "●", color: "#123456" }], motivations: ["Sigue"], goals: [] };

describe("copias de Brújula", () => {
  it("crea y valida una copia versionada", () => {
    const backup = createTrackerBackup(state, new Date("2026-08-05T10:00:00Z"));
    const result = parseTrackerBackup(JSON.stringify(backup));
    expect(result.success).toBe(true);
    if (result.success) expect(result.preview).toMatchObject({ daily: 1, weekly: 0, goals: 0, categories: 1, motivations: 1 });
  });
  it("rechaza JSON arbitrario y relaciones rotas", () => {
    expect(parseTrackerBackup("{}").success).toBe(false);
    const backup = createTrackerBackup({ ...state, daily: [{ ...state.daily[0], category: "missing" }] });
    expect(parseTrackerBackup(JSON.stringify(backup)).success).toBe(false);
  });
  it("rechaza versiones futuras", () => {
    expect(parseTrackerBackup(JSON.stringify({ ...createTrackerBackup(state), version: 2 })).success).toBe(false);
  });
});
