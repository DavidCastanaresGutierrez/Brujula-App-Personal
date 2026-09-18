export const mealTypes = { breakfast: "Desayuno", mid_morning: "Media mañana", lunch: "Comida", snack: "Merienda", dinner: "Cena", other: "Otros" } as const;
export const metrics = { calories: "Calorías", protein: "Proteína", carbs: "Carbohidratos", fat: "Grasas" } as const;
export const detailMetrics = {
  fiber: "Fibra dietética", sugars: "Azúcares", saturated_fat: "Grasas saturadas", trans_fat: "Grasas trans",
  cholesterol: "Colesterol", sodium: "Sodio", potassium: "Potasio", vitamin_a: "Vitamina A", vitamin_c: "Vitamina C",
  calcium: "Calcio", iron: "Hierro", salt: "Sal"
} as const;
export const detailMetricUnits = {
  fiber: "g", sugars: "g", saturated_fat: "g", trans_fat: "g", cholesterol: "mg", sodium: "mg", potassium: "mg",
  vitamin_a: "µg", vitamin_c: "mg", calcium: "mg", iron: "mg", salt: "g"
} as const;
export const units = { unit: "unidad", serving: "ración", cup: "taza", glass: "vaso", package: "envase", g: "g", ml: "ml" } as const;
export type Metric = keyof typeof metrics;
export type DetailMetric = keyof typeof detailMetrics;
export type Macros = Record<Metric, number>;
export type NutritionDetails = Record<DetailMetric, number>;
export type Nutrients = Macros & NutritionDetails;
// A frequent food stores nutrition for one reference unit (for example, one cup).
// The number consumed belongs only to a meal entry, never to the reusable food.
export type FoodDefinition = Nutrients & { type: keyof typeof mealTypes; name: string; unit: keyof typeof units };
export type Meal = FoodDefinition & { quantity: number };
export type NutritionImport = { schema_version: 1; date: string; meals: Meal[] };
export type Entry = Meal & { id: string; date: string };
export type FrequentMeal = FoodDefinition & { id: string };
export const metricKeys = Object.keys(metrics) as Metric[];
export const detailMetricKeys = Object.keys(detailMetrics) as DetailMetric[];
export const emptyMacros = (): Macros => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
export const emptyDetails = (): NutritionDetails => ({ fiber: 0, sugars: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0, potassium: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0, salt: 0 });
export const emptyNutrients = (): Nutrients => ({ ...emptyMacros(), ...emptyDetails() });
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "9999-12-31") return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseNutrition(raw: string): NutritionImport {
  if (raw.length > 100000) throw new Error("El JSON supera el tamaño máximo (100 KB).");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("JSON no válido. Revisa las comillas, comas y llaves."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El JSON debe ser un objeto.");
  const data = value as Record<string, unknown>;
  if (!("schema_version" in data)) throw new Error("Falta schema_version.");
  if (data.schema_version !== 1) throw new Error("Esta versión del formato nutricional todavía no es compatible con Brújula.");
  if (!validDate(data.date)) throw new Error("date: introduce una fecha real con formato AAAA-MM-DD.");
  if (!Array.isArray(data.meals) || !data.meals.length || data.meals.length > 100) throw new Error("meals debe ser un array de entre 1 y 100 comidas.");
  const meals = data.meals.map((item: unknown, index: number): Meal => {
    const prefix = `Comida ${index + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${prefix}: debe ser un objeto.`);
    const meal = item as Record<string, unknown>;
    if (typeof meal.name !== "string" || !meal.name.trim() || meal.name.trim().length > 200) throw new Error(`${prefix}: name debe tener entre 1 y 200 caracteres.`);
    if (typeof meal.type !== "string" || !Object.hasOwn(mealTypes, meal.type)) throw new Error(`${prefix}: type no válido.`);
    const nutrients = emptyNutrients();
    for (const key of metricKeys) {
      const number = meal[key];
      if (typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 100000) throw new Error(`${prefix}: ${key} debe ser un número entre 0 y 100.000.`);
      nutrients[key] = number;
    }
    for (const key of detailMetricKeys) {
      const number = meal[key] ?? 0;
      if (typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 100000) throw new Error(`${prefix}: ${key} debe ser un número entre 0 y 100.000.`);
      nutrients[key] = number;
    }
    const quantity = meal.quantity ?? 1;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) throw new Error(`${prefix}: quantity debe ser un número mayor que 0 y menor o igual a 100.000.`);
    const unit = meal.unit ?? "unit";
    if (typeof unit !== "string" || !Object.hasOwn(units, unit)) throw new Error(`${prefix}: unit no válida.`);
    return { type: meal.type as Meal["type"], name: meal.name.trim(), quantity, unit: unit as Meal["unit"], ...nutrients };
  });
  return { schema_version: 1, date: data.date, meals };
}
export function totalNutrients(meal: Nutrients & { quantity?: number }): Nutrients {
  const quantity = meal.quantity ?? 1;
  const total = emptyNutrients();
  for (const key of [...metricKeys, ...detailMetricKeys]) total[key] = meal[key] * quantity;
  return total;
}
export function sumMacros(meals: (Macros & { quantity?: number })[]): Macros {
  return meals.reduce((total, meal) => {
    const quantity = meal.quantity ?? 1;
    for (const key of metricKeys) total[key] += meal[key] * quantity;
    return total;
  }, emptyMacros());
}
export function sumDetails(meals: (NutritionDetails & { quantity?: number })[]): NutritionDetails {
  return meals.reduce((total, meal) => {
    const quantity = meal.quantity ?? 1;
    for (const key of detailMetricKeys) total[key] += meal[key] * quantity;
    return total;
  }, emptyDetails());
}
export function metricStatus(key: Metric, consumed: number, target: number) {
  if (key === "protein") return consumed >= target ? "within" : "below";
  return consumed < target * 0.9 ? "below" : consumed > target * 1.1 ? "above" : "within";
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function nutritionWeek(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}
export function weeklyNutrition(entries: Entry[], days: string[], today: string, goals: Macros | null) {
  const recorded = days.filter(day => day <= today && entries.some(entry => entry.date === day));
  const totals = recorded.map(day => sumMacros(entries.filter(entry => entry.date === day)));
  const average = sumMacros(totals);
  for (const key of metricKeys) average[key] /= recorded.length || 1;
  return { average, recorded: recorded.length, caloriesWithin: goals ? totals.filter(t => metricStatus("calories", t.calories, goals.calories) === "within").length : 0, proteinReached: goals ? totals.filter(t => t.protein >= goals.protein).length : 0 };
}
