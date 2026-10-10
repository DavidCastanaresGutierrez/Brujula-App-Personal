import { describe, expect, it } from "vitest";
import type { BodyComposition, Entry } from "./nutrition";
import {
  bodyScore,
  bodyWeeklyBuckets,
  dailyNutritionTips,
  historyBuckets,
  matchesMealSearch,
  parseBodyImport,
  quantityText,
  suggestedGoalsFromBody,
} from "./nutrition-analysis";

const body: BodyComposition = {
  id: "b1", recorded_at: "2026-09-22", weight: 86.6, body_fat: 15.4, muscle: 42.1, fat_mass: 13.3, lean_mass: 73.3,
  body_water: 53.6, bmi: 26.1, basal_metabolic_rate: 1952, height_cm: 182, imme: 9.2, skeletal_muscle_mass: 42.1,
};
const entry = (date: string, calories: number): Entry => ({
  id: `${date}-${calories}`, date, type: "lunch", name: "Comida", quantity: 1, unit: "serving", calories, protein: 30, carbs: 50, fat: 20,
  fiber: 0, sugars: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0, potassium: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0, salt: 0,
});

describe("body composition", () => {
  it("scores a complete measurement between 0 and 100 and skips incomplete ones", () => {
    const score = bodyScore(body);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0);
    expect(score!).toBeLessThanOrEqual(100);
    expect(bodyScore({ ...body, body_water: null })).toBeNull();
  });
  it("suggests editable daily targets from weight and fat", () => {
    const goals = suggestedGoalsFromBody(body);
    expect(goals.calories % 50).toBe(0);
    expect(goals.protein).toBe(180);
    expect(goals.fat).toBe(65);
    expect(goals.carbs).toBe(Math.max(0, Math.round((goals.calories - 180 * 4 - 65 * 9) / 4 / 5) * 5));
    expect(goals.salt).toBe(5);
  });
  it("parses Samsung Health style imports and falls back from muscle to skeletal mass", () => {
    const parsed = parseBodyImport(JSON.stringify({ schema_version: 1, measurements: [{ recorded_at: "2026-09-22", weight: 86.6, body_fat: 15.4, muscle: 42.1, bmi: 26.1 }] }));
    expect(parsed.measurements[0]).toMatchObject({ skeletal_muscle_mass: 42.1, muscle: 42.1, bmi: 26.1, lean_mass: null });
    expect(() => parseBodyImport('{"schema_version":1,"measurements":[{"recorded_at":"22/09/2026","weight":80,"body_fat":15,"muscle":40}]}')).toThrow("recorded_at");
    expect(() => parseBodyImport('{"schema_version":2,"measurements":[]}')).toThrow("schema_version");
  });
  it("keeps the last measurement of each of the last twelve weeks", () => {
    const weeks = bodyWeeklyBuckets([body]);
    expect(weeks).toHaveLength(12);
    expect(weeks.filter((week) => week.measurement)).toHaveLength(body.recorded_at >= weeks[0].start ? 1 : 0);
  });
});

describe("history and tips", () => {
  it("averages only recorded days inside each bucket", () => {
    const today = "2026-10-10";
    const buckets = historyBuckets("weeks", today, [entry("2026-10-06", 2000), entry("2026-10-06", 400), entry("2026-10-07", 1800)]);
    expect(buckets).toHaveLength(8);
    const current = buckets.at(-1)!;
    expect(current.recorded).toBe(2);
    expect(current.macros?.calories).toBe(2100);
    expect(buckets[0].macros).toBeNull();
    expect(historyBuckets("months", today, [])).toHaveLength(12);
  });
  it("prioritises attention tips and caps them at three", () => {
    const goals = { calories: 2300, protein: 170, carbs: 220, fat: 70 };
    const details = { fiber: 5, sugars: 0, saturated_fat: 40, trans_fat: 0, cholesterol: 0, sodium: 0, potassium: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0, salt: 9 };
    const tips = dailyNutritionTips({ calories: 3000, protein: 50, carbs: 300, fat: 120 }, details, goals, true);
    expect(tips).toHaveLength(3);
    expect(tips.every((tip) => tip.tone === "attention")).toBe(true);
    expect(dailyNutritionTips({ calories: 0, protein: 0, carbs: 0, fat: 0 }, details, goals, false)[0].title).toBe("Empieza el registro");
    expect(dailyNutritionTips({ calories: 2200, protein: 180, carbs: 200, fat: 60 }, { ...details, fiber: 30, saturated_fat: 10, salt: 3 }, goals, true)[0].tone).toBe("positive");
  });
  it("matches saved foods ignoring accents and word order", () => {
    expect(matchesMealSearch("Café con leche", "cafe leche")).toBe(true);
    expect(matchesMealSearch("Pollo asado", "pollo frito")).toBe(false);
  });
  it("pluralises units in Spanish", () => {
    expect(quantityText({ quantity: 2, unit: "serving" })).toBe("2 raciones");
    expect(quantityText({ quantity: 150, unit: "g" })).toBe("150 g");
    expect(quantityText({ quantity: 3, unit: "glass" })).toBe("3 vasos");
  });
});
