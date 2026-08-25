import { habitScheduledOnDate, isoDate, scheduledDaysInMonth } from "./tracking";
import type { Category, Habit, HabitCategory } from "./tracker-state";

export type ChartPeriod = "weekly" | "monthly" | "yearly";
export type ChartScope = "general" | "category" | "habit";
export type ChartPoint = { label: string; value: number };
export type HabitChartSeries = { name: string; color: string; data: ChartPoint[] };

type Options = {
  habits: Habit[];
  categories: Category[];
  fallbackCategory: Category;
  selectedHabitId: number;
  selectedCategoryId: HabitCategory;
  period: ChartPeriod;
  scope: ChartScope;
  year: number;
  month: number;
  elapsedDays: number;
  isPastMonth: boolean;
  isCurrentMonth: boolean;
  today: Date;
  monthNames: string[];
  resolveCategory: (habit: Habit) => HabitCategory;
};

export function buildChartMetrics({
  habits, categories, fallbackCategory, selectedHabitId, selectedCategoryId, period, scope,
  year, month, elapsedDays, isPastMonth, isCurrentMonth, today, monthNames, resolveCategory,
}: Options) {
  const selectedHabit = habits.find((habit) => habit.id === selectedHabitId) ?? habits[0];
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? fallbackCategory;
  const checksFor = (habit: Habit, key: string) => habit.history?.[key] ?? [];
  const skipsFor = (habit: Habit, key: string) => habit.skips?.[key] ?? [];

  const dataForHabits = (selectedHabits: Habit[]): ChartPoint[] => {
    if (period === "weekly") {
      if (!isPastMonth && !isCurrentMonth) return [];
      const selectedReference = isCurrentMonth ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : new Date(year, month + 1, 0);
      const rangeStart = new Date(selectedReference);
      rangeStart.setDate(selectedReference.getDate() - 6);
      return Array.from({ length: 7 }, (_, index) => {
        const item = new Date(rangeStart);
        item.setDate(rangeStart.getDate() + index);
        const key = `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, "0")}`;
        const day = item.getDate();
        const dueHabits = selectedHabits.filter((habit) => habitScheduledOnDate(habit, isoDate(item.getFullYear(), item.getMonth(), day)) && !skipsFor(habit, key).includes(day));
        const completed = dueHabits.filter((habit) => checksFor(habit, key).includes(day)).length;
        return {
          label: item.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", ""),
          value: dueHabits.length ? completed / dueHabits.length * 100 : 0,
        };
      });
    }

    if (period === "monthly") {
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      return Array.from({ length: elapsedDays }, (_, index) => {
        const day = index + 1;
        const completed = selectedHabits.reduce((sum, habit) => sum + checksFor(habit, key).filter((value) => value <= day).length, 0);
        const target = selectedHabits.reduce((sum, habit) => {
          const scheduled = habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly ? scheduledDaysInMonth(habit, year, month, day) : Math.min(habit.goal, day);
          return sum + Math.max(0, scheduled - skipsFor(habit, key).filter((value) => value <= day).length);
        }, 0);
        return { label: String(day), value: target ? Math.min(100, completed / target * 100) : 0 };
      });
    }

    const elapsedMonths = year < today.getFullYear() ? 12 : year === today.getFullYear() ? today.getMonth() + 1 : 0;
    return monthNames.slice(0, elapsedMonths).map((label, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      const completed = selectedHabits.reduce((sum, habit) => sum + checksFor(habit, key).length, 0);
      const target = selectedHabits.reduce((sum, habit) => {
        const scheduled = habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly ? scheduledDaysInMonth(habit, year, index) : habit.goal;
        return sum + Math.max(0, scheduled - skipsFor(habit, key).length);
      }, 0);
      return { label: label.slice(0, 3), value: target ? Math.min(100, completed / target * 100) : 0 };
    });
  };

  const allCategoriesSelected = selectedCategoryId === "__all__";
  const allHabitsSelected = selectedHabitId === 0;
  const series: HabitChartSeries[] = scope === "category" && allCategoriesSelected
    ? categories.map((category) => ({ name: category.label, color: category.color, data: dataForHabits(habits.filter((habit) => resolveCategory(habit) === category.id)) }))
    : scope === "habit" && allHabitsSelected
      ? habits.map((habit) => ({ name: habit.name, color: habit.color, data: dataForHabits([habit]) }))
      : scope === "category"
        ? [{ name: selectedCategory.label, color: selectedCategory.color, data: dataForHabits(habits.filter((habit) => resolveCategory(habit) === selectedCategory.id)) }]
        : scope === "habit" && selectedHabit
          ? [{ name: selectedHabit.name, color: selectedHabit.color, data: dataForHabits([selectedHabit]) }]
          : [{ name: "General", color: "#3cc9ab", data: dataForHabits(habits) }];

  const rollingPeriodEnd = isCurrentMonth ? today : new Date(year, month + 1, 0);
  const rollingPeriodStart = new Date(rollingPeriodEnd);
  rollingPeriodStart.setDate(rollingPeriodEnd.getDate() - 6);
  const shortDate = (value: Date) => value.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");

  return {
    selectedHabit,
    selectedCategory,
    allCategoriesSelected,
    allHabitsSelected,
    series,
    rollingPeriodLabel: `${shortDate(rollingPeriodStart)} – ${shortDate(rollingPeriodEnd)}`,
  };
}
