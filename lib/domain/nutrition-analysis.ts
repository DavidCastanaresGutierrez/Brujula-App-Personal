import {
  detailMetricKeys,
  detailMetrics,
  detailMetricUnits,
  emptyDetails,
  emptyMacros,
  emptyNutrients,
  metricKeys,
  nutritionWeek,
  shiftDate,
  sumMacros,
  units,
  type BodyComposition,
  type Entry,
  type Macros,
  type Meal,
  type NutritionDetails,
} from "./nutrition";

const numberFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});
export const fmt = (value: number) => numberFormat.format(value);
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const blankMeal = (): Meal => ({
  name: "",
  type: "breakfast",
  quantity: 1,
  unit: "unit",
  ...emptyNutrients(),
});
export function macroText(meal: Macros) {
  return `${fmt(meal.calories)} kcal · P ${fmt(meal.protein)} g · C ${fmt(meal.carbs)} g · G ${fmt(meal.fat)} g`;
}
export type NutritionGoals = Macros & NutritionDetails;
export type BodyDraft = Omit<BodyComposition, "id">;
export type BodyImport = { schema_version: 1; measurements: BodyDraft[] };
export type BodyMetric =
  | "body_score"
  | "bmi"
  | "weight"
  | "height_cm"
  | "body_fat"
  | "fat_mass"
  | "imme"
  | "body_water"
  | "lean_mass"
  | "basal_metabolic_rate"
  | "skeletal_muscle_mass";
export const emptyGoals = (): NutritionGoals => ({
  ...emptyMacros(),
  ...emptyDetails(),
});
export const emptyBodyDraft = (): BodyDraft => ({
  recorded_at: localToday(),
  weight: 0,
  body_fat: 0,
  muscle: 0,
  fat_mass: null,
  lean_mass: null,
  body_water: null,
  bmi: null,
  basal_metabolic_rate: null,
  height_cm: null,
  imme: null,
  skeletal_muscle_mass: null,
});
export function parseBodyImport(raw: string): BodyImport {
  if (raw.length > 100000)
    throw new Error("El JSON supera el tamaño máximo (100 KB).");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("JSON no válido. Revisa las comillas, comas y llaves.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("El JSON debe ser un objeto.");
  const data = value as Record<string, unknown>;
  if (data.schema_version !== 1) throw new Error("Usa schema_version: 1.");
  if (
    !Array.isArray(data.measurements) ||
    !data.measurements.length ||
    data.measurements.length > 100
  )
    throw new Error("measurements debe contener entre 1 y 100 mediciones.");
  const optional = [
    "fat_mass",
    "lean_mass",
    "body_water",
    "bmi",
    "basal_metabolic_rate",
    "height_cm",
    "imme",
  ] as const;
  const measurements = data.measurements.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error(`Medición ${index + 1}: debe ser un objeto.`);
    const row = item as Record<string, unknown>;
    if (
      typeof row.recorded_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.recorded_at)
    )
      throw new Error(
        `Medición ${index + 1}: recorded_at debe usar AAAA-MM-DD.`,
      );
    for (const key of ["weight", "body_fat"] as const)
      if (
        typeof row[key] !== "number" ||
        !Number.isFinite(row[key]) ||
        row[key] < 0
      )
        throw new Error(
          `Medición ${index + 1}: ${key} debe ser un número válido.`,
        );
    const skeletalMuscleMass =
      typeof row.skeletal_muscle_mass === "number"
        ? row.skeletal_muscle_mass
        : row.muscle;
    if (
      typeof skeletalMuscleMass !== "number" ||
      !Number.isFinite(skeletalMuscleMass) ||
      skeletalMuscleMass < 0
    )
      throw new Error(
        `Medición ${index + 1}: skeletal_muscle_mass debe ser un número válido.`,
      );
    const result: BodyDraft = {
      recorded_at: row.recorded_at,
      weight: row.weight as number,
      body_fat: row.body_fat as number,
      muscle: skeletalMuscleMass,
      fat_mass: null,
      lean_mass: null,
      body_water: null,
      bmi: null,
      basal_metabolic_rate: null,
      height_cm: null,
      imme: null,
      skeletal_muscle_mass: skeletalMuscleMass,
    };
    for (const key of optional) {
      const number = row[key];
      if (
        number !== undefined &&
        (typeof number !== "number" || !Number.isFinite(number) || number < 0)
      )
        throw new Error(
          `Medición ${index + 1}: ${key} debe ser un número válido.`,
        );
      result[key] = (number ?? null) as BodyDraft[typeof key];
    }
    return result;
  });
  return { schema_version: 1, measurements };
}
export const detailDirection: Partial<
  Record<keyof NutritionDetails, "minimum" | "maximum">
