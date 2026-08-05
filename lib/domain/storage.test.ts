import { describe, expect, it } from "vitest";
import { parseStoredStringSet, parseStoredTrackerState } from "./storage";

const validState = {
  daily: [{ id: 1, name: "Leer", goal: 20, color: "#123456", category: "growth", checks: [] }],
  weekly: [],
  categories: [{ id: "growth", label: "Crecimiento", icon: "●", color: "#123456" }],
  motivations: ["Sigue"],
  goals: [],
};

describe("caché local de Brújula", () => {
  it("recupera un estado local válido", () => {
    expect(parseStoredTrackerState(JSON.stringify(validState))).toEqual(validState);
  });

  it("ignora JSON truncado o estados con relaciones rotas", () => {
    expect(parseStoredTrackerState('{"daily":')).toBeNull();
    expect(parseStoredTrackerState(JSON.stringify({ ...validState, daily: [{ ...validState.daily[0], category: "missing" }] }))).toBeNull();
  });

  it("recupera solo identificadores de avisos válidos", () => {
    expect([...parseStoredStringSet(JSON.stringify(["daily:2026-08-04", 7, null, "monthly:2026-07"]))])
      .toEqual(["daily:2026-08-04", "monthly:2026-07"]);
  });

  it("usa un conjunto vacío si los avisos están corruptos", () => {
    expect(parseStoredStringSet("not-json").size).toBe(0);
    expect(parseStoredStringSet(JSON.stringify({ key: "daily:2026-08-04" })).size).toBe(0);
  });
});
