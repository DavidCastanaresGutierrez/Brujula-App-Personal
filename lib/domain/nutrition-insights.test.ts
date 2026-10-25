import { describe, expect, it } from "vitest";
import type { InsightHabit } from "./insights";
import type { BodyComposition, Entry } from "./nutrition";
import { shiftDate } from "./nutrition";
import { generateNutritionInsights } from "./nutrition-insights";

const today = new Date(2026, 9, 25, 12);
const todayKey = "2026-10-25";
const meal = (date: string, calories: number, protein = 40): Entry => ({
  id: `${date}-${calories}`, date, type: "lunch", name: "Comida", quantity: 1, unit: "serving", calories, protein, carbs: 50, fat: 20,
  fiber: 0, sugars: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0, potassium: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0, salt: 0,
});
const goals = { calories: 2300, protein: 170, carbs: 220, fat: 70, fiber: 30, sugars: 50, saturated_fat: 25, trans_fat: 2, cholesterol: 300, sodium: 2000, potassium: 3500, vitamin_a: 900, vitamin_c: 90, calcium: 1000, iron: 8, salt: 5 };
const body = (recorded_at: string, weight: number, body_fat: number): BodyComposition => ({
  id: recorded_at, recorded_at, weight, body_fat, muscle: 40, fat_mass: null, lean_mass: null, body_water: null, bmi: null, basal_metabolic_rate: null, height_cm: null, imme: null, skeletal_muscle_mass: null,
});
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => shiftDate(todayKey, from + index));

describe("nutrition insights", () => {
  it("flags half-hearted logging only when there is some history", () => {
    const sparse = days(-13, -11).map((date) => meal(date, 2000));
    expect(generateNutritionInsights(today, sparse, null, [], []).map((item) => item.id)).toEqual(["nutrition-logging"]);
    expect(generateNutritionInsights(today, [], null, [], [])).toEqual([]);
    const complete = days(-13, 0).map((date) => meal(date, 2000, 170));
    expect(generateNutritionInsights(today, complete, goals, [], [])).toEqual([]);
  });
  it("compares the last recorded days with the goals", () => {
    const low = days(-6, 0).map((date) => meal(date, 1500, 100));
    const ids = generateNutritionInsights(today, [...days(-13, -7).map((date) => meal(date, 2200, 170)), ...low], goals, [], []).map((item) => item.id);
    expect(ids).toContain("nutrition-protein");
    expect(ids).toContain("nutrition-calories-low");
    const high = days(-13, 0).map((date) => meal(date, 2700, 180));
    expect(generateNutritionInsights(today, high, goals, [], []).map((item) => item.id)).toEqual(["nutrition-calories-high"]);
  });
  it("reads the body trend against a measurement at least three weeks old", () => {
    const entries = days(-13, 0).map((date) => meal(date, 2200, 170));
    const worse = generateNutritionInsights(today, entries, goals, [body("2026-09-20", 84, 15), body("2026-10-10", 85, 15.5), body("2026-10-24", 86.2, 16.4)], []);
    expect(worse[0]).toMatchObject({ id: "body-trend", severity: "attention" });
    const better = generateNutritionInsights(today, entries, goals, [body("2026-09-20", 86, 17), body("2026-10-24", 84.5, 15.6)], []);
    expect(better[0]).toMatchObject({ id: "body-trend", severity: "positive" });
    expect(generateNutritionInsights(today, entries, goals, [body("2026-10-20", 86, 17), body("2026-10-24", 84, 15)], [])).toEqual([]);
    const broken = [{ ...body("2026-09-20", 86, 17), recorded_at: undefined }, { ...body("2026-10-24", 84, 15), weight: NaN }] as unknown as BodyComposition[];
    expect(() => generateNutritionInsights(today, entries, goals, broken, [])).not.toThrow();
  });
  it("links weak habit days with calorie intake when both groups have enough days", () => {
    const habit: InsightHabit = { id: 1, name: "Pasear", goal: 31, history: { "2026-10": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] } };
    const entries = days(-27, 0).map((date) => meal(date, Number(date.slice(8)) <= 14 ? 2000 : 2600, 170));
    const insight = generateNutritionInsights(today, entries, goals, [], [habit]).find((item) => item.id === "nutrition-habits-link");
    expect(insight?.title).toBe("Los días flojos de hábitos comes más");
  });
});
