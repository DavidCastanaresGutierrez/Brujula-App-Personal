"use client";

import { useEffect, useRef, useState } from "react";
import {
  nutritionClient,
  type BodyComposition,
} from "../../lib/supabase/nutrition";
import {
  detailMetricKeys,
  detailMetrics,
  detailMetricUnits,
  emptyDetails,
  emptyMacros,
  emptyNutrients,
  mealTypes,
  metricKeys,
  metrics,
  metricStatus,
  nutritionWeek,
  parseNutrition,
  shiftDate,
  sumDetails,
  sumMacros,
  totalNutrients,
  units,
  weeklyNutrition,
  type Entry,
  type FrequentMeal,
  type Macros,
  type Meal,
  type NutritionDetails,
  type NutritionImport,
} from "../../lib/domain/nutrition";
import "./nutrition.css";

const numberFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});
const fmt = (value: number) => numberFormat.format(value);
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blankMeal = (): Meal => ({
  name: "",
  type: "breakfast",
  quantity: 1,
  unit: "unit",
  ...emptyNutrients(),
});
function macroText(meal: Macros) {
  return `${fmt(meal.calories)} kcal · P ${fmt(meal.protein)} g · C ${fmt(meal.carbs)} g · G ${fmt(meal.fat)} g`;
}
type NutritionGoals = Macros & NutritionDetails;
type BodyDraft = Omit<BodyComposition, "id">;
type BodyMetric = "weight" | "body_fat" | "muscle" | "lean_mass";
const emptyGoals = (): NutritionGoals => ({
  ...emptyMacros(),
  ...emptyDetails(),
});
const emptyBodyDraft = (): BodyDraft => ({
  recorded_at: localToday(),
  weight: 0,
  body_fat: 0,
  muscle: 0,
  fat_mass: null,
  lean_mass: null,
  body_water: null,
  bmi: null,
  basal_metabolic_rate: null,
});
const detailDirection: Partial<
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
const detailCardOrder = [
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
const bodyMetricMeta: Record<BodyMetric, { label: string; unit: string }> = {
  weight: { label: "Peso", unit: "kg" },
  body_fat: { label: "Grasa corporal", unit: "%" },
  muscle: { label: "Masa muscular", unit: "kg" },
  lean_mass: { label: "Masa libre de grasa", unit: "kg" },
};
function detailText(meal: NutritionDetails) {
  return detailMetricKeys
    .filter((key) => meal[key] > 0)
    .map(
      (key) =>
        `${detailMetrics[key]} ${fmt(meal[key])} ${detailMetricUnits[key]}`,
    )
    .join(" · ");
}
function quantityText(meal: Pick<Meal, "quantity" | "unit">) {
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
function dailyNutritionTips(
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
const normalizedMealName = (name: string) =>
  name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES");
const matchesMealSearch = (name: string, query: string) =>
  normalizedMealName(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => normalizedMealName(name).includes(word));
const mealTypeOrder: Record<Meal["type"], number> = {
  breakfast: 0,
  mid_morning: 1,
  lunch: 2,
  snack: 3,
  dinner: 4,
  other: 5,
};
const macroStackOrder = ["protein", "fat", "carbs"] as const;
function macroEnergyPercentages(
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
type HistoryPeriod = "days" | "weeks" | "months";
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("es-ES", options);
function historyBuckets(
  period: HistoryPeriod,
  today: string,
  entries: Entry[],
) {
  const count = period === "days" ? 7 : period === "weeks" ? 8 : 12;
  const currentWeek = nutritionWeek(today)[0];
  return Array.from({ length: count }, (_, reverse) => {
    const index = count - 1 - reverse;
    if (period === "days") {
      const start = shiftDate(today, -index);
      return {
        start,
        end: start,
        label: dateLabel(start, { weekday: "short", day: "numeric" }),
      };
    }
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
    const divisor = period === "days" ? 1 : recorded;
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
function bodyWeeklyBuckets(entries: BodyComposition[]) {
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

export function NutritionView({ userId }: { userId: string }) {
  const [date, setDate] = useState(localToday);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [frequent, setFrequent] = useState<FrequentMeal[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [bodyEntries, setBodyEntries] = useState<BodyComposition[]>([]);
  const [bodyMetric, setBodyMetric] = useState<BodyMetric>("weight");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Meal | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [favoriteEntry, setFavoriteEntry] = useState<{
    food: FrequentMeal;
    type: Meal["type"];
    quantity: number;
  } | null>(null);
  const [favoriteEditor, setFavoriteEditor] = useState<FrequentMeal | null>(
    null,
  );
  const [goalDraft, setGoalDraft] = useState<NutritionGoals | null>(null);
  const [bodyDraft, setBodyDraft] = useState<BodyDraft | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<NutritionImport | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importText, setImportText] = useState("");
  const [importReading, setImportReading] = useState(false);
  const [importError, setImportError] = useState("");
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [frequentSearch, setFrequentSearch] = useState("");
  const [frequentType, setFrequentType] = useState<Meal["type"] | "all">("all");
  const [selectedFrequentId, setSelectedFrequentId] = useState<string | null>(
    null,
  );
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("days");
  const [historyChart, setHistoryChart] = useState<"calories" | "macros">(
    "calories",
  );
  const [collapsedMealTypes, setCollapsedMealTypes] = useState<
    Partial<Record<Meal["type"], boolean>>
  >({});
  const operation = useRef(false);
  const editorKind = editor
    ? "meal"
    : favoriteEntry
      ? "favorite"
      : favoriteEditor
        ? "favorite-editor"
        : goalDraft
          ? "goals"
          : bodyDraft
            ? "body"
            : importOpen
              ? "import"
              : deleting
                ? "delete"
                : "";
  useEffect(() => {
    if (editorKind)
      document
        .querySelector(".nutrition-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editorKind]);
  useEffect(() => {
    if (error)
      document
        .querySelector(".nutrition-error")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);
  const today = localToday();
  const days = nutritionWeek(date);
  const start = days[0],
    end = days[6];

  useEffect(() => {
    let active = true;
    const db = nutritionClient();
    Promise.all([
      db
        .from("nutrition_entries")
        .select(
          "id,date,type,name,quantity,unit,calories,protein,carbs,fat,fiber,sugars,saturated_fat,trans_fat,cholesterol,sodium,potassium,vitamin_a,vitamin_c,calcium,iron,salt",
        )
        .eq("user_id", userId)
        .gte("date", shiftDate(today, -365))
        .lte("date", today)
        .order("created_at"),
      db
        .from("nutrition_goals")
        .select(
          "calories,protein,carbs,fat,fiber,sugars,saturated_fat,trans_fat,cholesterol,sodium,potassium,vitamin_a,vitamin_c,calcium,iron,salt",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("frequent_meals")
        .select(
          "id,type,name,unit,calories,protein,carbs,fat,fiber,sugars,saturated_fat,trans_fat,cholesterol,sodium,potassium,vitamin_a,vitamin_c,calcium,iron,salt",
        )
        .eq("user_id", userId)
        .order("name"),
      db
        .from("body_composition_entries")
        .select(
          "id,recorded_at,weight,body_fat,muscle,fat_mass,lean_mass,body_water,bmi,basal_metabolic_rate",
        )
        .eq("user_id", userId)
        .order("recorded_at"),
    ])
      .then((results) => {
        if (!active) return;
        const failure = results.find((result) => result.error)?.error;
        if (failure) {
          setError(
            `No se han podido cargar los datos nutricionales: ${failure.message}`,
          );
          return;
        }
        setEntries((results[0].data ?? []) as unknown as Entry[]);
        setGoals(results[1].data as unknown as NutritionGoals | null);
        setFrequent((results[2].data ?? []) as unknown as FrequentMeal[]);
        setBodyEntries((results[3].data ?? []) as unknown as BodyComposition[]);
        setLoading(false);
      })
      .catch(() => {
        if (active)
          setError(
            "No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.",
          );
      });
    return () => {
      active = false;
    };
  }, [userId, today, revision]);

  const changeDate = (next: string) => {
    if (!next) return;
    setLoading(true);
    setError("");
    setEditor(null);
    setEditingId(null);
    setDate(next);
    setRevision((r) => r + 1);
  };
  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar. Vuelve a intentarlo.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const db = () => nutritionClient();
  function check(result: { error: { message: string } | null }) {
    if (result.error) throw new Error(result.error.message);
  }
  async function saveMeal() {
    if (!editor) return;
    const meal = parseNutrition(
      JSON.stringify({ schema_version: 1, date, meals: [editor] }),
    ).meals[0];
    const row = { ...meal, date, user_id: userId };
    const result = editingId
      ? await db()
          .from("nutrition_entries")
          .update(row)
          .eq("user_id", userId)
          .eq("id", editingId)
          .select()
          .single()
      : await db().from("nutrition_entries").insert(row).select().single();
    check(result);
    const saved = result.data as Entry;
    setEntries((current) => [
      ...current.filter((entry) => entry.id !== saved.id),
      saved,
    ]);
    setEditor(null);
    setEditingId(null);
    setMessage("Comida guardada.");
  }
  async function saveFavoriteEntry() {
    if (!favoriteEntry) return;
    const { food, type, quantity } = favoriteEntry;
    const meal = parseNutrition(
      JSON.stringify({
        schema_version: 1,
        date,
        meals: [{ ...food, type, quantity }],
      }),
    ).meals[0];
    const result = await db()
      .from("nutrition_entries")
      .insert({ ...meal, date, user_id: userId })
      .select()
      .single();
    check(result);
    setEntries((current) => [...current, result.data as Entry]);
    setFavoriteEntry(null);
    setMessage("Comida añadida.");
  }
  async function saveFavorite() {
    if (!favoriteEditor) return;
    const duplicate = frequent.some(
      (food) =>
        food.id !== favoriteEditor.id &&
        normalizedMealName(food.name) ===
          normalizedMealName(favoriteEditor.name),
    );
    if (duplicate)
      throw new Error("Ya existe una comida frecuente con ese nombre.");
    const { id, ...definition } = favoriteEditor;
    const valid = parseNutrition(
      JSON.stringify({
        schema_version: 1,
        date,
        meals: [{ ...definition, quantity: 1 }],
      }),
    ).meals[0];
    const { quantity: _quantity, ...row } = valid;
    void _quantity;
    const result = await db()
      .from("frequent_meals")
      .update(row)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single();
    check(result);
    const saved = result.data as FrequentMeal;
    setFrequent((current) =>
      current
        .map((food) => (food.id === saved.id ? saved : food))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    );
    setFavoriteEditor(null);
    setMessage("Comida frecuente actualizada.");
  }
  async function saveGoals() {
    if (!goalDraft) return;
    for (const key of metricKeys)
      if (
        !Number.isFinite(goalDraft[key]) ||
        goalDraft[key] <= 0 ||
        goalDraft[key] > 100000
      )
        throw new Error(
          "Introduce objetivos mayores que cero y menores o iguales a 100.000.",
        );
    for (const key of detailMetricKeys)
      if (
        !Number.isFinite(goalDraft[key]) ||
        goalDraft[key] < 0 ||
        goalDraft[key] > 100000
      )
        throw new Error("Revisa los objetivos de micronutrientes.");
    check(
      await db()
        .from("nutrition_goals")
        .upsert({ user_id: userId, ...goalDraft }, { onConflict: "user_id" }),
    );
    setGoals(goalDraft);
    setGoalDraft(null);
    setMessage("Objetivos guardados.");
  }
  async function saveBodyComposition() {
    if (
      !bodyDraft ||
      !Number.isFinite(bodyDraft.weight) ||
      bodyDraft.weight <= 0 ||
      !Number.isFinite(bodyDraft.body_fat) ||
      !Number.isFinite(bodyDraft.muscle)
    )
      throw new Error(
        "Introduce peso, porcentaje de grasa y masa muscular válidos.",
      );
    const calculatedLeanMass =
      bodyDraft.lean_mass ?? bodyDraft.weight * (1 - bodyDraft.body_fat / 100);
    const result = await db()
      .from("body_composition_entries")
      .insert({ ...bodyDraft, lean_mass: calculatedLeanMass, user_id: userId })
      .select()
      .single();
    check(result);
    const saved = result.data as BodyComposition;
    setBodyEntries((items) =>
      [...items, saved].sort((a, b) =>
        a.recorded_at.localeCompare(b.recorded_at),
      ),
    );
    const leanMass = saved.weight * (1 - saved.body_fat / 100);
    const calories =
      Math.round(((370 + 21.6 * leanMass) * 1.4 * 0.9) / 50) * 50;
    const protein = Math.round((leanMass * 2.45) / 5) * 5;
    const fat = Math.round((saved.weight * 0.75) / 5) * 5;
    const carbs = Math.max(
      0,
      Math.round((calories - protein * 4 - fat * 9) / 4 / 5) * 5,
    );
    const suggested: NutritionGoals = {
      calories,
      protein,
      carbs,
      fat,
      ...emptyDetails(),
      fiber: 30,
      sugars: 50,
      saturated_fat: Math.round((calories * 0.1) / 9),
      trans_fat: Math.round(((calories * 0.01) / 9) * 10) / 10,
      cholesterol: 300,
      sodium: 2000,
      potassium: 3500,
      vitamin_a: 900,
      vitamin_c: 90,
      calcium: 1000,
      iron: 8,
      salt: 5,
    };
    setBodyDraft(null);
    setGoalDraft(suggested);
    setMessage(
      "Composición guardada. Revisa y confirma los objetivos propuestos.",
    );
  }
  async function importMeals() {
    if (!preview) return;
    // Stable content keys make retries (including a lost response) idempotent.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(preview)),
    );
    const hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const rows = preview.meals.map((meal, index) => ({
      ...meal,
      date: preview.date,
      user_id: userId,
      import_key: `${hash}:${index}`,
    }));
    // A single PostgreSQL insert is atomic: all rows or none.
    const result = await db()
      .from("nutrition_entries")
      .upsert(rows, {
        onConflict: "user_id,import_key",
        ignoreDuplicates: true,
      })
      .select("id");
    check(result);
    setMessage(
      result.data?.length
        ? `${result.data.length} comidas importadas.`
        : "Este JSON ya estaba importado. No se han duplicado comidas.",
    );
    setImportOpen(false);
    setPreview(null);
    setImportFileName("");
    setImportText("");
    setImportError("");
    changeDate(preview.date);
  }
  const daily = entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => mealTypeOrder[a.type] - mealTypeOrder[b.type]);
  const dailyGroups = (Object.keys(mealTypes) as Meal["type"][])
    .map((type) => ({
      type,
      entries: daily.filter((entry) => entry.type === type),
    }))
    .filter((group) => group.entries.length > 0);
  const total = sumMacros(daily);
  const detailTotal = sumDetails(daily);
  const dailyTips = dailyNutritionTips(
    total,
    detailTotal,
    goals,
    daily.length > 0,
  );
  const week = weeklyNutrition(entries, days, today, goals);
  const status = goals
    ? metricStatus("calories", total.calories, goals.calories)
    : "below";
  const chartMax = Math.max(
    goals?.calories ?? 0,
    ...days.map(
      (day) => sumMacros(entries.filter((e) => e.date === day)).calories,
    ),
    1,
  );
  const calorieScale = goals
    ? Math.max(goals.calories * 1.2, total.calories, 1)
    : 1;
  const macroChart = goals
    ? ([
        {
          key: "carbs",
          label: "Hidratos",
          value: total.carbs,
          goal: goals.carbs,
          color: "carbs",
        },
        {
          key: "fat",
          label: "Grasa",
          value: total.fat,
          goal: goals.fat,
          color: "fat",
        },
        {
          key: "protein",
          label: "Proteína",
          value: total.protein,
          goal: goals.protein,
          color: "protein",
        },
      ] as const)
    : [];
  const macroCalories = (macro: Pick<Macros, "carbs" | "fat" | "protein">) => ({
    carbs: macro.carbs * 4,
    fat: macro.fat * 9,
    protein: macro.protein * 4,
  });
  const macroDistribution = (() => {
    if (!goals) return [];
    const actualCalories = macroCalories(total),
      recommendedCalories = macroCalories(goals);
    const actualTotal = Object.values(actualCalories).reduce(
      (sum, value) => sum + value,
      0,
    );
    const recommendedTotal = Object.values(recommendedCalories).reduce(
      (sum, value) => sum + value,
      0,
    );
    return macroChart.map((macro) => ({
      ...macro,
      actualPercent: actualTotal
        ? (actualCalories[macro.key] / actualTotal) * 100
        : 0,
      recommendedPercent: recommendedTotal
        ? (recommendedCalories[macro.key] / recommendedTotal) * 100
        : 0,
    }));
  })();
  const detailChart = goals
    ? detailCardOrder.map((key) => ({
        key,
        label: detailMetrics[key],
        value: detailTotal[key],
        target: goals[key],
        direction: detailDirection[key] ?? "maximum",
        color: key,
        unit: detailMetricUnits[key],
        note:
          detailDirection[key] === "minimum"
            ? "mínimo diario"
            : "máximo diario",
      }))
    : [];
  const history = historyBuckets(historyPeriod, today, entries);
  const historyRecorded = history.filter((item) => item.macros !== null);
  const historyAverage = metricKeys.reduce(
    (result, key) => ({
      ...result,
      [key]:
        historyRecorded.reduce(
          (sum, item) => sum + (item.macros?.[key] ?? 0),
          0,
        ) / (historyRecorded.length || 1),
    }),
    {} as Macros,
  );
  const historyGoals =
    goals ??
    metricKeys.reduce(
      (result, key) => ({
        ...result,
        [key]: Math.max(...history.map((item) => item.macros?.[key] ?? 0), 1),
      }),
      {} as Macros,
    );
  const historyCalorieDelta = goals
    ? history.reduce(
        (sum, item) =>
          sum +
          (item.recorded
            ? item.total.calories - goals.calories * item.recorded
            : 0),
        0,
      )
    : 0;
  const visibleFrequent = frequent.filter(
    (meal) =>
      matchesMealSearch(meal.name, frequentSearch) &&
      (frequentType === "all" || meal.type === frequentType),
  );
  const selectedFrequent =
    frequent.find((meal) => meal.id === selectedFrequentId) ?? null;
  const recordedWeekDays = days.filter((day) =>
    entries.some((entry) => entry.date === day),
  );
  const weeklyCalorieDelta = goals
    ? recordedWeekDays.reduce(
        (sum, day) =>
          sum +
          (sumMacros(entries.filter((entry) => entry.date === day)).calories -
            goals.calories),
        0,
      )
    : 0;
  const bodyWeeks = bodyWeeklyBuckets(bodyEntries);
  const bodyValues = bodyWeeks.map((week) =>
    week.measurement
      ? bodyMetric === "lean_mass"
        ? (week.measurement.lean_mass ??
          week.measurement.weight * (1 - week.measurement.body_fat / 100))
        : week.measurement[bodyMetric]
      : null,
  );
  const populatedBodyValues = bodyValues.filter(
    (value): value is number => value !== null,
  );
  const bodyMin = Math.min(...populatedBodyValues, 0),
    bodyMax = Math.max(...populatedBodyValues, 1),
    bodyRange = Math.max(bodyMax - bodyMin, bodyMetric === "body_fat" ? 1 : 2);
  const bodyPoints = bodyValues
    .map((value, index) =>
      value === null
        ? null
        : `${(index / (bodyWeeks.length - 1)) * 100},${100 - ((value - (bodyMin - bodyRange * 0.12)) / (bodyRange * 1.24)) * 100}`,
    )
    .filter((value): value is string => value !== null)
    .join(" ");
  function openMeal(meal: Meal = blankMeal(), id: string | null = null) {
    setFavoriteEntry(null);
    setFavoriteEditor(null);
    setGoalDraft(null);
    setBodyDraft(null);
    setImportOpen(false);
    setDeleting(null);
    setEditor({ ...meal });
    setEditingId(id);
    setError("");
  }
  function openFavorite(food: FrequentMeal) {
    setEditor(null);
    setEditingId(null);
    setFavoriteEditor(null);
    setGoalDraft(null);
    setImportOpen(false);
    setDeleting(null);
    setFavoriteEntry({ food, type: food.type, quantity: 1 });
    setError("");
  }
  function editFavorite(food: FrequentMeal) {
    setEditor(null);
    setEditingId(null);
    setFavoriteEntry(null);
    setGoalDraft(null);
    setImportOpen(false);
    setDeleting(null);
    setFavoriteEditor({ ...food });
    setError("");
  }
  function inspectNutritionText(content: string, source: string) {
    setImportFileName(source);
    try {
      setPreview(parseNutrition(content));
      setImportError("");
    } catch (cause) {
      setPreview(null);
      setImportError(
        cause instanceof Error
          ? cause.message
          : "No se ha podido leer el JSON.",
      );
    }
  }
  function closeImport() {
    setImportOpen(false);
    setPreview(null);
    setImportFileName("");
    setImportText("");
    setImportReading(false);
    setImportError("");
  }
  function loadNutritionFile(file: File | undefined) {
    if (!file) return;
    setImportText("");
    setImportFileName(file.name);
    setImportReading(true);
    setImportError("");
    setPreview(null);
    if (file.size > 100000) {
      setImportReading(false);
      setImportError("El JSON supera el tamaño máximo (100 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setImportReading(false);
      inspectNutritionText(content, file.name);
    };
    reader.onerror = () => {
      setImportReading(false);
      setPreview(null);
      setImportError(
        "No se ha podido leer el archivo. Descárgalo de nuevo e inténtalo otra vez.",
      );
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <section className="nutrition">
      <section className="view-intro nutrition-intro">
        <p className="eyebrow">SALUD Y ENERGÍA</p>
        <h1>Nutrición</h1>
        <p>
          Registra tus comidas y contrasta lo que consumes con tus objetivos.
        </p>
        <div className="nutrition-actions nutrition-intro-actions">
          <button
            className="reset-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setImportOpen(false);
              setDeleting(null);
              setBodyDraft(null);
              setGoalDraft(goals ?? emptyGoals());
            }}
          >
            Configurar objetivos
          </button>
          <button
            className="reset-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setGoalDraft(null);
              setImportOpen(false);
              setDeleting(null);
              setBodyDraft(emptyBodyDraft());
            }}
          >
            Añadir composición
          </button>
          <button
            className="add-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setGoalDraft(null);
              setBodyDraft(null);
              setDeleting(null);
              setImportOpen(true);
              setError("");
            }}
          >
            Importar desde ChatGPT
          </button>
        </div>
      </section>
      <div className="nutrition-actions nutrition-date">
        <button
          disabled={busy}
          aria-label="Día anterior"
          onClick={() => changeDate(shiftDate(date, -1))}
        >
          ←
        </button>
        <input
          aria-label="Fecha nutricional"
          type="date"
          min="1900-01-01"
          max="9999-12-31"
          value={date}
          disabled={busy}
          onChange={(e) => changeDate(e.target.value)}
        />
        <button disabled={busy} onClick={() => changeDate(today)}>
          Hoy
        </button>
        <button
          disabled={busy}
          aria-label="Día siguiente"
          onClick={() => changeDate(shiftDate(date, 1))}
        >
          →
        </button>
      </div>
      {error && (
        <div role="alert" className="nutrition-error">
          {error}
          {loading && (
            <button
              onClick={() => {
                setError("");
                setRevision((r) => r + 1);
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Cargando nutrición…</p>
      ) : (
        <>
          <article
            className={`panel nutrition-status ${daily.length ? status : ""}`}
          >
            <h2>
              {!daily.length
                ? "Sin comidas registradas"
                : !goals
                  ? "Configura tus objetivos para comparar"
                  : status === "within"
                    ? "Dentro del rango calórico"
                    : status === "below"
                      ? "Por debajo del objetivo calórico"
                      : "Por encima del objetivo calórico"}
            </h2>
            <p>
              {daily.length
                ? `${fmt(total.calories)} kcal registradas. ${date === today ? "El día sigue en curso." : "Balance de las comidas registradas."}`
                : "Un día sin registros no se considera un día de consumo cero."}
            </p>
            <small>
              Margen de comparación: ±10 % en calorías, carbohidratos y grasas.
              En proteína, alcanzar o superar el objetivo cuenta como alcanzado.
              Son criterios de seguimiento, no una valoración médica.
            </small>
          </article>
          <article
            className="panel nutrition-tips"
            aria-label="Consejos nutricionales del día"
          >
            <div>
              <p className="eyebrow">PÍLDORAS DEL DÍA</p>
              <h2>Tu brújula nutricional</h2>
            </div>
            <div className="nutrition-tip-pills">
              {dailyTips.map((tip) => (
                <div className={tip.tone} key={tip.title}>
                  <b>{tip.title}</b>
                  <span>{tip.detail}</span>
                  <small>{tip.fact}</small>
                </div>
              ))}
            </div>
          </article>
          <div className="nutrition-grid">
            {metricKeys.map((key) => {
              const target = goals?.[key];
              const unit = key === "calories" ? "kcal" : "g";
              const state = target
                ? metricStatus(key, total[key], target)
                : "below";
              return (
                <article
                  className={`panel nutrition-metric ${state}`}
                  key={key}
                >
                  <h3>{metrics[key]}</h3>
                  <strong>
                    {fmt(total[key])}{" "}
                    <small>
                      / {target ? fmt(target) : "—"} {unit}
                    </small>
                  </strong>
                  {target && (
                    <progress
                      aria-label={`${metrics[key]} consumidas respecto al objetivo`}
                      value={Math.min(total[key], target)}
                      max={target}
                    />
                  )}
                  <p>
                    {!target
                      ? "Objetivo sin configurar"
                      : key === "protein" && total[key] >= target
                        ? "Objetivo alcanzado"
                        : total[key] < target
                          ? `Te quedan aproximadamente ${fmt(target - total[key])} ${unit}`
                          : `${fmt(total[key] - target)} ${unit} por encima del objetivo`}
                  </p>
                  <small>
                    {!target
                      ? ""
                      : state === "within"
                        ? key === "protein"
                          ? "Proteína objetivo alcanzada"
                          : "Dentro del rango"
                        : state === "below"
                          ? "Por debajo del objetivo"
                          : "Por encima del objetivo"}
                  </small>
                </article>
              );
            })}
          </div>
          {goals && (
            <>
              <div className="nutrition-visuals">
                <article className="panel nutrition-calorie-card">
                  <div>
                    <p className="eyebrow">CALORÍAS</p>
                    <strong>{fmt(total.calories)}</strong>
                    <span>kcal</span>
                  </div>
                  <div className="nutrition-calorie-target">
                    <span>Objetivo diario</span>
                    <strong>{fmt(goals.calories)} kcal</strong>
                  </div>
                  <div
                    className="nutrition-calorie-progress"
                    aria-label={`${fmt(total.calories)} de ${fmt(goals.calories)} kcal`}
                  >
                    <i
                      style={{
                        width: `${Math.min((total.calories / calorieScale) * 100, 100)}%`,
                      }}
                    />
                    <b
                      style={{
                        left: `${(goals.calories / calorieScale) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="nutrition-calorie-scale">
                    <span>0</span>
                    <span>{fmt(Math.ceil(calorieScale / 10) * 10)} kcal</span>
                  </div>
                  <p>
                    {total.calories < goals.calories
                      ? `Te quedan ${fmt(goals.calories - total.calories)} kcal para el objetivo.`
                      : `Vas ${fmt(total.calories - goals.calories)} kcal por encima del objetivo.`}
                  </p>
                </article>
                <article className="panel nutrition-macro-card">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">INFO NUTRICIONAL</p>
                      <h2>Real frente a recomendado</h2>
                    </div>
                  </div>
                  <div className="nutrition-macro-values">
                    {macroDistribution.map((macro) => (
                      <div className={macro.color} key={macro.key}>
                        <span>{macro.label}</span>
                        <strong>
                          {fmt(macro.value)}
                          <small> g</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div
                    className="nutrition-macro-distribution"
                    aria-label="Comparación de distribución de macronutrientes real y recomendada"
                  >
                    <span>Real</span>
                    <div className="nutrition-macro-percentages">
                      {macroDistribution.map((macro) => (
                        <strong className={macro.color} key={macro.key}>
                          {fmt(macro.actualPercent)}%
                        </strong>
                      ))}
                    </div>
                    <div className="nutrition-macro-bar">
                      {macroDistribution.map((macro) => (
                        <i
                          className={macro.color}
                          key={macro.key}
                          style={{ width: `${macro.actualPercent}%` }}
                        />
                      ))}
                    </div>
                    <div className="nutrition-macro-percentages recommended">
                      {macroDistribution.map((macro) => (
                        <strong className={macro.color} key={macro.key}>
                          {fmt(macro.recommendedPercent)}%
                        </strong>
                      ))}
                    </div>
                    <div className="nutrition-macro-bar target">
                      {macroDistribution.map((macro) => (
                        <i
                          className={macro.color}
                          key={macro.key}
                          style={{ width: `${macro.recommendedPercent}%` }}
                        />
                      ))}
                    </div>
                    <span>Recomendados</span>
                  </div>
                </article>
              </div>
              <details className="panel nutrition-quality-card">
                <summary>
                  <div>
                    <p className="eyebrow">MÁS DETALLE</p>
                    <h2>Micronutrientes y límites diarios</h2>
                    <p>Azúcares, grasas, fibra, vitaminas y minerales.</p>
                  </div>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <p className="nutrition-color-key">
                  Violeta: hidratos · Rosa: grasas · Amarillo: límite de sodio ·
                  Verde: fibra, vitaminas y minerales.
                </p>
                <div className="nutrition-quality-grid">
                  {detailChart.map((item) => {
                    const isAbove =
                      item.direction === "maximum" && item.value > item.target;
                    const isBelow =
                      item.direction === "minimum" && item.value < item.target;
                    const state = isAbove
                      ? "above"
                      : isBelow
                        ? "below"
                        : "within";
                    return (
                      <div
                        className={`nutrition-quality-item ${item.color} ${state}`}
                        key={item.key}
                        title={item.note}
                      >
                        <div>
                          <span>{item.label}</span>
                          <strong>
                            {fmt(item.value)}{" "}
                            <small>
                              / {fmt(item.target)} {item.unit}
                            </small>
                          </strong>
                        </div>
                        <progress
                          aria-label={`${item.label}: ${fmt(item.value)} de ${fmt(item.target)} ${item.unit}; ${item.note}`}
                          value={Math.min(item.value, item.target)}
                          max={item.target || 1}
                        />
                      </div>
                    );
                  })}
                </div>
                <small className="nutrition-quality-note">
                  Los objetivos son referencias editables. Azúcares: la
                  referencia es para azúcares libres.
                </small>
              </details>
            </>
          )}
          <article className="panel">
            <div className="panel-head">
              <h2>Comidas del día</h2>
              <button disabled={busy} onClick={() => openMeal()}>
                + Añadir comida
              </button>
            </div>
            {!daily.length && (
              <p>Añade una comida o importa tus estimaciones desde ChatGPT.</p>
            )}
            {dailyGroups.map((group) => {
              const isCollapsed = Boolean(collapsedMealTypes[group.type]);
              const contentId = `nutrition-meal-group-${group.type}`;
              return (
                <section
                  className={`nutrition-meal-group${isCollapsed ? " is-collapsed" : ""}`}
                  key={group.type}
                >
                  <h3>
                    <button
                      type="button"
                      className="nutrition-meal-group-toggle"
                      aria-expanded={!isCollapsed}
                      aria-controls={contentId}
                      onClick={() =>
                        setCollapsedMealTypes((current) => ({
                          ...current,
                          [group.type]: !current[group.type],
                        }))
                      }
                    >
                      <span>{mealTypes[group.type]}</span>
                      <small>
                        {group.entries.length}{" "}
                        {group.entries.length === 1 ? "comida" : "comidas"}
                      </small>
                      <span
                        className="nutrition-meal-group-chevron"
                        aria-hidden="true"
                      >
                        ⌄
                      </span>
                    </button>
                  </h3>
                  <div id={contentId} hidden={isCollapsed}>
                    {group.entries.map((entry) => {
                      const savedAsFrequent = frequent.some(
                        (meal) =>
                          normalizedMealName(meal.name) ===
                          normalizedMealName(entry.name),
                      );
                      const entryTotal = totalNutrients(entry);
                      return (
                        <div className="nutrition-meal" key={entry.id}>
                          <div>
                            <small>{quantityText(entry)}</small>
                            <h4>
                              {entry.name}
                              {savedAsFrequent && (
                                <span
                                  className="nutrition-frequent-badge"
                                  title="Guardada en comidas frecuentes"
                                  aria-label="Guardada en comidas frecuentes"
                                >
                                  ★ Frecuente
                                </span>
                              )}
                            </h4>
                            <p>{macroText(entryTotal)}</p>
                            {detailText(entryTotal) && (
                              <p className="nutrition-details-line">
                                {detailText(entryTotal)}
                              </p>
                            )}
                          </div>
                          <div className="nutrition-actions">
                            <button
                              disabled={busy}
                              onClick={() => openMeal(entry, entry.id)}
                            >
                              Editar
                            </button>
                            <button
                              disabled={busy || savedAsFrequent}
                              title={
                                savedAsFrequent
                                  ? "Esta comida ya está guardada en frecuentes."
                                  : undefined
                              }
                              onClick={() =>
                                void run(async () => {
                                  if (
                                    frequent.some(
                                      (meal) =>
                                        normalizedMealName(meal.name) ===
                                        normalizedMealName(entry.name),
                                    )
                                  )
                                    throw new Error(
                                      "Esta comida ya está guardada en frecuentes.",
                                    );
                                  const {
                                    name,
                                    type,
                                    unit,
                                    calories,
                                    protein,
                                    carbs,
                                    fat,
                                    fiber,
                                    sugars,
                                    saturated_fat,
                                    salt,
                                  } = entry;
                                  const result = await db()
                                    .from("frequent_meals")
                                    .insert({
                                      user_id: userId,
                                      name,
                                      type,
                                      unit,
                                      calories,
                                      protein,
                                      carbs,
                                      fat,
                                      fiber,
                                      sugars,
                                      saturated_fat,
                                      salt,
                                    })
                                    .select()
                                    .single();
                                  check(result);
                                  setFrequent((current) => [
                                    ...current,
                                    result.data as FrequentMeal,
                                  ]);
                                  setMessage(
                                    "Guardada como frecuente por unidad.",
                                  );
                                })
                              }
                            >
                              {savedAsFrequent
                                ? "Ya está en frecuentes"
                                : "Guardar como frecuente"}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setEditor(null);
                                setFavoriteEntry(null);
                                setFavoriteEditor(null);
                                setGoalDraft(null);
                                setImportOpen(false);
                                setDeleting(entry);
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </article>
          <article className="panel nutrition-body">
            <div className="panel-head">
              <div>
                <p className="eyebrow">COMPOSICIÓN CORPORAL</p>
                <h2>Tu evolución semanal</h2>
              </div>
              <button
                disabled={busy}
                onClick={() => setBodyDraft(emptyBodyDraft())}
              >
                + Añadir medición
              </button>
            </div>
            {!bodyEntries.length ? (
              <p>
                Añade una medición para generar objetivos diarios y ver tu
                evolución.
              </p>
            ) : (
              <>
                <div className="nutrition-body-summary">
                  {(
                    [
                      "weight",
                      "body_fat",
                      "muscle",
                      "lean_mass",
                    ] as BodyMetric[]
                  ).map((key) => {
                    const latest = bodyEntries.at(-1)!;
                    const value =
                      key === "lean_mass"
                        ? (latest.lean_mass ??
                          latest.weight * (1 - latest.body_fat / 100))
                        : latest[key];
                    return (
                      <div key={key}>
                        <span>{bodyMetricMeta[key].label}</span>
                        <strong>
                          {fmt(value)} {bodyMetricMeta[key].unit}
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="nutrition-history-tabs nutrition-body-tabs"
                  role="tablist"
                  aria-label="Métrica de composición corporal"
                >
                  {(Object.keys(bodyMetricMeta) as BodyMetric[]).map((key) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={bodyMetric === key}
                      className={bodyMetric === key ? `active ${key}` : ""}
                      onClick={() => setBodyMetric(key)}
                    >
                      {bodyMetricMeta[key].label}
                    </button>
                  ))}
                </div>
                <div
                  className={`nutrition-body-trend ${bodyMetric}`}
                  aria-label={`Evolución semanal de ${bodyMetricMeta[bodyMetric].label}`}
                >
                  <div className="nutrition-body-scale">
                    <span>
                      {fmt(bodyMax)} {bodyMetricMeta[bodyMetric].unit}
                    </span>
                    <span>
                      {fmt(bodyMin)} {bodyMetricMeta[bodyMetric].unit}
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <line x1="0" y1="50" x2="100" y2="50" />
                    <polyline points={bodyPoints} />
                  </svg>
                  {bodyWeeks.map((week, index) => (
                    <div
                      key={week.start}
                      className="nutrition-body-week"
                      title={
                        week.measurement
                          ? `${week.label}: ${fmt(bodyValues[index] ?? 0)} ${bodyMetricMeta[bodyMetric].unit}`
                          : `${week.label}: sin medición`
                      }
                    >
                      <i
                        className={bodyValues[index] === null ? "empty" : ""}
                        style={
                          bodyValues[index] === null
                            ? undefined
                            : {
                                top: `${100 - ((bodyValues[index]! - (bodyMin - bodyRange * 0.12)) / (bodyRange * 1.24)) * 100}%`,
                              }
                        }
                      />
                      <small>{week.label}</small>
                    </div>
                  ))}
                </div>
                <small>
                  Se muestra la última medición de cada semana; las semanas sin
                  medición no se estiman.
                </small>
              </>
            )}
          </article>
          <article className="panel nutrition-saved-foods">
            <div className="panel-head">
              <div>
                <p className="eyebrow">ALIMENTOS GUARDADOS</p>
                <h2>Buscar y añadir</h2>
              </div>
            </div>
            <label className="nutrition-search">
              <span className="sr-only">Buscar alimento guardado</span>
              <input
                type="search"
                placeholder="Buscar: café, pollo, batido…"
                value={frequentSearch}
                onChange={(e) => setFrequentSearch(e.target.value)}
              />
            </label>
            <div
              className="nutrition-saved-food-tabs"
              role="tablist"
              aria-label="Filtrar alimentos guardados"
            >
              <button
                role="tab"
                aria-selected={frequentType === "all"}
                className={frequentType === "all" ? "active" : ""}
                onClick={() => setFrequentType("all")}
              >
                Todos
              </button>
              {(Object.entries(mealTypes) as [Meal["type"], string][]).map(
                ([type, label]) => (
                  <button
                    key={type}
                    role="tab"
                    aria-selected={frequentType === type}
                    className={frequentType === type ? "active" : ""}
                    onClick={() => setFrequentType(type)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            {visibleFrequent.length > 0 && (
              <div className="nutrition-saved-food-list" role="list">
                {visibleFrequent.map((meal) => (
                  <div
                    className={`nutrition-saved-food${selectedFrequentId === meal.id ? " selected" : ""}`}
                    key={meal.id}
                    role="listitem"
                  >
                    <button
                      className="nutrition-saved-food-select"
                      aria-pressed={selectedFrequentId === meal.id}
                      onClick={() =>
                        setSelectedFrequentId((current) =>
                          current === meal.id ? null : meal.id,
                        )
                      }
                    >
                      <span
                        className="nutrition-saved-food-radio"
                        aria-hidden="true"
                      />
                      <span>
                        <b>{meal.name}</b>
                        <small>
                          {fmt(meal.calories)} kcal · 1 {units[meal.unit]} · P{" "}
                          {fmt(meal.protein)} g
                        </small>
                      </span>
                    </button>
                    <div className="nutrition-saved-food-actions">
                      <button
                        disabled={busy}
                        onClick={() => editFavorite(meal)}
                      >
                        Editar
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`Quitar ${meal.name} de frecuentes`}
                        onClick={() =>
                          void run(async () => {
                            check(
                              await db()
                                .from("frequent_meals")
                                .delete()
                                .eq("user_id", userId)
                                .eq("id", meal.id),
                            );
                            setFrequent((current) =>
                              current.filter((m) => m.id !== meal.id),
                            );
                            setSelectedFrequentId((current) =>
                              current === meal.id ? null : current,
                            );
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!frequent.length && (
              <p>
                Aún no hay alimentos guardados. Guarda una comida del día como
                frecuente para tenerla aquí.
              </p>
            )}
            {frequent.length > 0 && !visibleFrequent.length && (
              <p>No hay alimentos guardados que coincidan con esta búsqueda.</p>
            )}
            {selectedFrequent && (
              <div className="nutrition-saved-food-confirm">
                <span>
                  <b>{selectedFrequent.name}</b>
                  <small>Seleccionado para añadir al día</small>
                </span>
                <button
                  className="add-button"
                  disabled={busy}
                  onClick={() => openFavorite(selectedFrequent)}
                >
                  Añadir alimento
                </button>
              </div>
            )}
          </article>
          <article className="panel">
            <h2>Balance semanal</h2>
            <p>
              {start} — {end} · {week.recorded}/7 días con registros hasta hoy.
            </p>
            <p>
              Medias de los días registrados; pueden incluir días incompletos.
              Comparación con tus objetivos actuales.
            </p>
            <div className="nutrition-grid">
              {metricKeys.map((key) => (
                <div key={key}>
                  <h3>{metrics[key]} medias/día</h3>
                  <strong>
                    {week.recorded ? fmt(week.average[key]) : "—"}{" "}
                    {key === "calories" ? "kcal" : "g"}
                  </strong>
                  <p>Objetivo: {goals ? fmt(goals[key]) : "—"}</p>
                </div>
              ))}
            </div>
            {goals && (
              <p>
                Calorías dentro del rango: {week.caloriesWithin}/{week.recorded}{" "}
                días registrados · Proteína alcanzada: {week.proteinReached}/
                {week.recorded} días registrados
              </p>
            )}
            <h3>Calorías de la semana</h3>
            <p>
              La línea marca el objetivo:{" "}
              {goals ? `${fmt(goals.calories)} kcal` : "sin configurar"}.{" "}
              {goals && recordedWeekDays.length ? (
                <strong
                  className={
                    weeklyCalorieDelta <= 0
                      ? "nutrition-deficit"
                      : "nutrition-surplus"
                  }
                >
                  {weeklyCalorieDelta <= 0
                    ? `Déficit acumulado: ${fmt(Math.abs(weeklyCalorieDelta))} kcal`
                    : `Exceso acumulado: ${fmt(weeklyCalorieDelta)} kcal`}{" "}
                  en {recordedWeekDays.length} días con registro.
                </strong>
              ) : null}
            </p>
            <div className="nutrition-chart">
              {days.map((day) => {
                const meals = entries.filter((e) => e.date === day);
                const calories = sumMacros(meals).calories;
                const delta =
                  goals && meals.length ? calories - goals.calories : null;
                return (
                  <div key={day}>
                    <small>{meals.length ? fmt(calories) : "—"}</small>
                    <div className="nutrition-track">
                      {goals && (
                        <span
                          className="nutrition-target"
                          style={{
                            bottom: `${(goals.calories / chartMax) * 100}%`,
                          }}
                        />
                      )}
                      {meals.length > 0 && (
                        <i
                          style={{ height: `${(calories / chartMax) * 100}%` }}
                        />
                      )}
                    </div>
                    {delta !== null && (
                      <em
                        className={
                          delta <= 0 ? "nutrition-deficit" : "nutrition-surplus"
                        }
                      >
                        {delta <= 0
                          ? `−${fmt(Math.abs(delta))}`
                          : `+${fmt(delta)}`}{" "}
                        kcal
                      </em>
                    )}
                    <small>
                      {new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", {
                        weekday: "short",
                      })}
                    </small>
                  </div>
                );
              })}
            </div>
          </article>
          <article className="panel nutrition-history">
            <div className="panel-head">
              <div>
                <p className="eyebrow">EVOLUCIÓN NUTRICIONAL</p>
                <h2>Resumen combinado</h2>
              </div>
              <div className="nutrition-history-tabs" role="tablist">
                {(["days", "weeks", "months"] as HistoryPeriod[]).map(
                  (period) => (
                    <button
                      key={period}
                      role="tab"
                      aria-selected={historyPeriod === period}
                      className={historyPeriod === period ? "active" : ""}
                      onClick={() => setHistoryPeriod(period)}
                    >
                      {period === "days"
                        ? "Días"
                        : period === "weeks"
                          ? "Semanas"
                          : "Meses"}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div
              className="nutrition-history-tabs nutrition-history-data-tabs"
              role="tablist"
              aria-label="Dato mostrado en la gráfica"
            >
              <button
                role="tab"
                aria-selected={historyChart === "calories"}
                className={historyChart === "calories" ? "active" : ""}
                onClick={() => setHistoryChart("calories")}
              >
                Calorías
              </button>
              <button
                role="tab"
                aria-selected={historyChart === "macros"}
                className={historyChart === "macros" ? "active" : ""}
                onClick={() => setHistoryChart("macros")}
              >
                Macronutrientes
              </button>
            </div>
            <div className="nutrition-history-summary">
              {metricKeys.map((key) => (
                <div className={`nutrition-history-stat ${key}`} key={key}>
                  <span>{metrics[key]}</span>
                  <strong>
                    {historyRecorded.length ? fmt(historyAverage[key]) : "—"}
                    <small>{key === "calories" ? " kcal" : " g"}</small>
                  </strong>
                  <em>media</em>
                </div>
              ))}
            </div>
            <div className="nutrition-history-legend" aria-label="Leyenda">
              {historyChart === "calories" ? (
                <>
                  <span className="calories">Calorías</span>
                  <i>La línea marca tu objetivo diario</i>
                </>
              ) : (
                <>
                  <span className="protein">Proteína</span>
                  <span className="carbs">Hidratos</span>
                  <span className="fat">Grasas</span>
                  <i>Las barras muestran el reparto energético</i>
                </>
              )}
            </div>
            <p>
              {historyRecorded.length}/{history.length} periodos con registros.
              Las medias excluyen periodos sin datos.
            </p>
            <div
              className={`nutrition-history-chart ${historyChart}`}
              aria-label={
                historyChart === "calories"
                  ? "Evolución de calorías"
                  : "Evolución de distribución de macronutrientes"
              }
            >
              {history.map((item) => {
                const distribution = item.macros
                  ? macroEnergyPercentages(item.macros)
                  : null;
                return (
                  <div
                    key={item.start}
                    title={
                      item.macros === null
                        ? `${item.label}: sin registros`
                        : `${item.label}: ${metricKeys.map((key) => `${metrics[key]} ${fmt(item.macros?.[key] ?? 0)}${key === "calories" ? " kcal" : " g"}`).join(" · ")}`
                    }
                  >
                    <div className="nutrition-history-track">
                      {historyChart === "calories" && item.macros && (
                        <i
                          className="calories"
                          style={{
                            height: `${Math.min((item.macros.calories / historyGoals.calories) * 100, 100)}%`,
                          }}
                        />
                      )}
                      {historyChart === "calories" && (
                        <b className="calories" />
                      )}
                      {historyChart === "macros" &&
                        distribution &&
                        macroStackOrder.map((key, index) => (
                          <i
                            className={key}
                            key={key}
                            style={{
                              height: `${distribution[key]}%`,
                              bottom: `${macroStackOrder.slice(0, index).reduce((sum, previous) => sum + distribution[previous], 0)}%`,
                            }}
                          />
                        ))}
                    </div>
                    <small>{item.label}</small>
                  </div>
                );
              })}
            </div>
          </article>
          {goals && historyRecorded.length > 0 && (
            <article
              className={`panel nutrition-history-balance ${historyCalorieDelta <= 0 ? "deficit" : "surplus"}`}
            >
              <p className="eyebrow">BALANCE DEL PERÍODO SELECCIONADO</p>
              <h2>
                {historyCalorieDelta <= 0
                  ? "Déficit calórico"
                  : "Exceso calórico"}
              </h2>
              <strong>
                {historyCalorieDelta <= 0 ? "−" : "+"}
                {fmt(Math.abs(historyCalorieDelta))} <small>kcal</small>
              </strong>
              <p>
                {historyPeriod === "days"
                  ? "Suma de los días registrados"
                  : historyPeriod === "weeks"
                    ? "Suma de las semanas mostradas"
                    : "Suma de los meses mostrados"}
                . Solo cuenta períodos con comidas registradas.
              </p>
            </article>
          )}
        </>
      )}
      {editor && (
        <section
          className="panel nutrition-editor"
          aria-label="Formulario de comida"
        >
          <h2>{editingId ? "Editar comida" : "Añadir comida"}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(saveMeal);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Nombre de la comida
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={editor.name}
                  onChange={(e) =>
                    setEditor({ ...editor, name: e.target.value })
                  }
                />
              </label>
              <label>
                Tipo de comida
                <select
                  value={editor.type}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      type: e.target.value as Meal["type"],
                    })
                  }
                >
                  {Object.entries(mealTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <QuantityFields
                value={editor}
                onChange={(value) => setEditor({ ...editor, ...value })}
              />
              <h3>Valores por {units[editor.unit]}</h3>
              <MacroFields
                value={editor}
                onChange={(value) => setEditor({ ...editor, ...value })}
              />
              <details className="nutrition-optional-fields">
                <summary>Información nutricional adicional</summary>
                <DetailFields
                  value={editor}
                  onChange={(value) => setEditor({ ...editor, ...value })}
                />
              </details>
              <p>
                <strong>Total: {macroText(totalNutrients(editor))}</strong>
              </p>
              {detailText(totalNutrients(editor)) && (
                <p>{detailText(totalNutrients(editor))}</p>
              )}
              <div className="nutrition-actions">
                <button type="submit">Guardar comida</button>
                <button type="button" onClick={() => setEditor(null)}>
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {favoriteEntry && (
        <section
          className="panel nutrition-editor"
          aria-label="Añadir comida frecuente"
        >
          <h2>Añadir {favoriteEntry.food.name}</h2>
          <p>
            Este favorito conserva sus valores por{" "}
            {units[favoriteEntry.food.unit]}. La cantidad de hoy se guarda solo
            en este registro.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(saveFavoriteEntry);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Tipo de comida
                <select
                  value={favoriteEntry.type}
                  onChange={(e) =>
                    setFavoriteEntry({
                      ...favoriteEntry,
                      type: e.target.value as Meal["type"],
                    })
                  }
                >
                  {Object.entries(mealTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad de hoy
                <input
                  autoFocus
                  required
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={100000}
                  step="any"
                  value={
                    Number.isNaN(favoriteEntry.quantity)
                      ? ""
                      : favoriteEntry.quantity
                  }
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setFavoriteEntry({
                      ...favoriteEntry,
                      quantity:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
              <p>
                <strong>
                  Total:{" "}
                  {macroText(
                    totalNutrients({
                      ...favoriteEntry.food,
                      quantity: favoriteEntry.quantity,
                    }),
                  )}
                </strong>
              </p>
              <div className="nutrition-actions">
                <button type="submit">
                  Añadir{" "}
                  {quantityText({
                    quantity: favoriteEntry.quantity,
                    unit: favoriteEntry.food.unit,
                  })}
                </button>
                <button type="button" onClick={() => setFavoriteEntry(null)}>
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {favoriteEditor && (
        <section
          className="panel nutrition-editor"
          aria-label="Editar comida frecuente"
        >
          <h2>Editar comida frecuente</h2>
          <p>
            Edita su ficha de referencia. Esto no cambia las comidas que ya has
            registrado.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(saveFavorite);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Nombre de la comida
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={favoriteEditor.name}
                  onChange={(e) =>
                    setFavoriteEditor({
                      ...favoriteEditor,
                      name: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Tipo habitual
                <select
                  value={favoriteEditor.type}
                  onChange={(e) =>
                    setFavoriteEditor({
                      ...favoriteEditor,
                      type: e.target.value as Meal["type"],
                    })
                  }
                >
                  {Object.entries(mealTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unidad de referencia
                <select
                  value={favoriteEditor.unit}
                  onChange={(e) =>
                    setFavoriteEditor({
                      ...favoriteEditor,
                      unit: e.target.value as Meal["unit"],
                    })
                  }
                >
                  {Object.entries(units).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <h3>Valores por {units[favoriteEditor.unit]}</h3>
              <MacroFields
                value={favoriteEditor}
                onChange={(value) =>
                  setFavoriteEditor({ ...favoriteEditor, ...value })
                }
              />
              <details className="nutrition-optional-fields">
                <summary>Información nutricional adicional</summary>
                <DetailFields
                  value={favoriteEditor}
                  onChange={(value) =>
                    setFavoriteEditor({ ...favoriteEditor, ...value })
                  }
                />
              </details>
              <div className="nutrition-actions">
                <button type="submit">Guardar favorito</button>
                <button type="button" onClick={() => setFavoriteEditor(null)}>
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {goalDraft && (
        <section
          className="panel nutrition-editor"
          aria-label="Objetivos nutricionales"
        >
          <h2>Objetivos diarios</h2>
          <p>
            Se generan a partir de tu última composición corporal y son
            editables. Las referencias de micronutrientes no sustituyen consejo
            médico individual.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(saveGoals);
            }}
          >
            <fieldset disabled={busy}>
              <h3>Macros</h3>
              <MacroFields
                value={goalDraft}
                onChange={(value) => setGoalDraft({ ...goalDraft, ...value })}
                positive
              />
              <h3>Micronutrientes y límites</h3>
              <DetailFields
                value={goalDraft}
                onChange={(value) => setGoalDraft({ ...goalDraft, ...value })}
              />
              <div className="nutrition-actions">
                <button type="submit">Guardar objetivos</button>
                <button type="button" onClick={() => setGoalDraft(null)}>
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {bodyDraft && (
        <section
          className="panel nutrition-editor"
          aria-label="Composición corporal"
        >
          <h2>Registrar composición corporal</h2>
          <p>
            Al guardarla, Brújula te propondrá calorías y macros para perder
            grasa preservando masa muscular. Podrás modificarlos antes de
            confirmar.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(saveBodyComposition);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Fecha
                <input
                  type="date"
                  value={bodyDraft.recorded_at}
                  onChange={(e) =>
                    setBodyDraft({ ...bodyDraft, recorded_at: e.target.value })
                  }
                />
              </label>
              <div className="nutrition-grid">
                {(
                  [
                    ["weight", "Peso (kg)"],
                    ["body_fat", "Grasa corporal (%)"],
                    ["muscle", "Masa muscular (kg)"],
                    ["fat_mass", "Masa grasa (kg)"],
                    ["lean_mass", "Masa libre de grasa (kg)"],
                    ["body_water", "Agua corporal total (L)"],
                    ["bmi", "IMC (kg/m²)"],
                    ["basal_metabolic_rate", "Metabolismo basal (kcal)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={
                        key === "weight" ||
                        key === "body_fat" ||
                        key === "muscle"
                      }
                      type="number"
                      min="0"
                      step="any"
                      value={bodyDraft[key] ?? ""}
                      onChange={(e) =>
                        setBodyDraft({
                          ...bodyDraft,
                          [key]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="nutrition-actions">
                <button type="submit">Guardar y calcular objetivos</button>
                <button type="button" onClick={() => setBodyDraft(null)}>
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {importOpen && (
        <section
          className="panel nutrition-editor"
          aria-label="Importación desde ChatGPT"
        >
          <h2>Añadir JSON de ChatGPT</h2>
          <p>
            Selecciona un archivo o pega el JSON directamente. Revisarás las
            comidas antes de guardarlas.
          </p>
          <label className="nutrition-file-picker">
            Archivo JSON
            <input
              aria-label="Seleccionar JSON de ChatGPT"
              className="nutrition-file-input"
              type="file"
              accept="application/json,.json"
              disabled={busy || importReading}
              onChange={(e) => loadNutritionFile(e.currentTarget.files?.[0])}
            />
          </label>
          {importReading && (
            <p className="nutrition-file-status" role="status">
              Leyendo {importFileName}…
            </p>
          )}
          <div className="nutrition-import-divider">
            <span>o pega el contenido</span>
          </div>
          <label>
            JSON
            <textarea
              className="nutrition-json-input"
              aria-label="Pegar JSON de ChatGPT"
              placeholder={
                '{\n  "schema_version": 1,\n  "date": "2026-09-16",\n  "meals": […]\n}'
              }
              rows={9}
              maxLength={100000}
              spellCheck={false}
              value={importText}
              disabled={busy || importReading}
              onChange={(e) => {
                setImportText(e.target.value);
                setPreview(null);
                setImportFileName("");
                setImportError("");
              }}
            />
          </label>
          <div className="nutrition-actions">
            <button
              type="button"
              disabled={busy || importReading || !importText.trim()}
              onClick={() => inspectNutritionText(importText, "JSON pegado")}
            >
              Previsualizar JSON
            </button>
            <button
              type="button"
              disabled={busy || importReading}
              onClick={closeImport}
            >
              Cancelar
            </button>
          </div>
          {importError && (
            <p className="nutrition-error" role="alert">
              {importError}
            </p>
          )}
          <details>
            <summary>¿Cómo consigo el JSON?</summary>
            <p>
              Copia el bloque completo que te dé ChatGPT y pégalo arriba.
              También puedes descargarlo y seleccionar el archivo.
            </p>
          </details>
          {preview && (
            <div className="nutrition-import-preview">
              <h3>
                JSON listo · {preview.date} · {preview.meals.length} comidas
              </h3>
              <p className="nutrition-file-status">{importFileName}</p>
              {preview.meals.map((meal, i) => {
                const mealTotal = totalNutrients(meal);
                return (
                  <p key={i}>
                    <b>
                      {mealTypes[meal.type]}: {meal.name} · {quantityText(meal)}
                    </b>
                    <br />
                    {macroText(mealTotal)}
                    {detailText(mealTotal) && (
                      <>
                        <br />
                        {detailText(mealTotal)}
                      </>
                    )}
                  </p>
                );
              })}
              <p>
                <strong>Total: {macroText(sumMacros(preview.meals))}</strong>
              </p>
              <p>
                Se añadirán a las comidas existentes de esa fecha. Un JSON
                idéntico no se importa dos veces.
              </p>
              <button disabled={busy} onClick={() => void run(importMeals)}>
                Confirmar importación
              </button>
            </div>
          )}
        </section>
      )}
      {deleting && (
        <section className="panel nutrition-editor">
          <h2>¿Eliminar {deleting.name}?</h2>
          <div className="nutrition-actions">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  check(
                    await db()
                      .from("nutrition_entries")
                      .delete()
                      .eq("user_id", userId)
                      .eq("id", deleting.id),
                  );
                  setEntries((current) =>
                    current.filter((e) => e.id !== deleting.id),
                  );
                  setDeleting(null);
                })
              }
            >
              Confirmar eliminación
            </button>
            <button disabled={busy} onClick={() => setDeleting(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
function MacroFields({
  value,
  onChange,
  positive = false,
}: {
  value: Macros;
  onChange: (value: Macros) => void;
  positive?: boolean;
}) {
  return (
    <div className="nutrition-grid">
      {metricKeys.map((key) => (
        <label key={key}>
          {metrics[key]} ({key === "calories" ? "kcal" : "g"})
          <input
            required
            type="number"
            inputMode="decimal"
            min={positive ? 0.01 : 0}
            max={100000}
            step="any"
            value={Number.isNaN(value[key]) ? "" : value[key]}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
function DetailFields({
  value,
  onChange,
}: {
  value: NutritionDetails;
  onChange: (value: NutritionDetails) => void;
}) {
  return (
    <div className="nutrition-grid">
      {detailMetricKeys.map((key) => (
        <label key={key}>
          {detailMetrics[key]} (g)
          <input
            required
            type="number"
            inputMode="decimal"
            min={0}
            max={100000}
            step="any"
            value={Number.isNaN(value[key]) ? "" : value[key]}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
function QuantityFields({
  value,
  onChange,
}: {
  value: Pick<Meal, "quantity" | "unit">;
  onChange: (value: Pick<Meal, "quantity" | "unit">) => void;
}) {
  return (
    <div className="nutrition-quantity">
      <label>
        Cantidad
        <input
          required
          type="number"
          inputMode="decimal"
          min={0.01}
          max={100000}
          step="any"
          value={Number.isNaN(value.quantity) ? "" : value.quantity}
          onFocus={(e) => e.target.select()}
          onChange={(e) =>
            onChange({
              ...value,
              quantity: e.target.value === "" ? NaN : Number(e.target.value),
            })
          }
        />
      </label>
      <label>
        Unidad
        <select
          value={value.unit}
          onChange={(e) =>
            onChange({ ...value, unit: e.target.value as Meal["unit"] })
          }
        >
          {Object.entries(units).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
