export const mealTypes = { breakfast: "Desayuno", mid_morning: "Media mañana", lunch: "Comida", snack: "Merienda", dinner: "Cena", other: "Otros" } as const;
export const metrics = { calories: "Calorías", protein: "Proteína", carbs: "Carbohidratos", fat: "Grasas" } as const;
export type Metric = keyof typeof metrics;
export type Macros = Record<Metric, number>;
export type Meal = Macros & { type: keyof typeof mealTypes; name: string };
export type NutritionImport = { schema_version: 1; date: string; meals: Meal[] };
export type Entry = Meal & { id: string; date: string };
export type FrequentMeal = Meal & { id: string };
export const metricKeys = Object.keys(metrics) as Metric[];
export const emptyMacros = (): Macros => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
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
    const macros = emptyMacros();
    for (const key of metricKeys) {
      const number = meal[key];
      if (typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 100000) throw new Error(`${prefix}: ${key} debe ser un número entre 0 y 100.000.`);
      macros[key] = number;
    }
    return { type: meal.type as Meal["type"], name: meal.name.trim(), ...macros };
  });
  return { schema_version: 1, date: data.date, meals };
}
export function sumMacros(meals: Macros[]): Macros {
  return meals.reduce((total, meal) => {
    for (const key of metricKeys) total[key] += meal[key];
    return total;
  }, emptyMacros());
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
