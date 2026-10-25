import { describe, expect, it } from "vitest";
import type { Entry } from "./nutrition";
import { appendOperation, applyOperation, applyOutbox, emptyNutritionData, isNetworkFailureMessage, parseOutbox } from "./nutrition-outbox";

const entry = (id: string, name = "Comida"): Entry => ({
  id, date: "2026-10-25", type: "lunch", name, quantity: 1, unit: "serving", calories: 500, protein: 30, carbs: 50, fat: 20,
  fiber: 0, sugars: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0, potassium: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0, salt: 0,
});

describe("nutrition outbox", () => {
  it("coalesces saves of the same row and keeps deletes", () => {
    let items = appendOperation([], { kind: "entry.save", entry: entry("a", "v1") });
    items = appendOperation(items, { kind: "entry.save", entry: entry("a", "v2") });
    items = appendOperation(items, { kind: "goals.save", goals: { calories: 1, protein: 1, carbs: 1, fat: 1 } as never });
    items = appendOperation(items, { kind: "goals.save", goals: { calories: 2, protein: 1, carbs: 1, fat: 1 } as never });
    expect(items.map((item) => item.operation.kind)).toEqual(["entry.save", "goals.save"]);
    expect(items[0].operation.kind === "entry.save" && items[0].operation.entry.name).toBe("v2");
    items = appendOperation(items, { kind: "entry.delete", id: "a" });
    expect(items.map((item) => item.operation.kind)).toEqual(["goals.save", "entry.delete"]);
  });
  it("applies operations locally in order", () => {
    const items = [
      appendOperation([], { kind: "entry.save", entry: entry("a") })[0],
      appendOperation([], { kind: "entry.save", entry: entry("a", "editada") })[0],
      appendOperation([], { kind: "entry.save", entry: entry("b") })[0],
      appendOperation([], { kind: "entry.delete", id: "b" })[0],
    ];
    const data = applyOutbox(emptyNutritionData(), items);
    expect(data.entries.map((item) => [item.id, item.name])).toEqual([["a", "editada"]]);
    const imported = applyOperation(data, { kind: "entries.import", preview: { schema_version: 1, date: "2026-10-24", meals: [entry("x"), entry("y")] } });
    expect(imported.entries).toHaveLength(3);
    expect(applyOperation(imported, { kind: "entries.import", preview: { schema_version: 1, date: "2026-10-24", meals: [entry("x"), entry("y")] } }).entries).toHaveLength(3);
  });
  it("parses only well-formed stored queues", () => {
    expect(parseOutbox(null)).toEqual([]);
    expect(parseOutbox("{")).toEqual([]);
    expect(parseOutbox(JSON.stringify([{ id: "1", createdAt: "x", operation: { kind: "entry.delete", id: "a" } }, { nope: true }]))).toHaveLength(1);
  });
  it("recognises network failures but not server rejections", () => {
    expect(isNetworkFailureMessage("TypeError: Failed to fetch", "")).toBe(true);
    expect(isNetworkFailureMessage("FetchError: request to x failed", "")).toBe(true);
    expect(isNetworkFailureMessage("new row violates row-level security policy", "42501")).toBe(false);
    expect(isNetworkFailureMessage("duplicate key value", "23505")).toBe(false);
  });
});
