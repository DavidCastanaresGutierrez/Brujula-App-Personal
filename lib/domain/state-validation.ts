const LIMITS = {
  categories: 50,
  habitsPerKind: 500,
  goals: 500,
  motivations: 200,
  historyPeriods: 240,
  entriesPerGoal: 2_000,
} as const;

type JsonRecord = Record<string, unknown>;

export type ValidTrackerState = {
  daily: JsonRecord[];
  weekly: JsonRecord[];
  categories: JsonRecord[];
  motivations?: string[];
  goals?: JsonRecord[];
};

export type StateValidationResult =
  | { success: true; data: ValidTrackerState }
  | { success: false; error: string };

export function isValidStateRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.length <= max;
const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const isPositiveId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const isDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isMonthKey = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isColor = (value: unknown) => typeof value === "string" && value.length >= 1 && value.length <= 64;

function validateHistory(value: unknown) {
  if (value === undefined) return true;
  if (!isRecord(value) || Object.keys(value).length > LIMITS.historyPeriods) return false;
  return Object.entries(value).every(([period, days]) =>
    isMonthKey(period)
    && Array.isArray(days)
    && days.length <= 31
    && new Set(days).size === days.length
    && days.every((day) => Number.isInteger(day) && day >= 1 && day <= 31),
  );
}

function validateHabit(value: unknown, kind: "daily" | "weekly") {
  if (!isRecord(value)) return false;
  return isPositiveId(value.id)
    && isText(value.name, 1, 120)
    && Number.isInteger(value.goal) && Number(value.goal) > 0 && Number(value.goal) <= 366
    && isColor(value.color)
    && isText(value.category, 1, 80)
    && (value.checks === undefined || (Array.isArray(value.checks) && value.checks.every((day) => Number.isInteger(day) && day >= 1 && day <= 31)))
    && (value.archived === undefined || typeof value.archived === "boolean")
    && (value.celebratedStreak30 === undefined || isDate(value.celebratedStreak30))
    && (kind === "weekly" || value.everyDay === undefined || typeof value.everyDay === "boolean")
    && (kind === "weekly" || value.weekdaysOnly === undefined || typeof value.weekdaysOnly === "boolean")
    && validateHistory(value.history);
}

function validateBook(value: unknown) {
  return isRecord(value)
    && isPositiveId(value.id)
    && isText(value.title, 1, 200)
    && ["audio", "digital", "paper"].includes(String(value.format))
    && isDate(value.completedAt);
}

function validateFitnessEntry(value: unknown) {
  if (!isRecord(value) || !isPositiveId(value.id) || !isDate(value.recordedAt)) return false;
  return ["weight", "muscle", "fatMass", "bodyWater", "bodyFat", "bmi", "basalMetabolicRate"]
    .every((field) => isFiniteNumber(value[field]) && Number(value[field]) >= 0 && Number(value[field]) <= 20_000);
}

function validPeriodKey(period: unknown, key: unknown) {
  if (typeof key !== "string") return false;
  if (period === "daily") return isDate(key);
  if (period === "weekly") return isDate(key);
  if (period === "monthly") return isMonthKey(key);
  return period === "yearly" && /^\d{4}$/.test(key);
}

function validateGoal(value: unknown) {
  if (!isRecord(value)) return false;
  const period = value.period;
  const books = value.books;
  const fitnessEntries = value.fitnessEntries;
  return isPositiveId(value.id)
    && isText(value.title, 1, 160)
    && isText(value.category, 1, 80)
    && ["daily", "weekly", "monthly", "yearly"].includes(String(period))
    && validPeriodKey(period, value.periodKey)
    && ["complete", "quantity"].includes(String(value.measurement))
    && isFiniteNumber(value.targetValue) && Number(value.targetValue) > 0
    && isFiniteNumber(value.currentValue) && Number(value.currentValue) >= 0
    && (value.unit === undefined || isText(value.unit, 0, 40))
    && ["active", "completed", "discarded"].includes(String(value.status))
    && isDate(value.dueDate)
    && (value.linkedHabitId === undefined || isPositiveId(value.linkedHabitId))
    && (value.linkedHabitIds === undefined || (Array.isArray(value.linkedHabitIds) && new Set(value.linkedHabitIds).size === value.linkedHabitIds.length && value.linkedHabitIds.every(isPositiveId)))
    && (value.trackingStart === undefined || isDate(value.trackingStart))
    && (value.template === undefined || ["fitness", "reading"].includes(String(value.template)))
    && (books === undefined || (Array.isArray(books) && books.length <= LIMITS.entriesPerGoal && books.every(validateBook)))
    && (fitnessEntries === undefined || (Array.isArray(fitnessEntries) && fitnessEntries.length <= LIMITS.entriesPerGoal && fitnessEntries.every(validateFitnessEntry)))
    && (value.parentAnnualGoalId === undefined || isPositiveId(value.parentAnnualGoalId))
    && (value.archived === undefined || typeof value.archived === "boolean");
}

