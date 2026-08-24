"use client";

import { useEffect, useRef, useState } from "react";
import { createTrackerBackup, MAX_BACKUP_BYTES, parseTrackerBackup, type BackupPreview } from "../lib/domain/backup";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import {
  calculateProportionalGoalBonus,
  calculateWeightedHabitDays,
  availableDaysForMonthWeek,
  calculateCategoryScores,
  calculateDailyScore,
  calculateWeeklyGoalBonus,
  daysForMonthWeek,
  goalPeriodDetails,
  isoDate,
  isCalendarDayInFuture,
  habitAppliesOnDate,
  habitScheduledOnDate,
  isHabitVisibleInArchive,
  linkedGoalProgress,
  longestHabitStreak,
  monthCalendarWeeks,
  monthlyHabitProgressThrough,
  toggleCompletionForDay,
  weeklyGoalIncludesDate,
  scheduledDaysInMonth,
} from "../lib/domain/tracking";
import type { HabitSchedule } from "../lib/domain/tracking";
import { removeHabitFromGoals, replaceCategory } from "../lib/domain/relationships";
import { parseStoredStringSet, readStoredValue, writeStoredValue } from "../lib/domain/storage";
import { goalsForWeek, previousWeekBounds, shiftWeekBounds, summarizeWeek, weekBounds, type WeeklyReview } from "../lib/domain/weekly-review";
import { generateActionableInsights } from "../lib/domain/insights";
import { Ring, TrendChart, type ChartSeries } from "./components/charts";
import { AuthGate, ResetPassword } from "./components/auth";
import { AppHeader, ClosureNoticeCard, type ClosureNotice, type MainView } from "./components/app-shell";
import { GoalCard } from "./components/goal-card";
import { GoalsView } from "./components/goals-view";
import { HabitsView } from "./components/habits-view";
import { BookEditorDialog, DeleteGoalDialog, FitnessEditorDialog, GoalEditorDialog, GoalTemplateDialog } from "./components/goal-dialogs";
import { HabitEditorDialog } from "./components/habit-editor-dialog";
import { WeeklyHabitTracker } from "./components/weekly-habit-tracker";
import { WeeklyPlanningView } from "./components/weekly-planning-view";
import { TodayView } from "./components/today-view";
import { DailyHabitTracker } from "./components/daily-habit-tracker";
import type { Category, Goal, Habit, HabitCategory, TrackerState, WeeklyHabit } from "../lib/domain/tracker-state";
import { useTrackerSync } from "./hooks/use-tracker-sync";
import { useGoalManager } from "./hooks/use-goal-manager";
import { useGoalTemplates } from "./hooks/use-goal-templates";
import { blockIcons, dailyMotivations, dayNames, defaultCategories, initialDaily, initialWeekly, monthNames, motivationForToday, palette, weeklyBarPalette } from "./config/tracker-defaults";


function inferCategory(name: string): HabitCategory {
  const value = name.toLocaleLowerCase("es");
  if (/famil|hij|pareja|casa|colada|limpieza|compra/.test(value)) return "family";
  if (/trabaj|reuni|oferta|proyecto|correo/.test(value)) return "work";
  if (/ahorr|invert|gasto|finan|presupuesto/.test(value)) return "finance";
  if (/leer|medit|estudi|curso|idioma|aprender/.test(value)) return "growth";
  return "health";
}

function normalizeState(state: TrackerState): Required<TrackerState> {
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
    daily: (state.daily ?? []).map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) })),
    weekly: (state.weekly ?? []).map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) })),
    categories,
    motivations: state.motivations?.filter((item) => item.trim()) ?? [],
    goals: state.goals ?? [],
    weeklyReviews: state.weeklyReviews ?? [],
  };
}