> = {
  fiber: "minimum",
  potassium: "minimum",
  vitamin_a: "minimum",
  vitamin_c: "minimum",
  calcium: "minimum",
  iron: "minimum",
  sugars: "maximum",
  saturated_fat: "maximum",
  trans_fat: "maximum",
  cholesterol: "maximum",
  sodium: "maximum",
  salt: "maximum",
};
export const detailCardOrder = [
  "sugars",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
  "fiber",
  "potassium",
  "vitamin_a",
  "vitamin_c",
  "calcium",
  "iron",
] as const;
export const bodyMetricOrder: BodyMetric[] = [
  "body_score",
  "bmi",
  "weight",
  "height_cm",
  "body_fat",
  "fat_mass",
  "imme",
  "body_water",
  "lean_mass",
  "basal_metabolic_rate",
  "skeletal_muscle_mass",
];
export const bodyMetricMeta: Record<BodyMetric, { label: string; unit: string }> = {
  body_score: { label: "Nota corporal", unit: "/100" },
  bmi: { label: "IMC", unit: "kg/m²" },
  weight: { label: "Peso", unit: "kg" },
  height_cm: { label: "Altura", unit: "cm" },
  body_fat: { label: "Porcentaje de grasa corporal", unit: "%" },
  fat_mass: { label: "Masa grasa corporal", unit: "kg" },
  imme: { label: "IMME", unit: "kg/m²" },
  body_water: { label: "Agua total en el cuerpo", unit: "L" },
  lean_mass: { label: "Masa libre de grasa", unit: "kg" },
  basal_metabolic_rate: { label: "Metabolismo basal", unit: "kcal" },
  skeletal_muscle_mass: { label: "Masa músculo-esquelética", unit: "kg" },
};
export function rangeScore(
  value: number,
  minimum: number,
  idealMinimum: number,
  idealMaximum: number,
  maximum: number,
) {
  if (value <= minimum || value >= maximum) return 0;
  if (value < idealMinimum)
    return ((value - minimum) / (idealMinimum - minimum)) * 100;
  if (value > idealMaximum)
    return ((maximum - value) / (maximum - idealMaximum)) * 100;
  return 100;
}
export function bodyScore(entry: BodyComposition) {
  const bmi = entry.height_cm
    ? entry.weight / (entry.height_cm / 100) ** 2
    : entry.bmi;
  const waterPercentage = entry.body_water
    ? (entry.body_water / entry.weight) * 100
    : null;
  const leanPercentage = entry.lean_mass
    ? (entry.lean_mass / entry.weight) * 100
    : null;
  const fatPercentageFromMass = entry.fat_mass
    ? (entry.fat_mass / entry.weight) * 100
    : null;
  const basalPerKg = entry.basal_metabolic_rate
    ? entry.basal_metabolic_rate / entry.weight
    : null;
  const skeletalPercentage = entry.skeletal_muscle_mass
    ? (entry.skeletal_muscle_mass / entry.weight) * 100
    : null;
  const components = [
    [bmi, 15, [18.5, 20.5, 27, 35]],
    [entry.body_fat, 20, [6, 10, 20, 35]],
    [fatPercentageFromMass, 7, [6, 10, 20, 35]],
    [entry.imme, 18, [6, 8.5, 10.5, 14]],
    [waterPercentage, 12, [45, 50, 65, 75]],
    [leanPercentage, 15, [60, 70, 90, 97]],
    [basalPerKg, 5, [17, 20, 26, 32]],
    [skeletalPercentage, 8, [30, 40, 55, 65]],
  ] as const;
  if (components.some(([value]) => value === null)) return null;
  const totalWeight = components.reduce((sum, [, weight]) => sum + weight, 0);
  return Math.round(
    components.reduce(
      (sum, [value, weight, [minimum, idealMinimum, idealMaximum, maximum]]) =>
        sum + rangeScore(value!, minimum, idealMinimum, idealMaximum, maximum) * weight,
      0,
    ) / totalWeight,
  );
}
export function bodyMetricValue(entry: BodyComposition, key: BodyMetric) {
  if (key === "body_score") return bodyScore(entry);
  if (key === "lean_mass")
    return entry.lean_mass ?? entry.weight * (1 - entry.body_fat / 100);
  if (key === "skeletal_muscle_mass")
    return entry.skeletal_muscle_mass ?? entry.muscle;
  return entry[key] ?? null;
}
export function detailText(meal: NutritionDetails) {
  return detailMetricKeys
    .filter((key) => meal[key] > 0)
    .map(
      (key) =>
        `${detailMetrics[key]} ${fmt(meal[key])} ${detailMetricUnits[key]}`,
    )
    .join(" · ");
}
export function quantityText(meal: Pick<Meal, "quantity" | "unit">) {
  const label = units[meal.unit];
  const plural =
    meal.quantity === 1 || meal.unit === "g" || meal.unit === "ml"
      ? label
      : label === "ración"
        ? "raciones"
        : label === "envase"
          ? "envases"
          : `${label}s`;
  return `${fmt(meal.quantity)} ${plural}`;
}
export function dailyNutritionTips(
  total: Macros,
  details: NutritionDetails,
  goals: Macros | null,
  hasMeals: boolean,
) {
  if (!hasMeals)
    return [
      {
        tone: "neutral",
        title: "Empieza el registro",
        detail: "Añade una comida para ver consejos personalizados.",
        fact: "Dato: registrar también cantidades pequeñas mejora la comparación diaria.",
      },
    ];
  if (!goals)
    return [
      {
        tone: "neutral",
        title: "Configura tus objetivos",
        detail: "Así podremos comparar tu día y darte referencias útiles.",
        fact: "Dato: los objetivos se ajustan al contexto personal, no solo al peso.",
      },
    ];
  const tips: {
    tone: "positive" | "attention" | "neutral";
    title: string;
    detail: string;
    fact: string;
  }[] = [];
  const saturatedLimit = (goals.calories * 0.1) / 9;
  if (total.protein < goals.protein * 0.65)
    tips.push({
      tone: "attention",
      title: "Proteína por reforzar",
      detail: `Llevas ${fmt(total.protein)} de ${fmt(goals.protein)} g.`,
      fact: "Dato: la proteína contribuye al mantenimiento de la masa muscular.",
    });
  if (details.fiber < 25)
    tips.push({
      tone: "attention",
      title: "Fibra por debajo",
      detail: `Llevas ${fmt(details.fiber)} de 25 g.`,
      fact: "Dato: legumbres, fruta, verdura y cereales integrales son fuentes habituales de fibra.",
    });
  if (details.salt > 5)
    tips.push({
      tone: "attention",
      title: "Sal elevada",
      detail: `${fmt(details.salt)} g frente a 5 g de referencia.`,
      fact: "Dato: el sodio es un mineral, no una proteína; 1 g de sodio equivale aproximadamente a 2,5 g de sal.",
    });
  if (details.saturated_fat > saturatedLimit)
    tips.push({
      tone: "attention",
      title: "Saturadas elevadas",
      detail: `${fmt(details.saturated_fat)} g frente a ${fmt(saturatedLimit)} g.`,
      fact: "Dato: las grasas saturadas y trans pertenecen a la familia de las grasas, por eso usan el mismo color.",
    });
  if (total.calories > goals.calories * 1.1)
    tips.push({
      tone: "attention",
      title: "Calorías por encima",
      detail: `${fmt(total.calories)} de ${fmt(goals.calories)} kcal.`,
      fact: "Dato: el balance se interpreta mejor mirando varios días, no una sola comida.",
    });
  if (!tips.length)
    tips.push({
      tone: "positive",
      title: "Vas bien encaminado",
      detail: "Los indicadores registrados están dentro de tus referencias.",
      fact: "Dato: la regularidad del registro hace más útil la evolución semanal.",
    });
  return tips.slice(0, 3);
}
export const normalizedMealName = (name: string) =>
  name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES");
