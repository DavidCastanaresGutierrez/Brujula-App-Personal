import { ensureArchiveDate, isoDate, localDateKey } from "./tracking";
import type { Category, HabitCategory, TrackerState } from "./tracker-state";

type NormalizationOptions = {
  defaultCategories: Category[];
  palette: string[];
  archiveMigrationDate?: string;
};

export function inferCategory(name: string): HabitCategory {
  const value = name.toLocaleLowerCase("es");
  if (/famil|hij|pareja|casa|colada|limpieza|compra/.test(value)) return "family";
  if (/trabaj|reuni|oferta|proyecto|correo/.test(value)) return "work";
  if (/ahorr|invert|gasto|finan|presupuesto/.test(value)) return "finance";
  if (/leer|medit|estudi|curso|idioma|aprender/.test(value)) return "growth";
  return "health";
}

export function normalizeTrackerState(
  state: TrackerState,
  { defaultCategories, palette, archiveMigrationDate = localDateKey() }: NormalizationOptions,
): Required<TrackerState> {
  const categories = state.categories?.length
    ? state.categories.map((category, index) => {
        const fallback = defaultCategories.find((item) => item.id === category.id);
        return {
          id: category.id || fallback?.id || `block-${index}`,
          label: category.label?.trim() || fallback?.label || `Bloque ${index + 1}`,
          icon: category.icon?.trim() || fallback?.icon || "●",
          color: category.color?.trim() || fallback?.color || palette[index % palette.length],
          priority: Boolean(category.priority),
        };
      })
    : defaultCategories;

  return {
    daily: (state.daily ?? []).map((habit) => ensureArchiveDate({ ...habit, category: habit.category ?? inferCategory(habit.name) }, archiveMigrationDate)),
    weekly: (state.weekly ?? []).map((habit) => ensureArchiveDate({ ...habit, category: habit.category ?? inferCategory(habit.name) }, archiveMigrationDate)),
    categories,
    motivations: state.motivations?.filter((item) => item.trim()) ?? [],
    goals: state.goals ?? [],
    weeklyReviews: state.weeklyReviews ?? [],
  };
}

export function streakContaining(history: Record<string, number[]> | undefined, target: string) {
  const completed = new Set<string>();
  Object.entries(history ?? {}).forEach(([key, checkedDays]) => {
    const [entryYear, entryMonth] = key.split("-").map(Number);
    checkedDays.forEach((day) => completed.add(isoDate(entryYear, entryMonth - 1, day)));
  });
  if (!completed.has(target)) return { length: 0, start: target };

  const cursor = new Date(`${target}T00:00:00Z`);
  const move = (days: number) => {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  };

  let before = 0;
  while (completed.has(move(-(before + 1)))) before += 1;
  let after = 0;
  while (completed.has(move(after + 1))) after += 1;
  return { length: before + 1 + after, start: move(-before) };
}