function streakContaining(history: Record<string, number[]> | undefined, target: string) {
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

export default function Home() {
  const [mainView, setMainView] = useState<MainView>("summary");
  const [dayViewDate, setDayViewDate] = useState(() => new Date());
  const today = new Date();
  const {
    daily, setDaily, weekly, setWeekly, habitCategories, setHabitCategories, motivations, setMotivations,
    goals, setGoals, weeklyReviews, setWeeklyReviews, hydrated, syncStatus, session, authReady,
    passwordRecovery, completePasswordRecovery, resolveConflictWithRemote, resolveConflictWithLocal,
  } = useTrackerSync({
    initialState: { daily: initialDaily, weekly: initialWeekly, categories: defaultCategories, motivations: dailyMotivations, goals: [], weeklyReviews: [] },
    fallbackMotivations: dailyMotivations,
    normalizeState,
  });
  const {
    goalModalOpen, goalTitle, setGoalTitle, goalPeriod, setGoalPeriod, goalMeasurement, setGoalMeasurement,
    goalTarget, setGoalTarget, goalUnit, setGoalUnit, goalCategory, setGoalCategory,
    goalLinkedHabitIds, setGoalLinkedHabitIds, goalParentAnnualId, setGoalParentAnnualId,
    goalFilter, setGoalFilter, goalCategoryFilter, setGoalCategoryFilter, draggingGoalId,
    goalProgressDrafts, setGoalProgressDrafts, planningGoalId, goalStepDraft, setGoalStepDraft,
    editingGoalId, deletingGoal, setDeletingGoal, openNewGoal, closeGoalModal, createGoal, startGoalEdit,
    updateGoalProgress, markGoalNotCompleted, addGoalProgress, beginGoalPlanning, cancelGoalPlanning,
    addGoalStep, toggleGoalStep, removeGoalStep, deleteGoal, archiveGoal, restoreGoal,
    moveWeeklyGoalToCurrentWeek, startGoalPointerDrag, moveGoalPointerDrag, finishGoalPointerDrag, cancelGoalPointerDrag,
  } = useGoalManager({ setGoals, today });
  const {
    templateModal, setTemplateModal, templateHabitIds, setTemplateHabitIds, readingTarget, setReadingTarget,
    bookGoal, bookTitle, setBookTitle, bookAuthor, setBookAuthor, bookFormat, setBookFormat,
    bookStatus, setBookStatus, editingBookId, fitnessGoal, setFitnessGoal, fitnessDraft, setFitnessDraft,
    fitnessMetric, setFitnessMetric, fitnessPeriod, setFitnessPeriod, fitnessImporting, fitnessImportMessage,
    createTemplateGoal, isBookCompleted, openBookEditor, closeBookEditor, saveBook, completeBook, removeBook,
    saveFitnessEntry, importSamsungHealth, yearlyHabitPercent, closeFitnessEditor,
  } = useGoalTemplates({ goals, setGoals, daily, today, setGoalFilter });
  const [weeklyPlanDraft, setWeeklyPlanDraft] = useState({ priorities: ["", "", ""], adjustment: "", reflection: "" });
  const [weeklyPlanSaved, setWeeklyPlanSaved] = useState(false);
  const [reviewWeekKey, setReviewWeekKey] = useState(() => previousWeekBounds(new Date()).key);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(() => new Set());
  const [closureNotice, setClosureNotice] = useState<ClosureNotice | null>(null);
  const [motivationManagerOpen, setMotivationManagerOpen] = useState(false);
  const [motivationDraft, setMotivationDraft] = useState("");
  const [editingMotivationIndex, setEditingMotivationIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const [collapsedHabitBlocks, setCollapsedHabitBlocks] = useState<Set<string>>(() => new Set());
  const [date, setDate] = useState(() => new Date());
  const [modal, setModal] = useState<null | "daily" | "weekly">(null);
  const [editing, setEditing] = useState<{ type: "daily" | "weekly"; id: number } | null>(null);
  const [deleting, setDeleting] = useState<{ type: "daily" | "weekly"; id: number; name: string } | null>(null);
  const [actionHabit, setActionHabit] = useState<{ type: "daily" | "weekly"; habit: Habit } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const [dragging, setDragging] = useState<{ type: "daily" | "weekly"; id: number } | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [chartScope, setChartScope] = useState<"general" | "category" | "habit">("general");
  const [rankingView, setRankingView] = useState<"best" | "watch" | "streak">("best");
  const [selectedChartCategory, setSelectedChartCategory] = useState<HabitCategory>("health");
  const [selectedHabitId, setSelectedHabitId] = useState<number>(initialDaily[0].id);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState(12);
  const [, setEveryDay] = useState(false);
  const [, setWeekdaysOnly] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"monthly" | "daily" | "weekdays" | "selectedWeekdays" | "interval">("monthly");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState(2);
  const [scheduleStart, setScheduleStart] = useState(() => isoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const [activeFrom, setActiveFrom] = useState("");
  const [activeUntil, setActiveUntil] = useState("");
  const [pausedFrom, setPausedFrom] = useState("");
  const [pausedUntil, setPausedUntil] = useState("");
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>("health");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [archivedManagerOpen, setArchivedManagerOpen] = useState(false);
  const [backupManagerOpen, setBackupManagerOpen] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<HabitCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(defaultCategories[0].color);
  const [categoryIcon, setCategoryIcon] = useState("●");
  const [deletingCategoryId, setDeletingCategoryId] = useState<HabitCategory | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState<HabitCategory>("health");
  const [streakCelebration, setStreakCelebration] = useState<{ name: string; color: string } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!session) { queueMicrotask(() => setDismissedInsights(new Set())); return; }
    const key = `brujula-dismissed-insights-v1:${session.user.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>;
      const now = Date.now();
      const active = Object.entries(stored).filter(([, expiresAt]) => Number(expiresAt) > now);
      queueMicrotask(() => setDismissedInsights(new Set(active.map(([id]) => id))));
      localStorage.setItem(key, JSON.stringify(Object.fromEntries(active)));
    } catch { queueMicrotask(() => setDismissedInsights(new Set())); }
  }, [session]);

  function toggleHabitBlock(scope: "today-daily" | "today-weekly" | "habits-daily" | "habits-weekly", categoryId: HabitCategory) {
    const key = `${scope}:${categoryId}`;
    setCollapsedHabitBlocks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isHabitBlockCollapsed(scope: "today-daily" | "today-weekly" | "habits-daily" | "habits-weekly", categoryId: HabitCategory) {
    return collapsedHabitBlocks.has(`${scope}:${categoryId}`);
  }

  function exportBackup() {
    const backup = createTrackerBackup({ daily, weekly, categories: habitCategories, motivations, goals, weeklyReviews });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `brujula-copia-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function inspectBackup(file?: File) {
    setBackupPreview(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setBackupMessage("La copia supera el límite de 10 MB."); return; }
    const result = parseTrackerBackup(await file.text());
    if (!result.success) { setBackupMessage(result.error); return; }
    setBackupPreview(result.preview);
    setBackupMessage("");
  }

  function restoreBackup() {
    if (!backupPreview) return;
    const restored = backupPreview.backup.state;
    setDaily(restored.daily as Habit[]);
    setWeekly(restored.weekly as WeeklyHabit[]);
    setHabitCategories(restored.categories as Category[]);
    setMotivations(restored.motivations?.length ? restored.motivations : dailyMotivations);
    setGoals((restored.goals ?? []) as Goal[]);
    setWeeklyReviews((restored.weeklyReviews ?? []) as WeeklyReview[]);
    setBackupPreview(null);
    setBackupManagerOpen(false);
    setBackupMessage("Copia restaurada. Los datos se sincronizarán automáticamente.");
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const days = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  const todayNumber = isCurrentMonth ? today.getDate() : null;
  const elapsedDays = isPastMonth ? days : isCurrentMonth ? today.getDate() : 0;
  const monthStartMondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const calendar = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const dayOfWeek = new Date(year, month, day).getDay();
    const calendarWeek = Math.floor((monthStartMondayOffset + i) / 7);
    return {
      day,
      week: calendarWeek + 1,
      weekEnd: dayOfWeek === 0,
      weekShaded: calendarWeek % 2 === 1,
      label: dayNames[dayOfWeek],
    };
  });

  useEffect(() => {
    if (!hydrated || activeTab !== "daily" || !todayNumber) return;
    const frame = requestAnimationFrame(() => {
      const container = tableScrollRef.current;
      const todayHeader = container?.querySelector<HTMLElement>(".today-header");
      if (!container || !todayHeader) return;
      const target = todayHeader.offsetLeft - container.clientWidth / 2 + todayHeader.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, hydrated, month, todayNumber, year]);

  const activeDaily = daily.filter((habit) => !habit.archived);
  const activeWeekly = weekly.filter((habit) => !habit.archived);
  const archivedHabits = [
    ...daily.filter((habit) => isHabitVisibleInArchive(habit, today)).map((habit) => ({ type: "daily" as const, habit })),
    ...weekly.filter((habit) => isHabitVisibleInArchive(habit, today)).map((habit) => ({ type: "weekly" as const, habit })),
  ];
  const checksFor = (habit: Habit, key = monthKey) => habit.history?.[key] ?? [];
  const weeklyChecksFor = (habit: WeeklyHabit, key = monthKey) => habit.history?.[key] ?? [];
  const missesFor = (habit: Habit | WeeklyHabit, key = monthKey) => habit.misses?.[key] ?? [];
  const skipsFor = (habit: Habit | WeeklyHabit, key = monthKey) => habit.skips?.[key] ?? [];
  const goalFor = (habit: Habit) => habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly
    ? scheduledDaysInMonth(habit, year, month)
    : habit.goal;
  const evaluatedThrough = isCurrentMonth ? today.getDate() : isPastMonth ? days : 0;
  const evaluatedHabitProgress = activeDaily.map((habit) => monthlyHabitProgressThrough(habit, year, month, evaluatedThrough));
  const totalChecks = evaluatedHabitProgress.reduce((sum, progress) => sum + progress.completed, 0);
  const totalGoal = evaluatedHabitProgress.reduce((sum, progress) => sum + progress.eligible, 0);
  const globalProgress = totalGoal ? (totalChecks / totalGoal) * 100 : 0;
  const scoreFromPercent = (percent: number) => Math.min(10, Math.max(0, percent / 10));
  const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dailyScoreForDate = (value: Date) => calculateDailyScore(value, daily, weekly, habitCategories);
  const referenceDay = isCurrentMonth ? today.getDate() : days;
  const referenceDate = new Date(year, month, referenceDay);
  const mondayOffset = (referenceDate.getDay() + 6) % 7;
  const weekStart = Math.max(1, referenceDay - mondayOffset);
  const weekEnd = Math.min(days, weekStart + 6);
  const evaluatedWeekEnd = isCurrentMonth ? Math.min(weekEnd, today.getDate()) : weekEnd;
  const habitsScheduledForDay = (day: number) => {
    const dateKey = isoDate(year, month, day);
    return daily.filter((habit) => habitScheduledOnDate(habit, dateKey) && !skipsFor(habit).includes(day));
  };
  const referenceDayHabits = habitsScheduledForDay(referenceDay);
  const dayChecks = referenceDayHabits.filter((habit) => checksFor(habit).includes(referenceDay)).length;
  const currentDayProgress = referenceDayHabits.length ? dayChecks / referenceDayHabits.length * 100 : 0;
  const pastMonthDailyValues = isPastMonth
    ? Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const scheduled = habitsScheduledForDay(day);
        const completed = scheduled.filter((habit) => checksFor(habit).includes(day)).length;
        return scheduled.length ? completed / scheduled.length * 100 : null;
      }).filter((progress): progress is number => progress !== null)
    : [];
  const pastMonthDailyProgress = pastMonthDailyValues.length
    ? pastMonthDailyValues.reduce((sum, progress) => sum + progress, 0) / pastMonthDailyValues.length
    : 0;
  const dayProgress = isPastMonth ? pastMonthDailyProgress : currentDayProgress;
  const weekDates = Array.from({ length: Math.max(0, evaluatedWeekEnd - weekStart + 1) }, (_, index) => new Date(year, month, weekStart + index));
  const adjustedWeekBaseScore = weekDates.length ? weekDates.reduce((sum, item) => sum + dailyScoreForDate(item).finalScore, 0) / weekDates.length : 0;
  const referenceDateKey = isoDate(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const currentWeeklyGoals = goals
    .filter((goal) => goal.period === "weekly" && weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, referenceDateKey) && goal.status !== "discarded")
    .map((goal) => {
      if (!(goal.linkedHabitIds?.length || goal.linkedHabitId)) return goal;
      const currentValue = linkedGoalProgress(goal, daily);
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    });
  const weeklyGoalResult = calculateWeeklyGoalBonus(adjustedWeekBaseScore, currentWeeklyGoals);
  const weeklyGoalBonus = weeklyGoalResult.bonus;
  const weekScore = weeklyGoalResult.finalScore;
  const currentDayBreakdown = dailyScoreForDate(referenceDate);
  const dayScore = isPastMonth ? scoreFromPercent(dayProgress) : currentDayBreakdown.finalScore;
  const dayScoreTitle = isPastMonth ? "Nota media diaria" : "Nota del día";
  const dayScoreDetail = isPastMonth
    ? `Media de ${pastMonthDailyValues.length} días con hábitos en ${monthNames[month].toLowerCase()}`
    : `${dayChecks} de ${referenceDayHabits.length} hábitos completados${currentDayBreakdown.bonus > 0 ? ` · +${scoreLabel(currentDayBreakdown.bonus)} bonus` : ""}`;
  const monthScore = scoreFromPercent(globalProgress);
  const habitCompletion = (habit: Habit) => {
    const progress = monthlyHabitProgressThrough(habit, year, month, evaluatedThrough);
    return progress.percent / 100;
  };
  const ranked = [...daily].filter((habit) => !habit.archived).sort((a, b) => habitCompletion(b) - habitCompletion(a));
  const streakRanked = [...daily].filter((habit) => !habit.archived).sort((a, b) => longestHabitStreak(b) - longestHabitStreak(a));
  const rankingItems = rankingView === "best" ? ranked : rankingView === "watch" ? [...ranked].reverse() : streakRanked;
  const longestVisibleStreak = Math.max(1, ...streakRanked.slice(0, 5).map(longestHabitStreak));
  const monthWeeks = monthCalendarWeeks(year, month);
  const currentMonthWeek = isCurrentMonth ? monthWeeks.findIndex((week) => week.includes(today.getDate())) + 1 : 0;
  const weeklyProgress = monthWeeks.map((weekDays) => {
    const start = weekDays[0];
    const end = weekDays.at(-1)!;
    const projected = !isPastMonth && new Date(year, month, start) > today;
    const evaluatedEnd = projected ? start - 1 : Math.min(end, isCurrentMonth ? today.getDate() : end);
    let completed = 0; let possible = 0;
    for (let day = start; day <= evaluatedEnd; day += 1) {
      const scheduled = habitsScheduledForDay(day); possible += scheduled.length;
      completed += scheduled.filter((habit) => checksFor(habit).includes(day)).length;
    }
    return { value: projected ? null : possible ? Math.round(completed / possible * 100) : 0, projected, range: `${start}–${end} ${monthNames[month].slice(0, 3).toLowerCase()}` };
  });
  const selectedHabit = activeDaily.find((habit) => habit.id === selectedHabitId) ?? activeDaily[0];
  const allCategoriesSelected = selectedChartCategory === "__all__";
  const allHabitsSelected = selectedHabitId === 0;
  const selectedCategoryMeta = habitCategories.find((category) => category.id === selectedChartCategory) ?? habitCategories[0] ?? defaultCategories[0];
  const dataForHabits = (habits: Habit[]) => {
    if (chartPeriod === "weekly") {
      if (!isPastMonth && !isCurrentMonth) return [];
      const selectedReference = isCurrentMonth ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : new Date(year, month + 1, 0);
      const rangeStart = new Date(selectedReference);
      rangeStart.setDate(selectedReference.getDate() - 6);
      const weekDates = Array.from({ length: 7 }, (_, index) => {
        const item = new Date(rangeStart);
        item.setDate(rangeStart.getDate() + index);
        return item;
      });
      return weekDates.map((item) => {
        const key = `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, "0")}`;
        const day = item.getDate();
        const dueHabits = habits.filter((habit) => habitScheduledOnDate(habit, isoDate(item.getFullYear(), item.getMonth(), day)) && !(habit.skips?.[key] ?? []).includes(day));
        const completed = dueHabits.filter((habit) => checksFor(habit, key).includes(day)).length;
        const label = item.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");
        return { label, value: dueHabits.length ? completed / dueHabits.length * 100 : 0 };
      });
    }
    if (chartPeriod === "monthly") {
      return Array.from({ length: elapsedDays }, (_, index) => {
        const day = index + 1;
        const completed = habits.reduce((sum, habit) => sum + checksFor(habit).filter((value) => value <= day).length, 0);
        const target = habits.reduce((sum, habit) => {
          const scheduled = habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly ? scheduledDaysInMonth(habit, year, month, day) : Math.min(habit.goal, day);
          return sum + Math.max(0, scheduled - skipsFor(habit).filter((value) => value <= day).length);
        }, 0);
        return { label: String(day), value: target ? Math.min(100, completed / target * 100) : 0 };
      });
    }
    const elapsedMonths = year < today.getFullYear()
      ? 12
      : year === today.getFullYear()
        ? today.getMonth() + 1
        : 0;
    return monthNames.slice(0, elapsedMonths).map((label, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      const completed = habits.reduce((sum, habit) => sum + checksFor(habit, key).length, 0);
      const target = habits.reduce((sum, habit) => {
        const scheduled = habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly ? scheduledDaysInMonth(habit, year, index) : habit.goal;
        return sum + Math.max(0, scheduled - skipsFor(habit, key).length);
      }, 0);
      return { label: label.slice(0, 3), value: target ? Math.min(100, completed / target * 100) : 0 };
    });
  };
  const chartSeries: ChartSeries[] = chartScope === "category" && allCategoriesSelected
    ? habitCategories.map((category) => ({ name: category.label, color: category.color, data: dataForHabits(activeDaily.filter((habit) => (habit.category ?? inferCategory(habit.name)) === category.id)) }))
    : chartScope === "habit" && allHabitsSelected
      ? activeDaily.map((habit) => ({ name: habit.name, color: habit.color, data: dataForHabits([habit]) }))
      : chartScope === "category"
        ? [{ name: selectedCategoryMeta.label, color: selectedCategoryMeta.color, data: dataForHabits(activeDaily.filter((habit) => (habit.category ?? inferCategory(habit.name)) === selectedCategoryMeta.id)) }]
        : chartScope === "habit" && selectedHabit
          ? [{ name: selectedHabit.name, color: selectedHabit.color, data: dataForHabits([selectedHabit]) }]
          : [{ name: "General", color: "#3cc9ab", data: dataForHabits(activeDaily) }];
  const rollingPeriodEnd = isCurrentMonth ? today : new Date(year, month + 1, 0);
  const rollingPeriodStart = new Date(rollingPeriodEnd);
  rollingPeriodStart.setDate(rollingPeriodEnd.getDate() - 6);
  const shortDate = (value: Date) => value.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  const rollingPeriodLabel = `${shortDate(rollingPeriodStart)} – ${shortDate(rollingPeriodEnd)}`;
  function shiftMonth(direction: number) {
    setDate(new Date(year, month + direction, 1));
  }

  function toggleDaily(id: number, day: number) {
    const habit = daily.find((item) => item.id === id);
    if (habit && !habitScheduledOnDate(habit, isoDate(year, month, day))) return;
    const current = habit ? checksFor(habit) : [];
    if (isCalendarDayInFuture(year, month, day, today) && !current.includes(day)) return;
    setDaily((items) => items.map((habit) => {
      if (habit.id !== id) return habit;
      const current = checksFor(habit);
      const isRemoving = current.includes(day);
      const next = toggleCompletionForDay(current, day);
      const history = { ...(habit.history ?? {}), [monthKey]: next };
      const misses = { ...(habit.misses ?? {}), [monthKey]: missesFor(habit).filter((item) => item !== day) };
      const skips = { ...(habit.skips ?? {}), [monthKey]: skipsFor(habit).filter((item) => item !== day) };
      if (!isRemoving) {
        const streak = streakContaining(history, isoDate(year, month, day));
        if (streak.length >= 30 && habit.celebratedStreak30 !== streak.start) {
          setStreakCelebration({ name: habit.name, color: habit.color });
          return { ...habit, history, misses, skips, celebratedStreak30: streak.start };
        }
      }
      return { ...habit, history, misses, skips };
    }));
  }

  function cycleException(type: "daily" | "weekly", id: number, targetDate: Date) {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const day = targetDate.getDate();
    if (isCalendarDayInFuture(targetYear, targetMonth, day, today)) return;
    const key = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
    const update = (item: Habit | WeeklyHabit) => {
      if (item.id !== id) return item;
      if (type === "daily" && !habitScheduledOnDate(item, isoDate(targetYear, targetMonth, day))) return item;
      const history = { ...(item.history ?? {}), [key]: (item.history?.[key] ?? []).filter((value) => value !== day) };
      const wasMissed = (item.misses?.[key] ?? []).includes(day);
      const wasSkipped = (item.skips?.[key] ?? []).includes(day);
      const misses = { ...(item.misses ?? {}), [key]: wasMissed ? (item.misses?.[key] ?? []).filter((value) => value !== day) : wasSkipped ? (item.misses?.[key] ?? []).filter((value) => value !== day) : Array.from(new Set([...(item.misses?.[key] ?? []), day])).sort((a, b) => a - b) };
      const skips = { ...(item.skips ?? {}), [key]: wasMissed ? Array.from(new Set([...(item.skips?.[key] ?? []), day])).sort((a, b) => a - b) : (item.skips?.[key] ?? []).filter((value) => value !== day) };
      return { ...item, history, misses, skips };
    };
    if (type === "daily") setDaily((items) => items.map(update) as Habit[]);
    else setWeekly((items) => items.map(update) as WeeklyHabit[]);
  }

  function longPressProps(onTap: () => void, onLongPress: () => void) {
    const cancel = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    };
    return {
      onPointerDown: () => {
        longPressTriggered.current = false;
        cancel();
        longPressTimer.current = setTimeout(() => {
          longPressTriggered.current = true;
          onLongPress();
        }, 550);
      },
      onPointerUp: () => {
        cancel();
        if (!longPressTriggered.current) onTap();
      },
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    };
  }

  function toggleDayViewHabit(id: number) {
    const currentYear = dayViewDate.getFullYear();
    const currentMonth = dayViewDate.getMonth();
    const currentDay = dayViewDate.getDate();
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const habit = daily.find((item) => item.id === id);
    if (habit && !habitScheduledOnDate(habit, isoDate(currentYear, currentMonth, currentDay))) return;
    setDaily((items) => items.map((item) => {
      if (item.id !== id) return item;
      const current = item.history?.[key] ?? [];
      const next = toggleCompletionForDay(current, currentDay);
      return { ...item, history: { ...(item.history ?? {}), [key]: next }, misses: { ...(item.misses ?? {}), [key]: (item.misses?.[key] ?? []).filter((day) => day !== currentDay) }, skips: { ...(item.skips ?? {}), [key]: (item.skips?.[key] ?? []).filter((day) => day !== currentDay) } };
    }));
  }

  function toggleDayViewWeeklyHabit(id: number) {
    const key = `${dayViewDate.getFullYear()}-${String(dayViewDate.getMonth() + 1).padStart(2, "0")}`;
    setWeekly((items) => items.map((item) => {
      if (item.id !== id) return item;
      const current = item.history?.[key] ?? [];
      const next = toggleCompletionForDay(current, dayViewDate.getDate());
      return { ...item, history: { ...(item.history ?? {}), [key]: next }, misses: { ...(item.misses ?? {}), [key]: (item.misses?.[key] ?? []).filter((day) => day !== dayViewDate.getDate()) }, skips: { ...(item.skips ?? {}), [key]: (item.skips?.[key] ?? []).filter((day) => day !== dayViewDate.getDate()) } };
    }));
  }

  function changeWeeklyCount(id: number, week: number, direction: 1 | -1) {
    setWeekly((items) => items.map((habit) => {
      if (habit.id !== id) return habit;
      const current = weeklyChecksFor(habit);
      const weekDays = daysForMonthWeek(year, month, week);
      const availableDays = availableDaysForMonthWeek(year, month, week, today);
      const weekChecks = current.filter((day) => weekDays.includes(day)).sort((a, b) => a - b);
      let next = current;
      if (direction === 1 && weekChecks.length < availableDays.length) {
        const availableDay = availableDays.find((day) => !current.includes(day));
        if (availableDay) next = [...current, availableDay].sort((a, b) => a - b);
      }
      if (direction === -1 && weekChecks.length) {
        const lastDay = weekChecks.at(-1)!;
        next = current.filter((day) => day !== lastDay);
      }
      return { ...habit, history: { ...(habit.history ?? {}), [monthKey]: next } };
    }));
  }

  function buildSchedule(): HabitSchedule | undefined {
    const customMode = scheduleMode === "selectedWeekdays" || scheduleMode === "interval";
    if (!customMode && !activeFrom && !activeUntil && !(pausedFrom && pausedUntil)) return undefined;
    return {
      ...(customMode ? { mode: scheduleMode } : {}),
      ...(scheduleMode === "selectedWeekdays" ? { weekdays: [...selectedWeekdays].sort((a, b) => a - b) } : scheduleMode === "interval" ? { intervalDays, startDate: scheduleStart } : {}),
      ...(activeFrom ? { activeFrom } : {}),
      ...(activeUntil ? { activeUntil } : {}),
      ...(pausedFrom && pausedUntil ? { pausedFrom, pausedUntil } : {}),
    };
  }

  function resetScheduleDraft() {
    setScheduleMode("monthly");
    setSelectedWeekdays([1, 3, 5]);
    setIntervalDays(2);
    setScheduleStart(isoDate(today.getFullYear(), today.getMonth(), today.getDate()));
    setActiveFrom("");
    setActiveUntil("");
    setPausedFrom("");
    setPausedUntil("");
  }

  function addHabit() {
    if (!newName.trim() || !modal) return;
    const color = palette[(daily.length + weekly.length) % palette.length];
    if (modal === "daily") {
      const schedule = buildSchedule();
      setDaily((items) => {
        const draft = { id: Date.now(), name: newName.trim(), goal: newGoal, everyDay: scheduleMode === "daily", weekdaysOnly: scheduleMode === "weekdays", schedule, color, checks: [], category: selectedCategory };
        return [...items, { ...draft, goal: schedule?.mode || draft.everyDay || draft.weekdaysOnly ? scheduledDaysInMonth(draft, year, month) : newGoal }];
      });
    } else {
      setWeekly((items) => [...items, { id: Date.now(), name: newName.trim(), goal: Math.min(7, Math.max(1, newGoal)), color, checks: [], category: selectedCategory }]);
    }
    setNewName("");
    setNewGoal(12);
    setEveryDay(false);
    setWeekdaysOnly(false);
    resetScheduleDraft();
    setSelectedCategory("health");
    setModal(null);
  }

  function startEdit(type: "daily" | "weekly", habit: Habit) {
    setEditing({ type, id: habit.id });
    setNewName(habit.name);
    setNewGoal(habit.goal);
    setEveryDay(Boolean(habit.everyDay));
    setWeekdaysOnly(Boolean(habit.weekdaysOnly));
    setScheduleMode(type === "weekly" ? "monthly" : habit.schedule?.mode ?? (habit.everyDay ? "daily" : habit.weekdaysOnly ? "weekdays" : "monthly"));
    setSelectedWeekdays(habit.schedule?.weekdays ?? [1, 3, 5]);
    setIntervalDays(habit.schedule?.intervalDays ?? 2);
    setScheduleStart(habit.schedule?.startDate ?? isoDate(today.getFullYear(), today.getMonth(), today.getDate()));
    setActiveFrom(habit.schedule?.activeFrom ?? "");
    setActiveUntil(habit.schedule?.activeUntil ?? "");
    setPausedFrom(habit.schedule?.pausedFrom ?? "");
    setPausedUntil(habit.schedule?.pausedUntil ?? "");
    setSelectedColor(habit.color);
    setSelectedCategory(habit.category ?? inferCategory(habit.name));
    setActionHabit(null);
  }

  function saveEdit() {
    if (!editing || !newName.trim()) return;
    const update = (habit: Habit) => {
      if (habit.id !== editing.id) return habit;
      const schedule = editing.type === "daily" ? buildSchedule() : undefined;
      const next = { ...habit, name: newName.trim(), goal: editing.type === "weekly" ? Math.min(7, Math.max(1, newGoal)) : newGoal, everyDay: editing.type === "daily" && scheduleMode === "daily", weekdaysOnly: editing.type === "daily" && scheduleMode === "weekdays", schedule, color: selectedColor, category: selectedCategory };
      return { ...next, goal: editing.type === "daily" && (schedule?.mode || next.everyDay || next.weekdaysOnly) ? scheduledDaysInMonth(next, year, month) : next.goal };
    };
    if (editing.type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
    setEditing(null);
    setNewName("");
    setEveryDay(false);
    setWeekdaysOnly(false);
    resetScheduleDraft();
    setSelectedColor(palette[0]);
    setSelectedCategory("health");
  }

  function archiveHabit(type: "daily" | "weekly", id: number) {
    const update = (habit: Habit) => habit.id === id ? { ...habit, archived: true, archivedAt: isoDate(today.getFullYear(), today.getMonth(), today.getDate()) } : habit;
    if (type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
    setActionHabit(null);
  }

  function restoreHabit(type: "daily" | "weekly", id: number) {
    const update = (habit: Habit) => habit.id === id ? { ...habit, archived: false, archivedAt: undefined } : habit;
    if (type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
  }

  function deleteHabit() {
    if (!deleting) return;
    if (deleting.type === "daily") setDaily((items) => items.filter((habit) => habit.id !== deleting.id));
    else setWeekly((items) => items.filter((habit) => habit.id !== deleting.id));
    setGoals((items) => removeHabitFromGoals(items, deleting.id));
    setDeleting(null);
  }

  function reorderHabit(type: "daily" | "weekly", sourceId: number, targetId: number) {
    const reorder = <T extends Habit>(items: T[]) => {
      const from = items.findIndex((habit) => habit.id === sourceId);
      const to = items.findIndex((habit) => habit.id === targetId);
      if (from < 0 || to < 0 || from === to) return items;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    };
    if (type === "daily") setDaily((items) => reorder(items));
    else setWeekly((items) => reorder(items));
    setDragging(null);
  }

  function startCategoryEdit(category?: Category) {
    setEditingCategoryId(category?.id ?? null);
    setCategoryName(category?.label ?? "");
    setCategoryColor(category?.color ?? palette[habitCategories.length % palette.length]);
    setCategoryIcon(category?.icon ?? "●");
  }

  function saveCategory() {
    const label = categoryName.trim();
    if (!label) return;
    if (editingCategoryId) {
      setHabitCategories((items) => items.map((category) => category.id === editingCategoryId ? { ...category, label, color: categoryColor, icon: categoryIcon.trim().slice(0, 2) || "●" } : category));
    } else {
      const id = `block-${Date.now()}`;
      setHabitCategories((items) => [...items, { id, label, color: categoryColor, icon: categoryIcon.trim().slice(0, 2) || "●" }]);
      setSelectedCategory(id);
    }
    setEditingCategoryId(null);
    setCategoryName("");
  }

  function toggleCategoryPriority(categoryId: HabitCategory) {
    setHabitCategories((items) => items.map((category) => category.id === categoryId ? { ...category, priority: !category.priority } : category));
  }

  function requestCategoryDelete(categoryId: HabitCategory) {
    const replacement = habitCategories.find((category) => category.id !== categoryId);
    if (!replacement) return;
    setDeletingCategoryId(categoryId);
    setReplacementCategoryId(replacement.id);
  }

  function deleteCategory() {
    if (!deletingCategoryId || deletingCategoryId === replacementCategoryId) return;
    setDaily((items) => replaceCategory(items, deletingCategoryId, replacementCategoryId));
    setWeekly((items) => replaceCategory(items, deletingCategoryId, replacementCategoryId));
    setGoals((items) => replaceCategory(items, deletingCategoryId, replacementCategoryId));
    setHabitCategories((items) => items.filter((category) => category.id !== deletingCategoryId));
    if (selectedChartCategory === deletingCategoryId) setSelectedChartCategory(replacementCategoryId);
    if (selectedCategory === deletingCategoryId) setSelectedCategory(replacementCategoryId);
    setDeletingCategoryId(null);
  }

  function saveMotivation() {
    const text = motivationDraft.trim().replace(/\s+/g, " ");
    if (!text) return;
    if (editingMotivationIndex === null) {
      if (!motivations.some((item) => item.toLocaleLowerCase("es") === text.toLocaleLowerCase("es"))) {
        setMotivations((items) => [...items, text]);
      }
    } else {
      setMotivations((items) => items.map((item, index) => index === editingMotivationIndex ? text : item));
    }
    setMotivationDraft("");
    setEditingMotivationIndex(null);
  }

  function editMotivation(index: number) {
    setMotivationDraft(motivations[index]);
    setEditingMotivationIndex(index);
  }

  function deleteMotivation(index: number) {
    setMotivations((items) => items.filter((_, itemIndex) => itemIndex !== index));
    if (editingMotivationIndex === index) {
      setMotivationDraft("");
      setEditingMotivationIndex(null);
    }
  }

  const progressResolvedGoals = goals.map((goal) => {
    if (goal.status === "discarded") return goal;
    if (goal.template === "reading") {
      const currentValue = (goal.books ?? []).filter(isBookCompleted).length;
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    }
    if (goal.template === "fitness") {
      const ids = goal.linkedHabitIds ?? [];
      const currentValue = calculateWeightedHabitDays(daily, ids, goal.trackingStart, today);
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    }
    if (!(goal.linkedHabitIds?.length || goal.linkedHabitId)) return goal;
    const currentValue = linkedGoalProgress(goal, daily);
    return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
  });
  const resolvedGoals = progressResolvedGoals.map((goal) => {
    if (goal.period !== "yearly") return goal;
    const milestones = progressResolvedGoals.filter((item) => (item.period === "weekly" || item.period === "monthly")
      && item.parentAnnualGoalId === goal.id
      && item.status !== "discarded");
    if (!milestones.length) return goal;
    const completed = milestones.filter((item) => item.status === "completed").length;
    return {
      ...goal,
      currentValue: completed,
      targetValue: milestones.length,
      unit: "hitos",
      status: completed === milestones.length ? "completed" as const : "active" as const,
    };
  });
  const archivedGoals = resolvedGoals.filter((goal) => goal.archived && goal.status !== "discarded");
  const archivedCount = archivedHabits.length + archivedGoals.length;
  const realTodayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const visibleGoals = resolvedGoals.filter((goal) => goal.period === goalFilter
    && goal.status !== "discarded"
    && !goal.archived
    && (goalCategoryFilter === "all" || goal.category === goalCategoryFilter)
    && (goal.period !== "weekly" || weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, realTodayKey) || (goal.status === "active" && goal.dueDate < realTodayKey)));
  const activeGoals = resolvedGoals.filter((goal) => goal.status === "active" && !goal.archived);
  const actionableInsights = generateActionableInsights(today, daily, habitCategories, resolvedGoals).filter((insight) => !dismissedInsights.has(insight.id));
  const dayViewKey = isoDate(dayViewDate.getFullYear(), dayViewDate.getMonth(), dayViewDate.getDate());
  const dayViewMonthKey = dayViewKey.slice(0, 7);
  const dayViewWeekIndex = monthCalendarWeeks(dayViewDate.getFullYear(), dayViewDate.getMonth()).findIndex((week) => week.includes(dayViewDate.getDate())) + 1;
  const dayViewHabits = daily.filter((habit) => habitScheduledOnDate(habit, dayViewKey));
  const dayViewHabitGroups = habitCategories.map((category) => ({ category, habits: dayViewHabits.filter((habit) => habit.category === category.id) })).filter((group) => group.habits.length);
  const dayViewWeekly = weekly.filter((habit) => habitAppliesOnDate(habit, dayViewKey));
  const weeklyHabitGroups = habitCategories.map((category) => ({ category, habits: dayViewWeekly.filter((habit) => habit.category === category.id) })).filter((group) => group.habits.length);
  const dayViewGoals = resolvedGoals.filter((goal) => !goal.archived)
    .filter((goal) => goal.period === "daily" ? goal.periodKey === dayViewKey : goal.period === "weekly" ? weeklyGoalIncludesDate(goal.periodKey, goal.dueDate, dayViewKey) : goal.dueDate >= dayViewKey)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  const dayViewScore = calculateDailyScore(dayViewDate, daily, weekly, habitCategories);
  const dayViewCategoryScores = new Map(calculateCategoryScores(dayViewDate, dayViewHabits, habitCategories).map((score) => [score.categoryId, score]));
  const dayViewCompleted = dayViewHabits.filter((habit) => (habit.history?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate())).length;
  const isViewingToday = dayViewKey === realTodayKey;

  function shiftDayView(direction: -1 | 1) {
    setDayViewDate((current) => {
      const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction);
      return next > new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? current : next;
    });
  }

  useEffect(() => {
    if (!hydrated || !session || closureNotice || mainView !== "summary") return;
    const deliveredKey = `brujula-closure-notices-v1:${session.user.id}`;
    const delivered = parseStoredStringSet(readStoredValue(localStorage, deliveredKey));
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayKey = `daily:${isoDate(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())}`;
    const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthlyKey = `monthly:${previousMonthKey}`;
    const previousYear = now.getFullYear() - 1;
    const yearlyKey = `yearly:${previousYear}`;
    let nextNotice: ClosureNotice | null = null;

    const averageScore = (start: Date, end: Date) => {
      let total = 0; let count = 0;
      const cursor = new Date(start);
      while (cursor <= end) {
        total += calculateDailyScore(cursor, daily, weekly, habitCategories).finalScore;
        count += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
      return count ? total / count : 0;
    };

    if (!delivered.has(yearlyKey)) {
      const yearGoals = resolvedGoals.filter((goal) => goal.period === "yearly" && goal.periodKey === String(previousYear) && goal.status !== "discarded");
      const baseScore = averageScore(new Date(previousYear, 0, 1), new Date(previousYear, 11, 31));
      const result = calculateProportionalGoalBonus(baseScore, yearGoals);
      nextNotice = { key: yearlyKey, kind: "yearly", eyebrow: "CIERRE DEL AÑO", title: "Tu resumen anual", detail: yearGoals.length ? `${result.completed} de ${result.total} objetivos anuales completados · ${Math.round(result.completionRate * 100)}% de cumplimiento.` : "No había objetivos anuales definidos para este año.", baseScore, bonus: result.bonus, finalScore: result.finalScore };
    }

    if (!nextNotice && !delivered.has(monthlyKey)) {
      const monthGoals = resolvedGoals.filter((goal) => goal.period === "monthly" && goal.periodKey === previousMonthKey && goal.status !== "discarded");
      const baseScore = averageScore(new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1), previousMonth);
      const result = calculateProportionalGoalBonus(baseScore, monthGoals);
      nextNotice = { key: monthlyKey, kind: "monthly", eyebrow: "CIERRE DEL MES", title: "Tu resumen mensual", detail: monthGoals.length ? `${result.completed} de ${result.total} objetivos mensuales completados · ${Math.round(result.completionRate * 100)}% de cumplimiento.` : "No había objetivos mensuales definidos para este mes.", baseScore, bonus: result.bonus, finalScore: result.finalScore };
    }

    if (!nextNotice && now.getDay() === 1) {
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const monday = new Date(sunday); monday.setDate(sunday.getDate() - 6);
      const weeklyKey = `weekly:${isoDate(monday.getFullYear(), monday.getMonth(), monday.getDate())}`;
      if (!delivered.has(weeklyKey)) {
        const closedWeekDates = Array.from({ length: 7 }, (_, index) => { const item = new Date(monday); item.setDate(monday.getDate() + index); return item; });
        const baseScore = closedWeekDates.reduce((sum, item) => sum + calculateDailyScore(item, daily, weekly, habitCategories).finalScore, 0) / 7;
        const period = goalPeriodDetails("weekly", monday);
        const weekGoals = resolvedGoals.filter((goal) => goal.period === "weekly" && goal.periodKey === period.key && goal.status !== "discarded");
        const completed = weekGoals.filter((goal) => goal.status === "completed" || goal.currentValue >= goal.targetValue).length;
        const result = calculateWeeklyGoalBonus(baseScore, weekGoals);
        nextNotice = { key: weeklyKey, kind: "weekly", eyebrow: "CIERRE DE SEMANA", title: result.earned ? "Semana cerrada con bonus" : "Tu resumen semanal", detail: weekGoals.length ? `${completed} de ${weekGoals.length} objetivos semanales completados${result.earned ? ". Bonus de cierre conseguido." : "."}` : "No había objetivos semanales definidos para esta semana.", baseScore, bonus: result.bonus, finalScore: result.finalScore };
      }
    }

    if (!nextNotice && !delivered.has(yesterdayKey)) {
      const result = calculateDailyScore(yesterday, daily, weekly, habitCategories);
      nextNotice = { key: yesterdayKey, kind: "daily", eyebrow: "CIERRE DEL DÍA", title: result.bonus > 0 ? "Tu constancia sumó un bonus" : "Así terminó tu día", detail: `${result.completed} de ${result.scheduled} hábitos diarios · ${result.eligibleWeeklyDoneToday} aportaciones semanales con bonus.`, baseScore: result.baseScore, bonus: result.bonus, finalScore: result.finalScore };
    }
    if (nextNotice) queueMicrotask(() => setClosureNotice(nextNotice));
  }, [closureNotice, daily, habitCategories, hydrated, mainView, resolvedGoals, session, weekly]);

  function dismissClosureNotice() {
    if (!closureNotice || !session) return;
    const deliveredKey = `brujula-closure-notices-v1:${session.user.id}`;
    const delivered = parseStoredStringSet(readStoredValue(localStorage, deliveredKey));
    delivered.add(closureNotice.key);
    writeStoredValue(localStorage, deliveredKey, JSON.stringify([...delivered].slice(-120)));
    setClosureNotice(null);
  }

  function dismissInsight(id: string) {
    if (!session) return;
    const key = `brujula-dismissed-insights-v1:${session.user.id}`;
    let stored: Record<string, number> = {};
    try { stored = JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { stored = {}; }
    stored[id] = today.getTime() + 7 * 86_400_000;
    localStorage.setItem(key, JSON.stringify(stored));
    setDismissedInsights((items) => new Set(items).add(id));
  }

  function editInsightEntity(kind: "habit" | "goal", entityId?: number) {
    if (!entityId) return;
    if (kind === "habit") {
      const habit = daily.find((item) => item.id === entityId);
      if (habit) { setMainView("habits"); startEdit("daily", habit); }
      return;
    }
    const goal = goals.find((item) => item.id === entityId);
    if (goal) { setMainView("goals"); setGoalFilter(goal.period === "daily" ? "weekly" : goal.period); startGoalEdit(goal); }
  }

  function openView(view: MainView) {
    if (view !== "summary" && closureNotice) setClosureNotice(null);
    if (view === "goals") setGoalFilter("yearly");
    if (view === "week") {
      const review = weeklyReviews.find((item) => item.weekStart === weekBounds(today).key);
      setWeeklyPlanDraft({ priorities: [review?.priorities[0] ?? "", review?.priorities[1] ?? "", review?.priorities[2] ?? ""], adjustment: review?.adjustment ?? "", reflection: review?.reflection ?? "" });
    }
    setMainView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveWeeklyPlan() {
    const weekStart = weekBounds(today).key;
    const next: WeeklyReview = {
      weekStart,
      priorities: weeklyPlanDraft.priorities.map((item) => item.trim()).filter(Boolean).slice(0, 3),
      adjustment: weeklyPlanDraft.adjustment.trim(),
      reflection: weeklyPlanDraft.reflection.trim(),
      updatedAt: new Date().toISOString(),
    };
    setWeeklyReviews((items) => [...items.filter((item) => item.weekStart !== weekStart), next].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
    setWeeklyPlanSaved(true);
    window.setTimeout(() => setWeeklyPlanSaved(false), 2200);
  }

  const currentWeek = weekBounds(today);
  const previousWeek = previousWeekBounds(today);
  const reviewWeek = shiftWeekBounds(reviewWeekKey, 0);
  const reviewSummary = summarizeWeek(reviewWeek.start, daily, weekly, habitCategories);
  const selectedWeeklyReview = weeklyReviews.find((item) => item.weekStart === reviewWeek.key);
  const reviewGoals = goalsForWeek(resolvedGoals, reviewWeek.key);
  const reviewCompletedGoals = reviewGoals.filter((goal) => goal.status === "completed" || goal.currentValue >= goal.targetValue).length;
  const weakestWeeklyCategory = reviewSummary.categories.at(-1);

  if (!authReady) {
    return <main className="auth-page"><p className="eyebrow">CARGANDO BRÚJULA…</p></main>;
  }
  if (passwordRecovery) return <ResetPassword onComplete={completePasswordRecovery} />;
  if (!session) return <AuthGate />;

  return (
    <main>
      {closureNotice && <ClosureNoticeCard notice={closureNotice} formatScore={scoreLabel} onDismiss={dismissClosureNotice} />}
      <AppHeader activeView={mainView} userEmail={session.user.email} onNavigate={openView} onSignOut={() => getSupabaseBrowserClient().auth.signOut()} />

      <div className="page-shell">
        {mainView === "summary" && <>
        <section className="hero">
          <div>
            <p className="eyebrow">TU PANEL DE CONSTANCIA</p>
            <h1>Pequeños pasos.<br /><em>Grandes cambios.</em></h1>
            <p className="hero-copy">Visualiza tu progreso, protege tus rachas y convierte cada día en una victoria medible.</p>
          </div>
          <div className="hero-aside">
            <blockquote className="panel-motivation"><span aria-hidden="true">✦</span><p>“{motivationForToday(motivations)}”</p></blockquote>
            <div className="month-control">
              <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior">‹</button>
              <div><span>PERIODO</span><strong>{monthNames[month]} {year}</strong></div>
              <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente">›</button>
            </div>
          </div>
        </section>

        </>}

        {mainView === "week" && <WeeklyPlanningView currentWeek={currentWeek} previousWeek={previousWeek} reviewWeek={reviewWeek} reviewWeekKey={reviewWeekKey} reviewSummary={reviewSummary} selectedWeeklyReview={selectedWeeklyReview} reviewCompletedGoals={reviewCompletedGoals} reviewGoalCount={reviewGoals.length} weakestWeeklyCategory={weakestWeeklyCategory} categories={habitCategories} weeklyPlanDraft={weeklyPlanDraft} setWeeklyPlanDraft={setWeeklyPlanDraft} weeklyPlanSaved={weeklyPlanSaved} onSaveWeeklyPlan={saveWeeklyPlan} onReviewWeekChange={setReviewWeekKey} />}

        {mainView === "today" && <TodayView today={today} date={dayViewDate} monthKey={dayViewMonthKey} weekIndex={dayViewWeekIndex} isViewingToday={isViewingToday} habits={dayViewHabits} habitGroups={dayViewHabitGroups} weeklyHabits={dayViewWeekly} weeklyHabitGroups={weeklyHabitGroups} goals={dayViewGoals} categories={habitCategories} completedHabits={dayViewCompleted} finalScore={dayViewScore.finalScore} categoryScores={dayViewCategoryScores} isCollapsed={isHabitBlockCollapsed} onToggleCategory={toggleHabitBlock} toggleProps={longPressProps} onShiftDay={shiftDayView} onReturnToToday={() => setDayViewDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))} onToggleHabit={toggleDayViewHabit} onToggleWeeklyHabit={toggleDayViewWeeklyHabit} onCycleException={cycleException} onUpdateGoal={updateGoalProgress} onMarkGoalNotCompleted={markGoalNotCompleted} />}

        {mainView === "summary" && <>
        <section className="metrics">
          <article className="metric primary">
            <div><span>{dayScoreTitle}</span><strong>{scoreLabel(dayScore)}<small> / 10</small></strong><p>{dayScoreDetail}</p></div>
            <Ring value={dayProgress} />
          </article>
          <article className="metric">
            <span>Nota semanal</span>
            <strong>{scoreLabel(weekScore)} <small>/ 10</small></strong>
            <p>Del día {weekStart} al {evaluatedWeekEnd}{weeklyGoalBonus > 0 ? ` · +${scoreLabel(weeklyGoalBonus)} bonus` : ""}</p>
          </article>
          <article className="metric">
            <span>Nota del mes</span>
            <strong>{scoreLabel(monthScore)} <small>/ 10</small></strong>
            <p>{totalChecks} de {totalGoal} acciones completadas</p>
          </article>
          <article className="metric">
            <span>Hábito más sólido</span>
            <strong className="compact">{ranked[0]?.name ?? "—"}</strong>
            <p className="positive">{ranked[0] ? Math.round(checksFor(ranked[0]).length / goalFor(ranked[0]) * 100) : 0}% completado</p>
          </article>
        </section>

        <section className="dashboard-grid" id="insights">
          <article className="panel overview">
            <div className="panel-head"><div><p className="eyebrow">RITMO DEL MES</p><h2>Evolución del mes por semanas</h2></div><span className="legend"><i /> Completado</span></div>
            <div className="bars">
              {weeklyProgress.map((week, index) => (
                <div className={`bar-column ${week.projected ? "projected" : ""}`} key={week.range}>
                  <span>{week.value !== null ? `${week.value}%` : ""}</span>
                  <div className="bar-track">{week.value !== null && <div style={{ height: `${Math.max(week.value, 4)}%`, background: weeklyBarPalette[index] }} />}</div>
                  <strong><b>S{index + 1}</b><small>{week.range}</small></strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel ranking">
            <div className="panel-head ranking-head"><div><p className="eyebrow">CLASIFICACIÓN</p><h2>{rankingView === "best" ? "Hábitos destacados" : rankingView === "watch" ? "Hábitos a vigilar" : "Mejores rachas"}</h2></div><span className="trophy">{rankingView === "best" ? "✦" : rankingView === "watch" ? "!" : "🔥"}</span></div>
            <div className="tabs ranking-tabs" role="tablist" aria-label="Tipo de clasificación">
              <button role="tab" aria-selected={rankingView === "best"} className={rankingView === "best" ? "active" : ""} onClick={() => setRankingView("best")}>Destacados</button>
              <button role="tab" aria-selected={rankingView === "watch"} className={rankingView === "watch" ? "active" : ""} onClick={() => setRankingView("watch")}>A vigilar</button>
              <button role="tab" aria-selected={rankingView === "streak"} className={rankingView === "streak" ? "active" : ""} onClick={() => setRankingView("streak")}>Mejor racha</button>
            </div>
            <div className="rank-list">
              {rankingItems.slice(0, 5).map((habit, index) => {
                const streak = longestHabitStreak(habit);
                const progress = rankingView === "streak" ? Math.round(streak / longestVisibleStreak * 100) : Math.round(habitCompletion(habit) * 100);
                return <div className="rank-row" key={habit.id}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div><span>{habit.name}</span><div className="mini-track"><i style={{ width: `${progress}%`, background: habit.color }} /></div></div>
                  <strong>{rankingView === "streak" ? `${streak} ${streak === 1 ? "día" : "días"}` : `${progress}%`}</strong>
                </div>;
              })}
            </div>
          </article>
        </section>

        <section className="panel actionable-insights" aria-labelledby="actionable-insights-title">
          <div className="panel-head"><div><p className="eyebrow">REVISIÓN AUTOMÁTICA</p><h2 id="actionable-insights-title">Qué conviene revisar ahora</h2></div><span className="insight-method">Son avisos orientativos · tú decides qué cambiar</span></div>
          <div className="insight-grid">{actionableInsights.map((insight) => <article className={`insight-card ${insight.severity}`} key={insight.id}>
            <span>{insight.kind === "goal" ? "OBJETIVO" : insight.kind === "habit" ? "HÁBITO" : insight.kind === "weekday" ? "PATRÓN SEMANAL" : "TENDENCIA"}</span>
            <strong>{insight.title}</strong>
            <p className="insight-status">{insight.detail}</p>
            <div className="insight-recommendation"><b>Qué puedes hacer</b><p>{insight.action}</p></div>
            <details className="insight-evidence">
              <summary>Cómo se ha detectado</summary>
              <div><b>Datos utilizados</b><p>{insight.evidence}</p><b>Criterio</b><p>{insight.rule}</p><em>{insight.period}</em></div>
            </details>
            {insight.severity !== "positive" && <div className="insight-actions">
              {insight.kind === "habit" && <button onClick={() => editInsightEntity("habit", insight.entityId)}>Revisar hábito</button>}
              {insight.kind === "goal" && <button onClick={() => editInsightEntity("goal", insight.entityId)}>Revisar objetivo</button>}
              <button className="quiet" onClick={() => dismissInsight(insight.id)}>Recordármelo en 7 días</button>
            </div>}
          </article>)}</div>
          {!actionableInsights.length && <div className="insights-empty"><strong>No hay avisos pendientes</strong><p>Los avisos pospuestos volverán a aparecer en siete días si siguen siendo relevantes.</p></div>}
        </section>

        <section className="panel analytics-panel" id="analytics">
          <div className="analytics-head">
            <div>
              <p className="eyebrow">ANÁLISIS DE CONSTANCIA</p>
              <h2>
                {chartScope === "general" && "Evolución general"}
                {chartScope === "category" && (allCategoriesSelected ? "Comparativa de bloques" : `Evolución de ${selectedCategoryMeta.label}`)}
                {chartScope === "habit" && (allHabitsSelected ? "Comparativa de hábitos" : `Evolución de ${selectedHabit?.name ?? "hábito"}`)}
              </h2>
            </div>
            <div className="analytics-controls">
              <div className="tabs"><button className={chartPeriod === "weekly" ? "active" : ""} onClick={() => setChartPeriod("weekly")}>Últimos 7 días</button><button className={chartPeriod === "monthly" ? "active" : ""} onClick={() => setChartPeriod("monthly")}>Mensual</button><button className={chartPeriod === "yearly" ? "active" : ""} onClick={() => setChartPeriod("yearly")}>Anual</button></div>
              <div className="tabs scope-tabs">
                <button className={chartScope === "general" ? "active" : ""} onClick={() => setChartScope("general")}>General</button>
                <button className={chartScope === "category" ? "active" : ""} onClick={() => setChartScope("category")}>Por bloque</button>
                <button className={chartScope === "habit" ? "active" : ""} onClick={() => setChartScope("habit")}>Por hábito</button>
              </div>
              {chartScope === "category" && <select aria-label="Seleccionar bloque" value={allCategoriesSelected ? "__all__" : selectedCategoryMeta?.id ?? ""} onChange={(e) => setSelectedChartCategory(e.target.value)}><option value="__all__">Ver todos</option>{habitCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select>}
              {chartScope === "habit" && <select aria-label="Seleccionar hábito" value={allHabitsSelected ? 0 : selectedHabit?.id ?? ""} onChange={(e) => setSelectedHabitId(Number(e.target.value))}><option value={0}>Ver todos</option>{activeDaily.map((habit) => <option key={habit.id} value={habit.id}>{habit.name}</option>)}</select>}
            </div>
          </div>
          <TrendChart series={chartSeries} />
          <div className="chart-summary">
            <span>Alcance: <strong>{chartScope === "general" ? "General" : chartScope === "category" ? allCategoriesSelected ? "Todos los bloques" : selectedCategoryMeta.label : allHabitsSelected ? "Todos los hábitos" : selectedHabit?.name ?? "Hábito"}</strong></span>
            <span>Periodo: <strong>{chartPeriod === "weekly" ? rollingPeriodLabel : chartPeriod === "monthly" ? `${monthNames[month]} ${year}` : year}</strong></span>
            <span>{chartSeries.length > 1 ? <><strong>{chartSeries.length}</strong> series comparadas</> : <>Último valor: <strong>{Math.round(chartSeries[0]?.data.at(-1)?.value ?? 0)}%</strong></>}</span>
          </div>
        </section>
        </>}

        {mainView === "goals" && <GoalsView archivedCount={archivedCount} goalFilter={goalFilter} categoryFilter={goalCategoryFilter} categories={habitCategories} hasVisibleGoals={visibleGoals.length > 0} hasActiveGoals={activeGoals.length > 0} onOpenArchived={() => setArchivedManagerOpen(true)} onOpenTemplate={setTemplateModal} onAddGoal={openNewGoal} onFilterChange={setGoalFilter} onCategoryFilterChange={setGoalCategoryFilter}>
          {visibleGoals.map((goal) => {
            const category = habitCategories.find((item) => item.id === goal.category) ?? habitCategories[0];
            return <GoalCard key={goal.id} goal={goal} category={category} allGoals={resolvedGoals} todayKey={realTodayKey} canReorder={goalCategoryFilter === "all"} dragging={draggingGoalId === goal.id} planning={planningGoalId === goal.id} stepDraft={goalStepDraft} setStepDraft={setGoalStepDraft} progressDraft={goalProgressDrafts[goal.id] ?? ""} setProgressDraft={(value) => setGoalProgressDrafts((drafts) => ({ ...drafts, [goal.id]: value }))} fitnessMetric={fitnessMetric} setFitnessMetric={setFitnessMetric} fitnessPeriod={fitnessPeriod} setFitnessPeriod={setFitnessPeriod} isBookCompleted={isBookCompleted} yearlyHabitPercent={yearlyHabitPercent} onDragStart={startGoalPointerDrag} onDragMove={moveGoalPointerDrag} onDragEnd={finishGoalPointerDrag} onDragCancel={cancelGoalPointerDrag} onArchive={archiveGoal} onEdit={startGoalEdit} onDelete={setDeletingGoal} onToggleStep={toggleGoalStep} onRemoveStep={removeGoalStep} onAddStep={addGoalStep} onBeginPlanning={beginGoalPlanning} onCancelPlanning={cancelGoalPlanning} onOpenBook={openBookEditor} onCompleteBook={completeBook} onRemoveBook={removeBook} onOpenFitness={setFitnessGoal} onMoveWeekly={moveWeeklyGoalToCurrentWeek} onUpdateProgress={updateGoalProgress} onAddProgress={addGoalProgress} />;
          })}
        </GoalsView>}

        {mainView === "habits" && <HabitsView activeTab={activeTab} archivedCount={archivedCount} syncStatus={syncStatus} onTabChange={setActiveTab} onOpenMotivations={() => setMotivationManagerOpen(true)} onOpenCategories={() => { setCategoryManagerOpen(true); startCategoryEdit(); }} onOpenBackup={() => { setBackupManagerOpen(true); setBackupPreview(null); setBackupMessage(""); }} onOpenArchived={() => setArchivedManagerOpen(true)} onAddHabit={() => { setModal(activeTab); setNewGoal(activeTab === "daily" ? 12 : 1); setEveryDay(false); setWeekdaysOnly(false); resetScheduleDraft(); setSelectedCategory("health"); }} onUseRemote={resolveConflictWithRemote} onKeepLocal={resolveConflictWithLocal}>
          {activeTab === "daily" ? (
            <DailyHabitTracker year={year} month={month} days={days} today={today} todayNumber={todayNumber} evaluatedThrough={evaluatedThrough} calendar={calendar} categories={habitCategories} habits={activeDaily.map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) }))} draggingHabitId={dragging?.type === "daily" ? dragging.id : undefined} scrollRef={tableScrollRef} isCollapsed={(categoryId) => isHabitBlockCollapsed("habits-daily", categoryId)} onToggleCategory={(categoryId) => toggleHabitBlock("habits-daily", categoryId)} goalFor={goalFor} checksFor={checksFor} missesFor={missesFor} skipsFor={skipsFor} toggleProps={longPressProps} onToggleDay={toggleDaily} onCycleException={(habitId, targetDate) => cycleException("daily", habitId, targetDate)} onManageHabit={(habit) => setActionHabit({ type: "daily", habit })} onDragStart={(id) => setDragging({ type: "daily", id })} onDragEnd={() => setDragging(null)} onReorder={(sourceId, targetId) => reorderHabit("daily", sourceId, targetId)} />
          ) : (
            <WeeklyHabitTracker year={year} month={month} monthName={monthNames[month]} today={today} isPastMonth={isPastMonth} monthWeeks={monthWeeks} currentMonthWeek={currentMonthWeek} categories={habitCategories} habits={activeWeekly.map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) }))} draggingHabitId={dragging?.type === "weekly" ? dragging.id : undefined} isCollapsed={(categoryId) => isHabitBlockCollapsed("habits-weekly", categoryId)} onToggleCategory={(categoryId) => toggleHabitBlock("habits-weekly", categoryId)} checksFor={weeklyChecksFor} onChangeCount={changeWeeklyCount} onManageHabit={(habit) => setActionHabit({ type: "weekly", habit: habit as WeeklyHabit })} onDragStart={(id) => setDragging({ type: "weekly", id })} onDragEnd={() => setDragging(null)} onReorder={(sourceId, targetId) => reorderHabit("weekly", sourceId, targetId)} />
          )}
        </HabitsView>}
      </div>

      {templateModal && <GoalTemplateDialog template={templateModal} habits={daily} selectedHabitIds={templateHabitIds} readingTarget={readingTarget} onReadingTargetChange={setReadingTarget} onToggleHabit={(habitId) => setTemplateHabitIds((ids) => templateModal === "fitness" ? ids.includes(habitId) ? ids.filter((id) => id !== habitId) : [...ids, habitId] : [habitId])} onClose={() => setTemplateModal(null)} onCreate={createTemplateGoal} />}
      {bookGoal && <BookEditorDialog editing={editingBookId !== null} title={bookTitle} author={bookAuthor} status={bookStatus} format={bookFormat} onTitleChange={setBookTitle} onAuthorChange={setBookAuthor} onStatusChange={setBookStatus} onFormatChange={setBookFormat} onClose={closeBookEditor} onSave={saveBook} />}
      {fitnessGoal && <FitnessEditorDialog draft={fitnessDraft} importing={fitnessImporting} importMessage={fitnessImportMessage} onDraftChange={(metric, value) => setFitnessDraft((draft) => ({ ...draft, [metric]: value }))} onImport={(file) => void importSamsungHealth(file)} onClose={closeFitnessEditor} onSave={saveFitnessEntry} />}
      {deletingGoal && <DeleteGoalDialog goal={deletingGoal} onClose={() => setDeletingGoal(null)} onDelete={deleteGoal} />}

      {goalModalOpen && <GoalEditorDialog editingGoalId={editingGoalId} title={goalTitle} period={goalPeriod} parentAnnualId={goalParentAnnualId} category={goalCategory} measurement={goalMeasurement} linkedHabitIds={goalLinkedHabitIds} target={goalTarget} unit={goalUnit} goals={goals} habits={daily} categories={habitCategories} onTitleChange={setGoalTitle} onPeriodChange={setGoalPeriod} onParentAnnualChange={setGoalParentAnnualId} onCategoryChange={setGoalCategory} onMeasurementChange={setGoalMeasurement} onToggleHabit={(habitId) => setGoalLinkedHabitIds((ids) => ids.includes(habitId) ? ids.filter((id) => id !== habitId) : [...ids, habitId])} onTargetChange={setGoalTarget} onUnitChange={setGoalUnit} onClose={closeGoalModal} onSave={createGoal} />}

      {modal && <HabitEditorDialog variant="create" habitType={modal} daysInMonth={days} name={newName} category={selectedCategory} categories={habitCategories} goal={newGoal} scheduleMode={scheduleMode} selectedWeekdays={selectedWeekdays} intervalDays={intervalDays} scheduleStart={scheduleStart} activeFrom={activeFrom} activeUntil={activeUntil} pausedFrom={pausedFrom} pausedUntil={pausedUntil} onNameChange={setNewName} onCategoryChange={setSelectedCategory} onGoalChange={setNewGoal} onScheduleModeChange={(value) => { setScheduleMode(value); setEveryDay(value === "daily"); setWeekdaysOnly(value === "weekdays"); }} onToggleWeekday={(value) => setSelectedWeekdays((items) => items.includes(value) ? items.filter((day) => day !== value) : [...items, value])} onIntervalDaysChange={setIntervalDays} onScheduleStartChange={setScheduleStart} onActiveFromChange={setActiveFrom} onActiveUntilChange={setActiveUntil} onPausedFromChange={setPausedFrom} onPausedUntilChange={setPausedUntil} onClose={() => setModal(null)} onSave={addHabit} />}
      {motivationManagerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setMotivationManagerOpen(false)}>
        <div className="modal motivations-modal" role="dialog" aria-modal="true" aria-labelledby="motivations-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="close" onClick={() => setMotivationManagerOpen(false)} aria-label="Cerrar">×</button>
          <p className="eyebrow">TU VOZ INTERIOR</p>
          <h2 id="motivations-title">Frases motivacionales</h2>
          <p className="modal-help">Cada día aparecerá una frase distinta en el acceso. Las que añadas aquí tendrán prioridad sobre las predeterminadas.</p>
          <div className="motivation-editor">
            <label>Frase<textarea autoFocus value={motivationDraft} maxLength={220} onChange={(event) => setMotivationDraft(event.target.value)} placeholder="Ej. La dirección importa más que la velocidad." /></label>
            <div className="motivation-editor-actions">
              {editingMotivationIndex !== null && <button className="reset-button" onClick={() => { setEditingMotivationIndex(null); setMotivationDraft(""); }}>Cancelar</button>}
              <button className="add-button" onClick={saveMotivation}>{editingMotivationIndex === null ? "+ Añadir frase" : "Guardar cambios"}</button>
            </div>
          </div>
          <div className="motivation-list" aria-live="polite">
            {motivations.map((motivation, index) => <div className="motivation-row" key={`${motivation}-${index}`}>
              <span>{index + 1}</span>
              <p>“{motivation}”</p>
              <button className="menu-trigger" onClick={() => editMotivation(index)} aria-label={`Editar frase ${index + 1}`}>✎</button>
              <button className="menu-trigger danger-text" onClick={() => deleteMotivation(index)} aria-label={`Eliminar frase ${index + 1}`}>×</button>
            </div>)}
            {!motivations.length && <p className="empty-motivations">No hay frases personales. Mientras tanto se mostrarán las frases predeterminadas.</p>}
          </div>
        </div>
      </div>}
      {actionHabit && <div className="modal-backdrop action-backdrop" role="presentation" onMouseDown={() => setActionHabit(null)}>
        <div className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="actions-title" onMouseDown={(e) => e.stopPropagation()}>
          <div className="action-sheet-head"><div><p className="eyebrow">GESTIONAR HÁBITO</p><h2 id="actions-title">{actionHabit.habit.name}</h2></div><button className="close static-close" onClick={() => setActionHabit(null)} aria-label="Cerrar">×</button></div>
          <button onClick={() => startEdit(actionHabit.type, actionHabit.habit)}><strong>Editar</strong><span>Cambiar el bloque, nombre, objetivo o color</span></button>
          <button onClick={() => archiveHabit(actionHabit.type, actionHabit.habit.id)}><strong>Archivar</strong><span>Ocultarlo conservando su historial</span></button>
          <button className="danger-action" onClick={() => { setDeleting({ type: actionHabit.type, id: actionHabit.habit.id, name: actionHabit.habit.name }); setActionHabit(null); }}><strong>Eliminar</strong><span>Borrar el hábito y todos sus registros</span></button>
        </div>
      </div>}
      {categoryManagerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCategoryManagerOpen(false)}>
        <div className="modal blocks-modal" role="dialog" aria-modal="true" aria-labelledby="blocks-title" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setCategoryManagerOpen(false)} aria-label="Cerrar">×</button>
          <p className="eyebrow">ORGANIZACIÓN PERSONAL</p>
          <h2 id="blocks-title">Gestionar bloques</h2>
          <div className="block-manager-list">
            {habitCategories.map((category) => {
              const habitCount = [...daily, ...weekly].filter((habit) => !habit.archived && habit.category === category.id).length;
              const goalCount = goals.filter((goal) => goal.status !== "discarded" && goal.category === category.id).length;
              return <div className="block-manager-row" key={category.id}>
                <span className="block-manager-icon" style={{ background: `${category.color}26`, color: category.color }}>{category.icon}</span>
                <div><strong>{category.label}</strong><small>{habitCount} {habitCount === 1 ? "hábito" : "hábitos"} · {goalCount} {goalCount === 1 ? "objetivo" : "objetivos"}</small></div>
                <button className={`priority-toggle ${category.priority ? "active" : ""}`} onClick={() => toggleCategoryPriority(category.id)} aria-label={`${category.priority ? "Quitar prioridad a" : "Marcar como prioritario"} ${category.label}`} aria-pressed={Boolean(category.priority)} title={category.priority ? "Bloque prioritario (peso 2)" : "Bloque normal (peso 1)"}>★</button>
                <button className="menu-trigger" onClick={() => startCategoryEdit(category)} aria-label={`Editar bloque ${category.label}`}>✎</button>
                <button className="menu-trigger danger-text" disabled={habitCategories.length === 1} onClick={() => requestCategoryDelete(category.id)} aria-label={`Eliminar bloque ${category.label}`}>×</button>
              </div>;
            })}
          </div>
          <div className="block-editor">
            <p className="eyebrow">{editingCategoryId ? "EDITAR BLOQUE" : "NUEVO BLOQUE"}</p>
            <div className="block-fields">
              <label>Nombre<input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ej. Ocio" /></label>
              <label className="icon-field">Personalizado<input value={categoryIcon} maxLength={2} onChange={(e) => setCategoryIcon(e.target.value)} aria-label="Icono personalizado del bloque" /></label>
            </div>
            <fieldset className="block-icon-picker">
              <legend>Icono</legend>
              <div className="block-icon-grid">
                {blockIcons.map((icon) => <button key={icon} type="button" className={categoryIcon === icon ? "selected" : ""} style={{ color: categoryIcon === icon ? categoryColor : undefined }} onClick={() => setCategoryIcon(icon)} aria-label={`Elegir icono ${icon}`} aria-pressed={categoryIcon === icon}>{icon}</button>)}
              </div>
              <small>Elige uno de la paleta o escribe tu propio símbolo arriba.</small>
            </fieldset>
            <fieldset className="color-picker compact-colors">
              <legend>Color</legend>
              <div className="color-palette">
                {palette.map((color) => <button key={color} type="button" className={categoryColor === color ? "selected" : ""} style={{ background: color }} onClick={() => setCategoryColor(color)} aria-label={`Elegir color ${color}`} aria-pressed={categoryColor === color}>{categoryColor === color && <span>✓</span>}</button>)}
              </div>
            </fieldset>
            <div className="block-editor-actions">
              {editingCategoryId && <button className="reset-button" onClick={() => startCategoryEdit()}>Cancelar edición</button>}
              <button className="add-button" onClick={saveCategory}>{editingCategoryId ? "Guardar bloque" : "+ Añadir bloque"}</button>
            </div>
          </div>
        </div>
      </div>}
      {backupManagerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setBackupManagerOpen(false)}><div className="modal backup-modal" role="dialog" aria-modal="true" aria-labelledby="backup-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setBackupManagerOpen(false)} aria-label="Cerrar">×</button>
        <p className="eyebrow">PORTABILIDAD Y RECUPERACIÓN</p><h2 id="backup-title">Copia de tus datos</h2>
        <p>Descarga una copia completa de hábitos, objetivos, bloques, historial y frases. Guárdala en un lugar seguro.</p>
        <button className="add-button full" type="button" onClick={exportBackup}>Descargar copia JSON</button>
        <div className="backup-divider"><span>Restaurar una copia</span></div>
        <input ref={backupInputRef} className="backup-file-input" type="file" accept="application/json,.json" onChange={(event) => void inspectBackup(event.target.files?.[0])} />
        <button className="reset-button full" type="button" onClick={() => backupInputRef.current?.click()}>Seleccionar archivo</button>
        {backupMessage && <p className="import-message" role="alert">{backupMessage}</p>}
        {backupPreview && <div className="backup-preview"><strong>Copia válida</strong><span>{backupPreview.daily} hábitos diarios · {backupPreview.weekly} semanales</span><span>{backupPreview.goals} objetivos · {backupPreview.categories} bloques · {backupPreview.motivations} frases</span><p>Restaurar sustituirá todos los datos actuales. No se fusionarán ambas versiones.</p><button className="danger-button full" type="button" onClick={restoreBackup}>Confirmar y sustituir mis datos</button></div>}
      </div></div>}
      {archivedManagerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setArchivedManagerOpen(false)}>
        <div className="modal archived-modal" role="dialog" aria-modal="true" aria-labelledby="archived-title" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setArchivedManagerOpen(false)} aria-label="Cerrar">×</button>
          <p className="eyebrow">HISTORIAL CONSERVADO</p>
          <h2 id="archived-title">Elementos archivados</h2>
          {archivedCount === 0 ? (
            <div className="archived-empty">
              <strong>No tienes elementos archivados</strong>
              <p>Cuando archives un hábito u objetivo, podrás encontrarlo y restaurarlo desde aquí sin perder su historial.</p>
            </div>
          ) : (
            <div className="archived-sections">
              <section className="archived-section">
                <h3>Objetivos <span>{archivedGoals.length}</span></h3>
                {archivedGoals.length ? <div className="archived-list">
                  {archivedGoals.map((goal) => {
                    const category = habitCategories.find((item) => item.id === goal.category);
                    const periodLabel = { daily: "Diario", weekly: "Semanal", monthly: "Mensual", yearly: "Anual" }[goal.period];
                    return <div className="archived-row" key={`goal-${goal.id}`}>
                      <i style={{ background: category?.color ?? "#39c6a4" }} />
                      <div>
                        <strong>{goal.title}</strong>
                        <small>{periodLabel}{category ? ` · ${category.label}` : ""} · {goal.status === "completed" ? "Completado" : "En curso"}</small>
                      </div>
                      <button className="restore-button" onClick={() => restoreGoal(goal.id)}>Restaurar</button>
                    </div>;
                  })}
                </div> : <p className="archived-section-empty">No hay objetivos archivados.</p>}
              </section>
              <section className="archived-section">
                <h3>Hábitos <span>{archivedHabits.length}</span></h3>
                {archivedHabits.length ? <div className="archived-list">
                  {archivedHabits.map(({ type, habit }) => {
                    const category = habitCategories.find((item) => item.id === (habit.category ?? inferCategory(habit.name)));
                    return <div className="archived-row" key={`${type}-${habit.id}`}>
                      <i style={{ background: habit.color }} />
                      <div>
                        <strong>{habit.name}</strong>
                        <small>{type === "daily" ? "Diario" : "Semanal"}{category ? ` · ${category.label}` : ""}</small>
                      </div>
                      <button className="restore-button" onClick={() => restoreHabit(type, habit.id)}>Restaurar</button>
                    </div>;
                  })}
                </div> : <p className="archived-section-empty">No hay hábitos archivados.</p>}
              </section>
            </div>
          )}
        </div>
      </div>}
      {deletingCategoryId && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeletingCategoryId(null)}>
        <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-block-title" onMouseDown={(e) => e.stopPropagation()}>
          <p className="eyebrow danger-text">ELIMINAR BLOQUE</p>
          <h2 id="delete-block-title">¿Dónde movemos sus elementos?</h2>
          <p>El bloque desaparecerá, pero sus hábitos, objetivos y todo su historial se conservarán.</p>
          <label>Bloque de destino<select value={replacementCategoryId} onChange={(e) => setReplacementCategoryId(e.target.value)}>{habitCategories.filter((category) => category.id !== deletingCategoryId).map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
          <div className="confirm-actions"><button className="reset-button" onClick={() => setDeletingCategoryId(null)}>Cancelar</button><button className="delete-button" onClick={deleteCategory}>Mover y eliminar</button></div>
        </div>
      </div>}
      {editing && <HabitEditorDialog variant="edit" habitType={editing.type} daysInMonth={days} name={newName} category={selectedCategory} categories={habitCategories} goal={newGoal} scheduleMode={scheduleMode} selectedWeekdays={selectedWeekdays} intervalDays={intervalDays} scheduleStart={scheduleStart} activeFrom={activeFrom} activeUntil={activeUntil} pausedFrom={pausedFrom} pausedUntil={pausedUntil} color={selectedColor} palette={palette} onNameChange={setNewName} onCategoryChange={setSelectedCategory} onGoalChange={setNewGoal} onScheduleModeChange={(value) => { setScheduleMode(value); setEveryDay(value === "daily"); setWeekdaysOnly(value === "weekdays"); }} onToggleWeekday={(value) => setSelectedWeekdays((items) => items.includes(value) ? items.filter((day) => day !== value) : [...items, value])} onIntervalDaysChange={setIntervalDays} onScheduleStartChange={setScheduleStart} onActiveFromChange={setActiveFrom} onActiveUntilChange={setActiveUntil} onPausedFromChange={setPausedFrom} onPausedUntilChange={setPausedUntil} onColorChange={setSelectedColor} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {deleting && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleting(null)}>
        <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(e) => e.stopPropagation()}>
          <p className="eyebrow danger-text">ACCIÓN IRREVERSIBLE</p>
          <h2 id="delete-title">¿Eliminar “{deleting.name}”?</h2>
          <p>Se borrarán también todos sus registros y se desvinculará de los objetivos que lo utilicen. Si quieres conservar el historial y los vínculos, utiliza “Archivar”.</p>
          <div className="confirm-actions"><button className="reset-button" onClick={() => setDeleting(null)}>Cancelar</button><button className="delete-button" onClick={deleteHabit}>Eliminar definitivamente</button></div>
        </div>
      </div>}
      {streakCelebration && <div className="modal-backdrop celebration-backdrop" role="presentation" onMouseDown={() => setStreakCelebration(null)}>
        <div className="celebration-modal" role="dialog" aria-modal="true" aria-labelledby="celebration-title" onMouseDown={(e) => e.stopPropagation()} style={{ "--habit-color": streakCelebration.color } as React.CSSProperties}>
          <button className="close celebration-close" onClick={() => setStreakCelebration(null)} aria-label="Cerrar">×</button>
          <div className="compass-celebration" aria-hidden="true">
            <span className="compass-north">N</span>
            <span className="compass-needle" />
            <span className="compass-center" />
          </div>
          <p className="eyebrow">RUMBO CONSOLIDADO</p>
          <h2 id="celebration-title">¡30 días consecutivos!</h2>
          <p>Has mantenido <strong>{streakCelebration.name}</strong> durante 30 días seguidos. Ya no es solo un objetivo: estás construyendo una identidad.</p>
          <button className="add-button full" onClick={() => setStreakCelebration(null)}>Seguir avanzando</button>
        </div>
      </div>}
    </main>
  );
}