export const matchesMealSearch = (name: string, query: string) =>
  normalizedMealName(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => normalizedMealName(name).includes(word));
export const mealTypeOrder: Record<Meal["type"], number> = {
  breakfast: 0,
  mid_morning: 1,
  lunch: 2,
  snack: 3,
  dinner: 4,
  other: 5,
};
export const macroStackOrder = ["protein", "fat", "carbs"] as const;
export function macroEnergyPercentages(
  macros: Pick<Macros, "carbs" | "fat" | "protein">,
) {
  const energy = {
    carbs: macros.carbs * 4,
    fat: macros.fat * 9,
    protein: macros.protein * 4,
  };
  const total = energy.carbs + energy.fat + energy.protein;
  return {
    carbs: total ? (energy.carbs / total) * 100 : 0,
    fat: total ? (energy.fat / total) * 100 : 0,
    protein: total ? (energy.protein / total) * 100 : 0,
  };
}
export type HistoryPeriod = "weeks" | "months";
export const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("es-ES", options);
export function historyBuckets(
  period: HistoryPeriod,
  today: string,
  entries: Entry[],
) {
  const count = period === "weeks" ? 8 : 12;
  const currentWeek = nutritionWeek(today)[0];
  return Array.from({ length: count }, (_, reverse) => {
    const index = count - 1 - reverse;
    if (period === "weeks") {
      const start = shiftDate(currentWeek, -index * 7);
      return {
        start,
        end: shiftDate(start, 6),
        label: dateLabel(start, { day: "numeric", month: "short" }),
      };
    }
    const now = new Date(`${today}T12:00:00`);
    now.setMonth(now.getMonth() - index);
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    return { start, end, label: dateLabel(start, { month: "short" }) };
  }).map((bucket) => {
    const rows = entries.filter(
      (entry) => entry.date >= bucket.start && entry.date <= bucket.end,
    );
    const recorded = [...new Set(rows.map((row) => row.date))].length;
    const total = sumMacros(rows);
    const divisor = recorded;
    return {
      ...bucket,
      macros: recorded
        ? metricKeys.reduce(
            (result, key) => ({ ...result, [key]: total[key] / divisor }),
            {} as Macros,
          )
        : null,
      total,
      recorded,
    };
  });
}
export function bodyWeeklyBuckets(entries: BodyComposition[]) {
  const currentWeek = nutritionWeek(localToday())[0];
  return Array.from({ length: 12 }, (_, index) => {
    const start = shiftDate(currentWeek, -(11 - index) * 7),
      end = shiftDate(start, 6);
    const measurement =
      entries
        .filter(
          (entry) => entry.recorded_at >= start && entry.recorded_at <= end,
        )
        .at(-1) ?? null;
    return {
      start,
      label: dateLabel(start, { day: "numeric", month: "short" }),
      measurement,
    };
  });
}