export function validateTrackerState(value: unknown): StateValidationResult {
  if (!isRecord(value)) return { success: false, error: "El estado debe ser un objeto" };
  const { daily, weekly, categories, motivations, goals } = value;
  if (!Array.isArray(daily) || !Array.isArray(weekly) || !Array.isArray(categories)) {
    return { success: false, error: "Faltan colecciones obligatorias" };
  }
  if (daily.length > LIMITS.habitsPerKind || weekly.length > LIMITS.habitsPerKind || categories.length > LIMITS.categories) {
    return { success: false, error: "Se ha superado el número máximo de elementos" };
  }
  if (!daily.every((habit) => validateHabit(habit, "daily")) || !weekly.every((habit) => validateHabit(habit, "weekly"))) {
    return { success: false, error: "Hay hábitos con datos no válidos" };
  }
  if (!categories.every((category) => isRecord(category) && isText(category.id, 1, 80) && isText(category.label, 1, 80) && isText(category.icon, 1, 16) && isColor(category.color))) {
    return { success: false, error: "Hay categorías con datos no válidos" };
  }
  if (motivations !== undefined && (!Array.isArray(motivations) || motivations.length > LIMITS.motivations || !motivations.every((text) => isText(text, 1, 220)))) {
    return { success: false, error: "Hay frases motivacionales no válidas" };
  }
  if (goals !== undefined && (!Array.isArray(goals) || goals.length > LIMITS.goals || !goals.every(validateGoal))) {
    return { success: false, error: "Hay objetivos con datos no válidos" };
  }

  const categoryIds = categories.map((category) => String((category as JsonRecord).id));
  if (new Set(categoryIds).size !== categoryIds.length) return { success: false, error: "Hay categorías duplicadas" };
  const habitIds = [...daily, ...weekly].map((habit) => Number((habit as JsonRecord).id));
  if (new Set(habitIds).size !== habitIds.length) return { success: false, error: "Hay hábitos duplicados" };
  const goalIds = (goals ?? []).map((goal) => Number((goal as JsonRecord).id));
  if (new Set(goalIds).size !== goalIds.length) return { success: false, error: "Hay objetivos duplicados" };

  const categorySet = new Set(categoryIds);
  const habitSet = new Set(habitIds);
  const goalById = new Map((goals ?? []).map((goal) => [Number((goal as JsonRecord).id), goal as JsonRecord]));
  if ([...daily, ...weekly].some((habit) => !categorySet.has(String((habit as JsonRecord).category)))) {
    return { success: false, error: "Un hábito hace referencia a una categoría inexistente" };
  }
  for (const goal of goals ?? []) {
    const item = goal as JsonRecord;
    if (!categorySet.has(String(item.category))) return { success: false, error: "Un objetivo hace referencia a una categoría inexistente" };
    const linkedIds = [...(Array.isArray(item.linkedHabitIds) ? item.linkedHabitIds : []), ...(item.linkedHabitId ? [item.linkedHabitId] : [])];
    if (linkedIds.some((id) => !habitSet.has(Number(id)))) return { success: false, error: "Un objetivo hace referencia a un hábito inexistente" };
    if (item.parentAnnualGoalId !== undefined) {
      const parent = goalById.get(Number(item.parentAnnualGoalId));
      if (!parent || parent.period !== "yearly" || Number(item.parentAnnualGoalId) === Number(item.id)) {
        return { success: false, error: "Un objetivo tiene un objetivo anual vinculado no válido" };
      }
    }
  }

  return { success: true, data: value as ValidTrackerState };
}
