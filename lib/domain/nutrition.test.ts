import { describe, expect, it } from "vitest";
import { parseNutrition, metricStatus, nutritionWeek, weeklyNutrition, type Meal } from "./nutrition";
const meal: Meal = { name: "Pollo", type: "lunch", calories: 550, protein: 72, carbs: 35, fat: 13 };
const payload = { schema_version: 1, date: "2026-09-15", meals: [meal] };
describe("nutrition import", () => {
  it("accepts fractional estimates without deriving calories", () => expect(parseNutrition(JSON.stringify({...payload, meals:[{...meal,protein:72.5}]})).meals[0].protein).toBe(72.5));
  it.each(["2026-02-30", "2026-13-01", "26-09-15", "2025-02-29"])("rejects impossible date %s", date => expect(() => parseNutrition(JSON.stringify({...payload,date}))).toThrow("date"));
  it("accepts leap day", () => expect(parseNutrition(JSON.stringify({...payload,date:"2024-02-29"})).date).toBe("2024-02-29"));
  it.each([null, "550", -1, 100001])("rejects invalid macro %s", calories => expect(() => parseNutrition(JSON.stringify({...payload,meals:[{...meal,calories}]}))).toThrow("calories"));
  it.each(["__proto__", "toString", "Lunch"])("rejects unknown type %s", type => expect(() => parseNutrition(JSON.stringify({...payload,meals:[{...meal,type}]}))).toThrow("type"));
  it("rejects the whole batch and identifies the failing meal", () => expect(() => parseNutrition(JSON.stringify({...payload,meals:[meal,{...meal,name:" "}]}))).toThrow("Comida 2"));
  it("explains unsupported versions", () => expect(() => parseNutrition(JSON.stringify({...payload,schema_version:2}))).toThrow("Esta versión del formato nutricional todavía no es compatible con Brújula."));
  it("requires a version and nonempty array", () => { expect(() => parseNutrition('{"date":"2026-09-15","meals":[]}')).toThrow("schema_version"); expect(() => parseNutrition(JSON.stringify({...payload,meals:[]}))).toThrow("meals"); });
});
describe("nutrition summary", () => {
  it("accepts extra protein and calorie tolerance boundaries", () => { expect(metricStatus("protein",183,170)).toBe("within"); expect(metricStatus("calories",2070,2300)).toBe("within"); expect(metricStatus("calories",2531,2300)).toBe("above"); });
  it("keeps a full Monday-Sunday week across months", () => expect(nutritionWeek("2026-09-01")).toEqual(["2026-08-31","2026-09-01","2026-09-02","2026-09-03","2026-09-04","2026-09-05","2026-09-06"]));
  it("excludes unrecorded and future days from averages", () => { const entries = [{...meal,id:"1",date:"2026-09-14"},{...meal,id:"2",date:"2026-09-16"}]; const summary = weeklyNutrition(entries,nutritionWeek("2026-09-15"),"2026-09-15",meal); expect(summary.recorded).toBe(1); expect(summary.average.calories).toBe(550); expect(summary.caloriesWithin).toBe(1); });
});
