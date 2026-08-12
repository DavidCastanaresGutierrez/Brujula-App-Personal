"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { belongsToActiveUser, decideRemoteRevision, shouldRetryPendingSave } from "../lib/domain/sync";
import { createTrackerBackup, MAX_BACKUP_BYTES, parseTrackerBackup, type BackupPreview } from "../lib/domain/backup";
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
  localDateKey,
  monthCalendarWeeks,
  toggleCompletionForDay,
  weeklyGoalIncludesDate,
  scheduledDaysInMonth,
} from "../lib/domain/tracking";
import type { HabitSchedule } from "../lib/domain/tracking";
import { removeGoalAndChildReferences, removeHabitFromGoals, replaceCategory } from "../lib/domain/relationships";
import { parseStoredStringSet, parseStoredTrackerState, readStoredValue, writeStoredValue } from "../lib/domain/storage";
import { goalsForWeek, previousWeekBounds, shiftWeekBounds, summarizeWeek, weekBounds, type WeeklyReview } from "../lib/domain/weekly-review";
import { generateActionableInsights } from "../lib/domain/insights";
import { FitnessChart, Ring, TrendChart, fitnessMetricMeta, type ChartSeries, type FitnessEntry, type FitnessMetric } from "./components/charts";
import { AuthGate, Brand, ResetPassword } from "./components/auth";
import { WeeklyHabitTracker } from "./components/weekly-habit-tracker";
import { SyncStatus, type SyncStatusValue } from "./components/sync-status";
import { DailyHabitTracker } from "./components/daily-habit-tracker";
import { trackerStatesEqual as statesEqual, type BookEntry, type BookFormat, type Category, type Goal, type GoalStep, type Habit, type HabitCategory, type TrackerState, type WeeklyHabit } from "../lib/domain/tracker-state";
import { fetchRemoteTrackerState, saveRemoteTrackerState, subscribeToTrackerRevisions, TrackerSyncError } from "../lib/supabase/tracker-sync";

type GoalPeriod = import("../lib/domain/tracking").GoalPeriod;
type MainView = "summary" | "today" | "week" | "habits" | "goals";

type ClosureNotice = {
  key: string;
  kind: "daily" | "weekly" | "monthly" | "yearly";
  eyebrow: string;
  title: string;
  detail: string;
  baseScore: number;
  bonus: number;
  finalScore: number;
};

const palette = [
  "#ff0000", "#f97316", "#f59e0b", "#fbbf24",
  "#84cc16", "#39c6a4", "#14b8a6", "#22d3ee", "#50b8e7", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a78bfa", "#d946ef", "#ff3b88", "#f472b6", "#fb7185",
  "#ef476f", "#94a3b8",
];
const blockIcons = [
  "♥", "✦", "⌂", "€", "▣", "●", "★", "✓",
  "☀", "☾", "⚡", "☘", "∞", "⚖", "⚙", "☕",
  "♫", "✎", "◆", "◇", "▲", "◉", "⚑", "↑",
  "♜", "☯", "✈", "☎", "@", "$", "%", "&",
];
const weeklyBarPalette = ["#3cc9ab", "#ffb51b", "#ff3b6b", "#50b8e7", "#a78bfa", "#f472b6"];
const defaultCategories: Category[] = [
  { id: "health", label: "Salud", icon: "♥", color: "#39c6a4" },
  { id: "family", label: "Familia", icon: "⌂", color: "#f472b6" },
  { id: "growth", label: "Crecimiento personal", icon: "✦", color: "#a78bfa" },
  { id: "finance", label: "Finanzas", icon: "€", color: "#fbbf24" },
  { id: "work", label: "Trabajo", icon: "▣", color: "#50b8e7" },
];
const initialDaily: Habit[] = [
  { id: 1, name: "Correr", goal: 16, color: palette[0], checks: [], category: "health" },
  { id: 2, name: "Meditar", goal: 25, color: palette[1], checks: [], category: "growth" },
  { id: 3, name: "Ducha fría", goal: 5, color: palette[2], checks: [], category: "health" },
  { id: 4, name: "Comer saludable", goal: 25, color: palette[3], checks: [], category: "health" },
  { id: 5, name: "Beber 2 L de agua", goal: 25, color: palette[4], checks: [], category: "health" },
  { id: 6, name: "Leer", goal: 10, color: palette[5], checks: [], category: "growth" },
  { id: 7, name: "Estirar", goal: 28, color: "#67e8f9", checks: [], category: "health" },
];

const initialWeekly: WeeklyHabit[] = [
  { id: 101, name: "Colada", goal: 1, color: palette[0], checks: [], category: "family" },
  { id: 102, name: "Preparar comidas", goal: 1, color: palette[1], checks: [], category: "health" },
  { id: 103, name: "Limpieza", goal: 1, color: palette[2], checks: [], category: "family" },
  { id: 104, name: "Compra", goal: 1, color: palette[3], checks: [], category: "family" },
  { id: 105, name: "Tiempo en familia", goal: 1, color: palette[4], checks: [], category: "family" },
];

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const dayNames = ["D", "L", "M", "X", "J", "V", "S"];
const dailyMotivations = [
  "No necesitas hacerlo perfecto; necesitas volver a hacerlo hoy.",
  "La dirección importa más que la velocidad.",
  "Un día constante pesa más que una semana de intenciones.",
  "Tu rutina de hoy está construyendo tu margen de mañana.",
  "Empieza pequeño, pero termina el día habiendo avanzado.",
  "Lo que repites acaba definiendo lo que puedes conseguir.",
  "La motivación inicia; la constancia transforma.",
  "No negocies con el hábito que te acerca a quien quieres ser.",
  "Cada marca es un voto a favor de tu futuro.",
  "Avanzar despacio sigue siendo avanzar.",
  "Haz primero lo importante; lo urgente siempre sabe llamar.",
  "La disciplina también consiste en saber volver.",
  "Tu mejor racha comienza con la decisión de hoy.",
  "Menos promesas. Más días cumplidos.",
  "Cuida el sistema y el resultado llegará después.",
  "No midas solo cuánto falta; mira cuánto has sostenido.",
  "Hoy no tiene que ser extraordinario, solo coherente.",
  "La repetición convierte el esfuerzo en identidad.",
  "Una buena dirección corrige incluso los días difíciles.",
  "Hazlo fácil de empezar y difícil de abandonar.",
  "El progreso real suele parecer aburrido mientras ocurre.",
  "Cumple contigo antes de pedirte más.",
  "La constancia es paciencia puesta en movimiento.",
  "Lo pequeño cuenta cuando se repite.",
  "No esperes el momento ideal: protege el momento disponible.",
  "Tu energía es limitada; dirige bien la primera parte.",
  "La racha no es presión: es evidencia de que puedes.",
  "El objetivo orienta; el hábito te lleva.",
  "Volver después de fallar también forma parte del progreso.",
  "Decide el rumbo y deja que los días hagan el trabajo.",
  "Hoy es una oportunidad concreta, no una promesa abstracta.",
];
const PHRASES_OWNER_EMAIL = "david.castanares.gutierrez@gmail.com";
function motivationForToday(motivations = dailyMotivations) {
  const available = motivations.length ? motivations : dailyMotivations;
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return available[dayNumber % available.length];
}

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
  const [daily, setDaily] = useState(initialDaily);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [habitCategories, setHabitCategories] = useState<Category[]>(defaultCategories);
  const [motivations, setMotivations] = useState<string[]>(dailyMotivations);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [weeklyPlanDraft, setWeeklyPlanDraft] = useState({ priorities: ["", "", ""], adjustment: "", reflection: "" });
  const [weeklyPlanSaved, setWeeklyPlanSaved] = useState(false);
  const [reviewWeekKey, setReviewWeekKey] = useState(() => previousWeekBounds(new Date()).key);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(() => new Set());
  const [closureNotice, setClosureNotice] = useState<ClosureNotice | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("monthly");
  const [goalMeasurement, setGoalMeasurement] = useState<"complete" | "quantity">("complete");
  const [goalTarget, setGoalTarget] = useState(1);
  const [goalUnit, setGoalUnit] = useState("");
  const [goalCategory, setGoalCategory] = useState<HabitCategory>("health");
  const [goalLinkedHabitIds, setGoalLinkedHabitIds] = useState<number[]>([]);
  const [goalParentAnnualId, setGoalParentAnnualId] = useState<number | "">("");
  const [goalFilter, setGoalFilter] = useState<"weekly" | "monthly" | "yearly">("yearly");
  const [goalCategoryFilter, setGoalCategoryFilter] = useState<HabitCategory | "all">("all");
  const [draggingGoalId, setDraggingGoalId] = useState<number | null>(null);
  const [goalProgressDrafts, setGoalProgressDrafts] = useState<Record<number, string>>({});
  const [planningGoalId, setPlanningGoalId] = useState<number | null>(null);
  const [goalStepDraft, setGoalStepDraft] = useState<{ kind: GoalStep["kind"]; title: string; dueDate: string }>({ kind: "action", title: "", dueDate: "" });
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [templateModal, setTemplateModal] = useState<null | "fitness" | "reading">(null);
  const [templateHabitIds, setTemplateHabitIds] = useState<number[]>([]);
  const [readingTarget, setReadingTarget] = useState(12);
  const [bookGoal, setBookGoal] = useState<Goal | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookFormat, setBookFormat] = useState<BookFormat>("paper");
  const [bookStatus, setBookStatus] = useState<"reading" | "completed">("reading");
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [fitnessGoal, setFitnessGoal] = useState<Goal | null>(null);
  const [fitnessDraft, setFitnessDraft] = useState({ weight: "", muscle: "", fatMass: "", bodyWater: "", bodyFat: "", bmi: "", basalMetabolicRate: "" });
  const [fitnessMetric, setFitnessMetric] = useState<FitnessMetric>("weight");
  const [fitnessPeriod, setFitnessPeriod] = useState<30 | 90 | 365>(90);
  const [fitnessImporting, setFitnessImporting] = useState(false);
  const [fitnessImportMessage, setFitnessImportMessage] = useState("");
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
  const [rankingView, setRankingView] = useState<"best" | "watch">("best");
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
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusValue>("loading");
  const [remoteConflict, setRemoteConflict] = useState<{ state: TrackerState; revision: number } | null>(null);
  const [streakCelebration, setStreakCelebration] = useState<{ name: string; color: string } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineRef = useRef<TrackerState | null>(null);
  const revisionRef = useRef(0);
  const conflictRef = useRef(false);
  const pendingRemoteRevisionRef = useRef<number | null>(null);
  const pullLatestRef = useRef<(() => Promise<void>) | null>(null);
  const stateRef = useRef<TrackerState>({ daily: initialDaily, weekly: initialWeekly, categories: defaultCategories, motivations: dailyMotivations, goals: [], weeklyReviews: [] });
  const syncInFlight = useRef(false);
  const pendingLocalSaveRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const syncGenerationRef = useRef(0);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const canManagePhrases = session?.user.email?.trim().toLocaleLowerCase("es") === PHRASES_OWNER_EMAIL;

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      activeUserIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      activeUserIdRef.current = nextSession?.user.id ?? null;
      syncGenerationRef.current += 1;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      syncInFlight.current = false;
      pendingLocalSaveRef.current = false;
      setHydrated(false);
      setSyncStatus("loading");
      revisionRef.current = 0;
      conflictRef.current = false;
      pendingRemoteRevisionRef.current = null;
      setRemoteConflict(null);
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    stateRef.current = { daily, weekly, categories: habitCategories, motivations, goals, weeklyReviews };
  }, [daily, weekly, habitCategories, motivations, goals, weeklyReviews]);

  useEffect(() => {
    if (!authReady || !session) return;
    const accessToken = session.access_token;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    let cancelled = false;
    const localState = parseStoredTrackerState(readStoredValue(localStorage, storageKey)) as TrackerState | null;
    const localBaseline = parseStoredTrackerState(readStoredValue(localStorage, baselineKey)) as TrackerState | null;
    const storedRevision = Number(readStoredValue(localStorage, revisionKey));

    async function loadState() {
      try {
        const payload = await fetchRemoteTrackerState(accessToken);
        const hasPendingLocalChanges = Boolean(localState && (!localBaseline || !statesEqual(localState, localBaseline)));
        const remoteChangedSinceLocalBaseline = !Number.isSafeInteger(storedRevision) || payload.revision > storedRevision;
        const hasStartupConflict = Boolean(payload.state && localState && hasPendingLocalChanges && remoteChangedSinceLocalBaseline);
        const state = hasPendingLocalChanges && localState ? localState : (payload.state ?? localState);
        if (cancelled) return;
        if (state) {
          const normalized = normalizeState(state);
          setDaily(normalized.daily);
          setWeekly(normalized.weekly);
          setHabitCategories(normalized.categories);
          setGoals(normalized.goals);
          setWeeklyReviews(normalized.weeklyReviews);
          const savedMotivations = (state.motivations?.length ? state.motivations : localState?.motivations)?.filter((item) => item.trim()) ?? [];
          setMotivations(savedMotivations.length ? savedMotivations : dailyMotivations);
        }
        baselineRef.current = payload.state ? normalizeState(payload.state) : null;
        revisionRef.current = payload.revision;
        writeStoredValue(localStorage, baselineKey, JSON.stringify(baselineRef.current));
        writeStoredValue(localStorage, revisionKey, String(payload.revision));
        if (hasStartupConflict && payload.state) {
          conflictRef.current = true;
          setRemoteConflict({ state: normalizeState(payload.state), revision: payload.revision });
          setSyncStatus("conflict");
        } else {
          conflictRef.current = false;
          setRemoteConflict(null);
          setSyncStatus("synced");
        }
      } catch {
        if (!cancelled && localState) {
          const normalized = normalizeState(localState);
          setDaily(normalized.daily);
          setWeekly(normalized.weekly);
          setHabitCategories(normalized.categories);
          setGoals(normalized.goals);
          setWeeklyReviews(normalized.weeklyReviews);
          const savedMotivations = localState.motivations?.filter((item) => item.trim()) ?? [];
          setMotivations(savedMotivations.length ? savedMotivations : dailyMotivations);
        }
        if (!cancelled) setSyncStatus(navigator.onLine ? "error" : "offline");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    loadState();
    return () => { cancelled = true; };
  }, [authReady, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const savingUserId = session.user.id;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    const state = { daily, weekly, categories: habitCategories, motivations, goals, weeklyReviews };
    writeStoredValue(localStorage, storageKey, JSON.stringify(state));
    if (statesEqual(state, baselineRef.current)) return;
    if (conflictRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (syncInFlight.current) {
        pendingLocalSaveRef.current = true;
        return;
      }
      syncInFlight.current = true;
      const syncGeneration = syncGenerationRef.current;
      setSyncStatus("saving");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw sessionError ?? new Error("La sesión ha caducado");
        if (!belongsToActiveUser(savingUserId, data.session.user.id) || !belongsToActiveUser(savingUserId, activeUserIdRef.current)) return;
        const snapshot = stateRef.current;
        const payload = await saveRemoteTrackerState(data.session.access_token, baselineRef.current, snapshot, revisionRef.current);
        if (!belongsToActiveUser(savingUserId, activeUserIdRef.current)) return;
        baselineRef.current = snapshot;
        revisionRef.current = payload.revision;
        writeStoredValue(localStorage, baselineKey, JSON.stringify(snapshot));
        writeStoredValue(localStorage, revisionKey, String(payload.revision));
        setSyncStatus("synced");
      } catch (error) {
        if (belongsToActiveUser(savingUserId, activeUserIdRef.current)) {
          if (error instanceof TrackerSyncError && error.conflict) {
            conflictRef.current = true;
            setSyncStatus("conflict");
          } else setSyncStatus(navigator.onLine ? "error" : "offline");
        }
      } finally {
        if (syncGeneration !== syncGenerationRef.current) return;
        syncInFlight.current = false;
        if (!belongsToActiveUser(savingUserId, activeUserIdRef.current)) return;
        const shouldRetry = shouldRetryPendingSave(
          pendingLocalSaveRef.current,
          !statesEqual(stateRef.current, baselineRef.current),
          conflictRef.current,
        );
        pendingLocalSaveRef.current = false;
        if (shouldRetry) {
          // Re-enter the normal debounced save path with the latest state. This
          // prevents edits made during a slow request from remaining only local.
          setDaily((items) => [...items]);
        }
        if (pendingRemoteRevisionRef.current !== null) {
          pendingRemoteRevisionRef.current = null;
          void pullLatestRef.current?.();
        }
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [daily, weekly, habitCategories, motivations, goals, weeklyReviews, hydrated, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const retry = () => {
      if (document.visibilityState === "visible" || navigator.onLine) {
        // Trigger the normal diff-based save without inventing a second sync path.
        setDaily((items) => [...items]);
      }
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [hydrated, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    let cancelled = false;
    let pulling = false;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;

    const pullLatest = async () => {
      if (pulling || !navigator.onLine) return;
      if (syncInFlight.current) {
        pendingRemoteRevisionRef.current = Math.max(pendingRemoteRevisionRef.current ?? 0, revisionRef.current + 1);
        return;
      }
      pulling = true;
      pendingRemoteRevisionRef.current = null;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const payload = await fetchRemoteTrackerState(data.session.access_token).catch(() => null);
        if (!payload) return;
        if (cancelled || !payload.state) return;
        const serverState = normalizeState(payload.state);
        const localState = stateRef.current;
        const hasPendingLocalChanges = !statesEqual(localState, baselineRef.current);
        const action = decideRemoteRevision(revisionRef.current, payload.revision, hasPendingLocalChanges);
        if (action === "ignore") {
          if (!hasPendingLocalChanges && !conflictRef.current) setSyncStatus("synced");
          return;
        }
        if (action === "conflict") {
          conflictRef.current = true;
          setRemoteConflict({ state: serverState, revision: payload.revision });
          setSyncStatus("conflict");
          return;
        }
        const nextState = serverState;
        baselineRef.current = serverState;
        revisionRef.current = payload.revision;
        writeStoredValue(localStorage, baselineKey, JSON.stringify(serverState));
        writeStoredValue(localStorage, revisionKey, String(payload.revision));
        writeStoredValue(localStorage, storageKey, JSON.stringify(nextState));
        setDaily(nextState.daily);
        setWeekly(nextState.weekly);
        setHabitCategories(nextState.categories);
        setMotivations(nextState.motivations.length ? nextState.motivations : dailyMotivations);
        setGoals(nextState.goals);
        setWeeklyReviews(nextState.weeklyReviews);
        conflictRef.current = false;
        setRemoteConflict(null);
        setSyncStatus("synced");
      } finally {
        pulling = false;
      }
    };
    pullLatestRef.current = pullLatest;

    const onFocus = () => { if (document.visibilityState === "visible") void pullLatest(); };
    const onPageShow = () => void pullLatest();
    const unsubscribeRealtime = subscribeToTrackerRevisions(session.user.id, (notifiedRevision) => {
        if (notifiedRevision !== null) pendingRemoteRevisionRef.current = Math.max(pendingRemoteRevisionRef.current ?? 0, notifiedRevision);
        if (!syncInFlight.current) void pullLatest();
      }, (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setSyncStatus((current) => current === "conflict" || current === "saving" ? current : "synced");
          void pullLatest();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncStatus((current) => current === "conflict" || current === "saving" ? current : navigator.onLine ? "error" : "offline");
        }
      });
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onPageShow);
    document.addEventListener("visibilitychange", onFocus);
    void pullLatest();
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onPageShow);
      document.removeEventListener("visibilitychange", onFocus);
      pullLatestRef.current = null;
      unsubscribeRealtime();
    };
  }, [hydrated, session]);

  const resolveConflictWithRemote = () => {
    if (!session || !remoteConflict) return;
    const nextState = normalizeState(remoteConflict.state);
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    baselineRef.current = nextState;
    revisionRef.current = remoteConflict.revision;
    conflictRef.current = false;
    pendingRemoteRevisionRef.current = null;
    writeStoredValue(localStorage, storageKey, JSON.stringify(nextState));
    writeStoredValue(localStorage, baselineKey, JSON.stringify(nextState));
    writeStoredValue(localStorage, revisionKey, String(remoteConflict.revision));
    setDaily(nextState.daily);
    setWeekly(nextState.weekly);
    setHabitCategories(nextState.categories);
    setMotivations(nextState.motivations.length ? nextState.motivations : dailyMotivations);
    setGoals(nextState.goals);
    setWeeklyReviews(nextState.weeklyReviews);
    setRemoteConflict(null);
    setSyncStatus("synced");
  };

  const resolveConflictWithLocal = () => {
    if (!session || !remoteConflict) return;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    baselineRef.current = normalizeState(remoteConflict.state);
    revisionRef.current = remoteConflict.revision;
    conflictRef.current = false;
    writeStoredValue(localStorage, baselineKey, JSON.stringify(baselineRef.current));
    writeStoredValue(localStorage, revisionKey, String(remoteConflict.revision));
    setRemoteConflict(null);
    setSyncStatus("saving");
    setDaily((items) => [...items]);
  };

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
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
  const totalChecks = activeDaily.reduce((sum, habit) => sum + checksFor(habit).filter((d) => d <= evaluatedThrough).length, 0);
  const effectiveGoalThrough = (habit: Habit, through: number) => habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly
    ? scheduledDaysInMonth(habit, year, month, through)
    : Math.min(habit.goal, Math.ceil(habit.goal * through / Math.max(1, days)));
  const eligibleGoalThrough = (habit: Habit, through: number, key = monthKey) => Math.max(0,
    effectiveGoalThrough(habit, through) - skipsFor(habit, key).filter((day) => day <= through).length,
  );
  const totalGoal = activeDaily.reduce((sum, habit) => sum + eligibleGoalThrough(habit, evaluatedThrough), 0);
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
  const habitCompletion = (habit: Habit) => checksFor(habit).length / Math.max(1, goalFor(habit) - skipsFor(habit).length);
  const ranked = [...daily].filter((habit) => !habit.archived).sort((a, b) => habitCompletion(b) - habitCompletion(a));
  const rankingItems = rankingView === "best" ? ranked : [...ranked].reverse();
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

  function createGoal() {
    const title = goalTitle.trim();
    if (!title) return;
    const period = goalPeriodDetails(goalPeriod);
    const nextGoal: Goal = {
      id: editingGoalId ?? Date.now(), title, category: goalCategory, period: goalPeriod, periodKey: period.key,
      measurement: goalMeasurement, targetValue: goalMeasurement === "complete" ? 1 : Math.max(1, goalTarget),
      currentValue: 0, unit: goalMeasurement === "quantity" ? goalUnit.trim() : "",
      status: "active", dueDate: period.due,
      linkedHabitId: undefined,
      linkedHabitIds: goalMeasurement === "quantity" ? goalLinkedHabitIds : [],
      parentAnnualGoalId: (goalPeriod === "weekly" || goalPeriod === "monthly") && goalParentAnnualId ? Number(goalParentAnnualId) : undefined,
    };
    setGoals((items) => editingGoalId
      ? items.map((item) => item.id === editingGoalId ? { ...item, ...nextGoal, currentValue: item.currentValue, status: item.status, archived: item.archived, template: item.template, books: item.books, fitnessEntries: item.fitnessEntries, trackingStart: item.trackingStart } : item)
      : [...items, nextGoal]);
    setGoalTitle(""); setGoalMeasurement("complete"); setGoalTarget(1); setGoalUnit(""); setGoalLinkedHabitIds([]); setGoalParentAnnualId("");
    setEditingGoalId(null); setGoalModalOpen(false);
    if (goalPeriod !== "daily") setGoalFilter(goalPeriod);
  }

  function startGoalEdit(goal: Goal) {
    setEditingGoalId(goal.id); setGoalTitle(goal.title); setGoalPeriod(goal.period); setGoalMeasurement(goal.measurement);
    setGoalTarget(goal.targetValue); setGoalUnit(goal.unit ?? ""); setGoalCategory(goal.category);
    setGoalLinkedHabitIds([...new Set([...(goal.linkedHabitIds ?? []), ...(goal.linkedHabitId ? [goal.linkedHabitId] : [])])]);
    setGoalParentAnnualId(goal.parentAnnualGoalId ?? "");
    setGoalModalOpen(true);
  }

  function updateGoalProgress(goal: Goal, value: number) {
    const currentValue = Math.max(0, Math.min(value, goal.targetValue));
    setGoals((items) => items.map((item) => item.id === goal.id
      ? { ...item, currentValue, status: currentValue >= item.targetValue ? "completed" : "active" }
      : item));
  }

  function markGoalNotCompleted(goal: Goal) {
    setGoals((items) => items.map((item) => item.id === goal.id
      ? { ...item, status: "discarded" }
      : item));
  }

  function addGoalProgress(goal: Goal) {
    const amount = Number(goalProgressDrafts[goal.id] ?? "");
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateGoalProgress(goal, goal.currentValue + amount);
    setGoalProgressDrafts((drafts) => ({ ...drafts, [goal.id]: "" }));
  }

  function addGoalStep(goal: Goal) {
    const title = goalStepDraft.title.trim();
    if (!title || !goalStepDraft.dueDate) return;
    const step: GoalStep = { id: Date.now(), kind: goalStepDraft.kind, title, dueDate: goalStepDraft.dueDate, completed: false };
    setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, steps: [...(item.steps ?? []), step] } : item));
    setGoalStepDraft({ kind: "action", title: "", dueDate: "" });
    setPlanningGoalId(null);
  }

  function toggleGoalStep(goalId: number, stepId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId
      ? { ...goal, steps: (goal.steps ?? []).map((step) => step.id === stepId ? { ...step, completed: !step.completed } : step) }
      : goal));
  }

  function removeGoalStep(goalId: number, stepId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId
      ? { ...goal, steps: (goal.steps ?? []).filter((step) => step.id !== stepId) }
      : goal));
  }

  function deleteGoal(id: number) {
    setGoals((items) => removeGoalAndChildReferences(items, id));
    setDeletingGoal(null);
  }

  function archiveGoal(id: number) {
    setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, archived: true } : goal));
  }

  function restoreGoal(id: number) {
    setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, archived: false } : goal));
  }

  function moveWeeklyGoalToCurrentWeek(id: number) {
    const period = goalPeriodDetails("weekly", today);
    setGoals((items) => items.map((goal) => goal.id === id
      ? { ...goal, periodKey: period.key, dueDate: period.due, currentValue: 0, status: "active" }
      : goal));
  }

  function reorderGoal(sourceId: number, targetId: number) {
    if (sourceId === targetId || goalCategoryFilter !== "all") return;
    setGoals((items) => {
      const sourceIndex = items.findIndex((goal) => goal.id === sourceId);
      const targetIndex = items.findIndex((goal) => goal.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return items;
      const next = [...items];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggingGoalId(null);
  }

  function startGoalPointerDrag(event: React.PointerEvent<HTMLButtonElement>, goalId: number) {
    if (goalCategoryFilter !== "all") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dropTargetId = String(goalId);
    setDraggingGoalId(goalId);
  }

  function moveGoalPointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (draggingGoalId === null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-goal-id]");
    if (target?.dataset.goalId) event.currentTarget.dataset.dropTargetId = target.dataset.goalId;
  }

  function finishGoalPointerDrag(event: React.PointerEvent<HTMLButtonElement>, sourceId: number) {
    const targetId = Number(event.currentTarget.dataset.dropTargetId);
    delete event.currentTarget.dataset.dropTargetId;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (Number.isFinite(targetId)) reorderGoal(sourceId, targetId);
    else setDraggingGoalId(null);
  }

  function createTemplateGoal() {
    if (!templateModal) return;
    const period = goalPeriodDetails("yearly");
    const id = Math.max(0, ...goals.map((goal) => goal.id)) + 1;
    const isReading = templateModal === "reading";
    const goal: Goal = {
      id,
      title: isReading ? "Lectura anual" : "Forma física",
      category: isReading ? "growth" : "health",
      period: "yearly", periodKey: period.key, dueDate: period.due,
      measurement: "quantity", targetValue: isReading ? Math.max(1, readingTarget) : 100,
      currentValue: 0, unit: isReading ? "libros" : "%", status: "active",
      linkedHabitId: isReading ? templateHabitIds[0] : undefined,
      linkedHabitIds: templateHabitIds,
      trackingStart: isoDate(today.getFullYear(), today.getMonth(), today.getDate()),
      template: templateModal,
      books: isReading ? [] : undefined,
      fitnessEntries: isReading ? undefined : [],
    };
    setGoals((items) => [...items, goal]);
    setTemplateModal(null); setTemplateHabitIds([]); setGoalFilter("yearly");
  }

  const isBookCompleted = (book: BookEntry) => book.status === "completed" || (book.status === undefined && Boolean(book.completedAt));

  function withReadingProgress(goal: Goal, books: BookEntry[]) {
    const completed = books.filter(isBookCompleted).length;
    return { ...goal, books, currentValue: Math.min(goal.targetValue, completed), status: completed >= goal.targetValue ? "completed" as const : "active" as const };
  }

  function openBookEditor(goal: Goal, book?: BookEntry, status: "reading" | "completed" = "reading") {
    setBookGoal(goal); setEditingBookId(book?.id ?? null); setBookTitle(book?.title ?? ""); setBookAuthor(book?.author ?? "");
    setBookFormat(book?.format ?? "paper"); setBookStatus(book ? (isBookCompleted(book) ? "completed" : "reading") : status);
  }

  function closeBookEditor() {
    setBookGoal(null); setEditingBookId(null); setBookTitle(""); setBookAuthor(""); setBookFormat("paper"); setBookStatus("reading");
  }

  function saveBook() {
    if (!bookGoal || !bookTitle.trim()) return;
    const now = new Date();
    const todayKey = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
    const previous = bookGoal.books?.find((book) => book.id === editingBookId);
    const entry: BookEntry = { id: editingBookId ?? Date.now(), title: bookTitle.trim(), author: bookAuthor.trim() || undefined, format: bookFormat, status: bookStatus, startedAt: previous?.startedAt ?? todayKey, completedAt: bookStatus === "completed" ? previous?.completedAt ?? todayKey : undefined };
    setGoals((items) => items.map((goal) => goal.id === bookGoal.id
      ? withReadingProgress(goal, editingBookId === null ? [...(goal.books ?? []), entry] : (goal.books ?? []).map((book) => book.id === editingBookId ? entry : book))
      : goal));
    closeBookEditor();
  }

  function completeBook(goalId: number, bookId: number) {
    const now = new Date();
    const todayKey = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
    setGoals((items) => items.map((goal) => goal.id === goalId ? withReadingProgress(goal, (goal.books ?? []).map((book) => book.id === bookId ? { ...book, status: "completed", completedAt: todayKey } : book)) : goal));
  }

  function removeBook(goalId: number, bookId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId ? withReadingProgress(goal, (goal.books ?? []).filter((book) => book.id !== bookId)) : goal));
  }

  function saveFitnessEntry() {
    if (!fitnessGoal) return;
    const parse = (value: string) => value.trim() ? Number(value.replace(",", ".")) : undefined;
    const values = Object.fromEntries(Object.entries(fitnessDraft).map(([key, value]) => [key, parse(value)])) as Record<FitnessMetric, number | undefined>;
    if (Object.values(values).some((value) => value === undefined || Number.isNaN(value) || value < 0)) return;
    const entry: FitnessEntry = { id: Date.now(), recordedAt: localDateKey(), ...(values as Record<FitnessMetric, number>) };
    setGoals((items) => items.map((goal) => goal.id === fitnessGoal.id ? { ...goal, fitnessEntries: [...(goal.fitnessEntries ?? []), entry] } : goal));
    setFitnessGoal(null); setFitnessDraft({ weight: "", muscle: "", fatMass: "", bodyWater: "", bodyFat: "", bmi: "", basalMetabolicRate: "" }); setFitnessImportMessage("");
  }

  async function importSamsungHealth(file?: File) {
    if (!file) return;
    setFitnessImporting(true); setFitnessImportMessage("Leyendo la captura…");
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "spa+eng");
      const text = result.data.text.replace(/,/g, ".");
      const numberAfter = (labels: string[]) => {
        for (const label of labels) {
          const match = text.match(new RegExp(`${label}[^0-9]{0,30}([0-9]{1,4}(?:\\.[0-9]{1,2})?)`, "i"));
          if (match) return match[1];
        }
        return "";
      };
      const weight = numberAfter(["peso", "weight"]);
      const bodyFat = numberAfter(["grasa corporal", "body fat"]);
      const muscle = numberAfter(["músculo esquelético", "musculo esqueletico", "skeletal muscle", "masa muscular"]);
      const fatMass = numberAfter(["masa grasa", "fat mass"]); const bodyWater = numberAfter(["agua corporal", "body water"]); const bmi = numberAfter(["imc", "bmi"]);
      const basalMetabolicRate = numberAfter(["tasa metabólica basal", "tasa metabolica basal", "basal metabolic rate", "bmr"]);
      setFitnessDraft({ weight, muscle, fatMass, bodyWater, bodyFat, bmi, basalMetabolicRate });
      const detected = [weight, muscle, fatMass, bodyWater, bodyFat, bmi, basalMetabolicRate].filter(Boolean).length;
      setFitnessImportMessage(detected ? `${detected} de 7 valores detectados. Revísalos y completa los restantes.` : "No he podido identificar los valores. Puedes introducirlos manualmente.");
    } catch {
      setFitnessImportMessage("No se pudo leer la captura. Introduce los valores manualmente.");
    } finally { setFitnessImporting(false); }
  }

  const yearlyHabitPercent = (habitId?: number) => {
    const habit = daily.find((item) => item.id === habitId);
    if (!habit) return 0;
    let completed = 0; let expected = 0;
    for (let index = 0; index <= today.getMonth(); index += 1) {
      const key = `${today.getFullYear()}-${String(index + 1).padStart(2, "0")}`;
      const monthDays = new Date(today.getFullYear(), index + 1, 0).getDate();
      const through = index === today.getMonth() ? today.getDate() : monthDays;
      completed += (habit.history?.[key] ?? []).filter((day) => day <= through).length;
      expected += habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly ? scheduledDaysInMonth(habit, today.getFullYear(), index, through) : Math.min(habit.goal, through);
    }
    return Math.min(100, Math.round(completed / Math.max(1, expected) * 100));
  };

  const progressResolvedGoals = goals.map((goal) => {
    if (goal.status === "discarded") return goal;
    if (goal.template === "reading") {
      const currentValue = goal.books?.length ?? 0;
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
    if (!hydrated || !session || closureNotice) return;
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
  }, [closureNotice, daily, habitCategories, hydrated, resolvedGoals, session, weekly]);

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

  function pauseInsightHabit(entityId?: number) {
    if (!entityId) return;
    const start = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 12);
    const end = isoDate(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    setDaily((items) => items.map((habit) => habit.id === entityId
      ? { ...habit, schedule: { ...(habit.schedule ?? {}), pausedFrom: start, pausedUntil: end } }
      : habit));
    dismissInsight(`habit-${entityId}`);
  }

  function openView(view: MainView) {
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
  if (passwordRecovery) return <ResetPassword onComplete={() => setPasswordRecovery(false)} />;
  if (!session) return <AuthGate />;

  return (
    <main>
      {closureNotice && <aside className="closure-notice" role="status" aria-live="polite">
        <div className="closure-notice-head"><div><p className="eyebrow">{closureNotice.eyebrow}</p><h2>{closureNotice.title}</h2></div><button onClick={dismissClosureNotice} aria-label="Cerrar resumen">×</button></div>
        <p>{closureNotice.detail}</p>
        <div className="closure-score"><span><small>Nota base</small><strong>{scoreLabel(closureNotice.baseScore)}</strong></span><b>+</b><span className="bonus"><small>Bonus</small><strong>{closureNotice.bonus > 0 ? `+${scoreLabel(closureNotice.bonus)}` : "—"}</strong></span><b>=</b><span className="final"><small>Nota final</small><strong>{scoreLabel(closureNotice.finalScore)}</strong></span></div>
        <button className="closure-confirm" onClick={dismissClosureNotice}>Entendido</button>
      </aside>}
      <header className="topbar">
        <Brand />
        <nav aria-label="Navegación principal">
          <button className={mainView === "summary" ? "nav-active" : ""} onClick={() => openView("summary")}>Resumen</button>
          <button className={mainView === "today" ? "nav-active" : ""} onClick={() => openView("today")}>Tu día</button>
          <button className={mainView === "week" ? "nav-active" : ""} onClick={() => openView("week")}>Semana</button>
          <button className={mainView === "habits" ? "nav-active" : ""} onClick={() => openView("habits")}>Hábitos</button>
          <button className={mainView === "goals" ? "nav-active" : ""} onClick={() => openView("goals")}>Objetivos</button>
        </nav>
        <div className="session-actions">
          <span className="avatar" aria-hidden="true">{(session.user.email?.slice(0, 2) ?? "BR").toUpperCase()}</span>
          <button className="logout-button" onClick={() => getSupabaseBrowserClient().auth.signOut()}>Cerrar sesión</button>
        </div>
      </header>

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

        {mainView === "week" && <>
        <section className="view-intro"><p className="eyebrow">PLANIFICAR · EJECUTAR · REAJUSTAR</p><h1>Tu semana</h1><p>Decide qué importa y convierte los datos de la semana anterior en una mejora concreta.</p></section>
        <section className="weekly-review-grid">
          <article className="panel weekly-plan-card">
            <div className="panel-head"><div><p className="eyebrow">SEMANA ACTUAL</p><h2>Del {currentWeek.start.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} al {currentWeek.end.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</h2></div><span className="weekly-step">01</span></div>
            <p className="weekly-guidance">Elige como máximo tres resultados que justifiquen tu atención. Si todo es prioridad, nada lo es.</p>
            <div className="weekly-priorities">
              {weeklyPlanDraft.priorities.map((priority, index) => <label key={index}><span>Prioridad {index + 1}</span><input maxLength={160} value={priority} placeholder={index === 0 ? "Lo más importante de esta semana" : "Opcional"} onChange={(event) => setWeeklyPlanDraft((draft) => ({ ...draft, priorities: draft.priorities.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /></label>)}
            </div>
            <label className="weekly-text-field"><span>Ajuste del sistema</span><textarea maxLength={500} value={weeklyPlanDraft.adjustment} placeholder="¿Qué vas a cambiar para que esta semana funcione mejor?" onChange={(event) => setWeeklyPlanDraft((draft) => ({ ...draft, adjustment: event.target.value }))} /></label>
            <label className="weekly-text-field"><span>Reflexión en curso</span><textarea maxLength={1500} value={weeklyPlanDraft.reflection} placeholder="Anota contexto, decisiones o aprendizajes mientras avanza la semana." onChange={(event) => setWeeklyPlanDraft((draft) => ({ ...draft, reflection: event.target.value }))} /></label>
            <button className="add-button weekly-save" onClick={saveWeeklyPlan}>{weeklyPlanSaved ? "Guardado ✓" : "Guardar planificación"}</button>
          </article>

          <article className="panel weekly-review-card">
            <div className="panel-head weekly-review-head"><div><p className="eyebrow">HISTORIAL SEMANAL</p><h2>Del {reviewWeek.start.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} al {reviewWeek.end.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</h2></div><span className="weekly-step">02</span></div>
            <div className="week-history-nav" aria-label="Navegar por revisiones semanales"><button onClick={() => setReviewWeekKey(shiftWeekBounds(reviewWeekKey, -1).key)} aria-label="Semana anterior">← Anterior</button><span>{selectedWeeklyReview ? "Reflexión guardada" : "Sin reflexión guardada"}</span><button onClick={() => setReviewWeekKey(shiftWeekBounds(reviewWeekKey, 1).key)} disabled={reviewWeek.key >= previousWeek.key} aria-label="Semana siguiente">Siguiente →</button></div>
            <div className="weekly-score-row"><div><span>Nota semanal</span><strong>{scoreLabel(reviewSummary.score)}<small> / 10</small></strong></div><div><span>Hábitos</span><strong>{reviewSummary.completed}<small> / {reviewSummary.scheduled}</small></strong></div><div><span>Objetivos</span><strong>{reviewCompletedGoals}<small> / {reviewGoals.length}</small></strong></div></div>
            <div className="weekly-blocks"><h3>Balance por bloques</h3>{reviewSummary.categories.map((summary) => { const category = habitCategories.find((item) => item.id === summary.categoryId); return <div className="weekly-block-row" key={summary.categoryId}><span><i style={{ background: category?.color }} />{category?.label ?? "Sin bloque"}</span><div><i style={{ width: `${summary.percent}%`, background: category?.color }} /></div><strong>{Math.round(summary.percent)}%</strong></div>; })}{!reviewSummary.categories.length && <p className="today-empty">No hay datos programados para esta semana.</p>}</div>
            <div className="weekly-signal"><span>SEÑAL A REVISAR</span><strong>{weakestWeeklyCategory ? `${habitCategories.find((item) => item.id === weakestWeeklyCategory.categoryId)?.label ?? "Un bloque"} quedó en ${Math.round(weakestWeeklyCategory.percent)}%.` : "Aún no hay datos suficientes."}</strong><p>{weakestWeeklyCategory && weakestWeeklyCategory.percent < 60 ? "No añadas más carga: reduce fricción o reajusta la programación." : "Mantén el sistema estable antes de aumentar la exigencia."}</p></div>
            <div className="weekly-reflection"><span>Reflexión registrada</span><p>{selectedWeeklyReview?.reflection || "No dejaste una reflexión para esta semana."}</p>{selectedWeeklyReview?.adjustment && <small>Ajuste decidido: {selectedWeeklyReview.adjustment}</small>}{selectedWeeklyReview?.priorities.length ? <small>Prioridades: {selectedWeeklyReview.priorities.join(" · ")}</small> : null}</div>
          </article>
        </section>
        </>}

        {mainView === "today" && <>
        <section className="view-intro"><p className="eyebrow">ACCIÓN DIARIA</p><h1>Tu día</h1><p>Lo que requiere tu atención hoy, sin ruido.</p></section>
        <section className="panel today-panel" id="today">
          <div className="today-head">
            <div><p className="eyebrow">{isViewingToday ? "HOY" : "DÍA CONSULTADO"} · {dayViewDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p><h2>Tu día, en una sola vista</h2><p>Marca lo que completas y mantén a la vista los resultados que estás persiguiendo.</p></div>
            <div className="today-head-summary"><strong>{dayViewCompleted}/{dayViewHabits.length} hábitos</strong><strong>Nota {scoreLabel(dayViewScore.finalScore)} / 10</strong></div>
          </div>
          <div className="day-navigation"><button onClick={() => shiftDayView(-1)} aria-label="Ver el día anterior">← Día anterior</button><button onClick={() => shiftDayView(1)} disabled={isViewingToday} aria-label="Ver el día siguiente">Día siguiente →</button>{!isViewingToday && <button onClick={() => setDayViewDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}>Volver a hoy</button>}</div>
          <div className="today-grid">
            <article className="today-column-card">
              <div className="today-section-title"><h3>Hábitos del día</h3><span>{dayViewHabits.length}</span></div>
              <div className="today-list grouped">
                {dayViewHabitGroups.map(({ category, habits }) => { const collapsed = isHabitBlockCollapsed("today-daily", category.id); return <div className={`today-block ${collapsed ? "is-collapsed" : ""}`} key={category.id}><button type="button" className="today-block-title" style={{ color: category.color }} onClick={() => toggleHabitBlock("today-daily", category.id)} aria-expanded={!collapsed}><span>{category.icon}</span><strong>{category.label}{category.priority ? " ★" : ""}</strong><small>{Math.round(dayViewCategoryScores.get(category.id)?.percent ?? 0)}%</small><i aria-hidden="true">⌄</i></button>{!collapsed && habits.map((habit) => {
                  const checked = (habit.history?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate());
                  const missed = !checked && (habit.misses?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate());
                  const skipped = !checked && (habit.skips?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate());
                  return <button key={habit.id} className={`today-item ${checked ? "done" : missed ? "missed" : skipped ? "skipped" : ""}`} {...longPressProps(() => toggleDayViewHabit(habit.id), () => cycleException("daily", habit.id, dayViewDate))} aria-pressed={checked} title="Pulsación larga: no completado → omitido → pendiente">
                    <i style={{ background: habit.color }} /><span><strong>{habit.name}</strong><small>{checked ? "Completado" : missed ? "No completado" : skipped ? "Omitido · no afecta a la puntuación" : "Pendiente"}</small></span><b>{checked ? "✓" : missed ? "✕" : skipped ? "—" : ""}</b>
                  </button>;
                })}</div>; })}
                {!dayViewHabits.length && <p className="today-empty">No tienes hábitos previstos para este día.</p>}
              </div>
              {!!dayViewWeekly.length && <><div className="today-section-title secondary"><h3>Esta semana</h3><span>{dayViewWeekly.length}</span></div><div className="today-list compact grouped">{weeklyHabitGroups.map(({ category, habits }) => { const collapsed = isHabitBlockCollapsed("today-weekly", category.id); return <div className={`today-block ${collapsed ? "is-collapsed" : ""}`} key={category.id}><button type="button" className="today-block-title" style={{ color: category.color }} onClick={() => toggleHabitBlock("today-weekly", category.id)} aria-expanded={!collapsed}><span>{category.icon}</span><strong>{category.label}{category.priority ? " ★" : ""}</strong><small>{habits.length}</small><i aria-hidden="true">⌄</i></button>{!collapsed && habits.map((habit) => {
                const weekDays = daysForMonthWeek(dayViewDate.getFullYear(), dayViewDate.getMonth(), dayViewWeekIndex);
                const count = (habit.history?.[dayViewMonthKey] ?? []).filter((day) => weekDays.includes(day)).length;
                const doneOnDay = (habit.history?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate());
                const missed = !doneOnDay && (habit.misses?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate());
                const skipped = !doneOnDay && (habit.skips?.[dayViewMonthKey] ?? []).includes(dayViewDate.getDate());
                return <button key={habit.id} className={`today-item ${doneOnDay ? "done" : missed ? "missed" : skipped ? "skipped" : ""}`} {...longPressProps(() => toggleDayViewWeeklyHabit(habit.id), () => cycleException("weekly", habit.id, dayViewDate))} aria-pressed={doneOnDay} title="Pulsación larga: no completado → omitido → pendiente"><i style={{ background: habit.color }} /><span><strong>{habit.name}</strong><small>{count}/{Math.min(habit.goal, weekDays.length)} esta semana{doneOnDay ? " · hecho este día" : missed ? " · no completado" : skipped ? " · omitido" : ""}</small></span><b>{doneOnDay ? "✓" : missed ? "✕" : skipped ? "—" : "+"}</b></button>;
              })}</div>; })}</div></>}
            </article>
            <article className="today-column-card">
              <div className="today-section-title"><h3>Objetivos en foco</h3><span>{dayViewGoals.length}</span></div>
              <div className="today-goals">
                {dayViewGoals.map((goal) => {
                  const category = habitCategories.find((item) => item.id === goal.category) ?? habitCategories[0];
                  const progress = Math.min(100, Math.round(goal.currentValue / Math.max(1, goal.targetValue) * 100));
                  const completed = goal.status === "completed" || goal.currentValue >= goal.targetValue;
                  const missed = goal.status === "discarded";
                  return <div className="today-goal" key={goal.id} style={{ "--goal-color": category?.color ?? "#39c6a4" } as CSSProperties}>
                    <div><span>{category?.icon} {goal.period === "daily" ? "Hoy" : goal.period === "weekly" ? "Semana" : goal.period === "monthly" ? "Mes" : "Año"}</span><strong>{goal.title}</strong><small>{progress}% · vence {new Date(`${goal.dueDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small></div>
                    <span className="today-goal-status">
                      {goal.measurement !== "complete" && <b>{goal.currentValue}/{goal.targetValue}{goal.unit ? ` ${goal.unit}` : ""}</b>}
                      <button
                        className={completed ? "done" : missed ? "missed" : "pending"}
                        {...longPressProps(
                          () => updateGoalProgress(goal, completed || missed ? 0 : goal.targetValue),
                          () => markGoalNotCompleted(goal),
                        )}
                        aria-label={completed || missed ? `Dejar ${goal.title} pendiente` : `Marcar ${goal.title} como completado`}
                        title="Pulsa para completar · mantén pulsado para marcar como no completado"
                      >{completed ? "✓" : missed ? "✕" : ""}</button>
                    </span>
                  </div>;
                })}
                {!dayViewGoals.length && <p className="today-empty">No hay objetivos que requieran atención este día.</p>}
              </div>
            </article>
          </div>
        </section>
        </>}

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
            <div className="panel-head ranking-head"><div><p className="eyebrow">CLASIFICACIÓN</p><h2>{rankingView === "best" ? "Hábitos destacados" : "Hábitos a vigilar"}</h2></div><span className="trophy">{rankingView === "best" ? "✦" : "!"}</span></div>
            <div className="tabs ranking-tabs" role="tablist" aria-label="Tipo de clasificación">
              <button role="tab" aria-selected={rankingView === "best"} className={rankingView === "best" ? "active" : ""} onClick={() => setRankingView("best")}>Destacados</button>
              <button role="tab" aria-selected={rankingView === "watch"} className={rankingView === "watch" ? "active" : ""} onClick={() => setRankingView("watch")}>A vigilar</button>
            </div>
            <div className="rank-list">
              {rankingItems.slice(0, 5).map((habit, index) => {
                const progress = Math.min(100, Math.round(checksFor(habit).length / goalFor(habit) * 100));
                return <div className="rank-row" key={habit.id}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div><span>{habit.name}</span><div className="mini-track"><i style={{ width: `${progress}%`, background: habit.color }} /></div></div>
                  <strong>{progress}%</strong>
                </div>;
              })}
            </div>
          </article>
        </section>

        <section className="panel actionable-insights" aria-labelledby="actionable-insights-title">
          <div className="panel-head"><div><p className="eyebrow">SEÑALES ACCIONABLES</p><h2 id="actionable-insights-title">Qué conviene ajustar ahora</h2></div><span className="insight-method">Diagnósticos explicables · no modifican nada por sí solos</span></div>
          <div className="insight-grid">{actionableInsights.map((insight) => <article className={`insight-card ${insight.severity}`} key={insight.id}><span>{insight.kind === "goal" ? "OBJETIVO" : insight.kind === "habit" ? "HÁBITO" : insight.kind === "weekday" ? "PATRÓN SEMANAL" : "TENDENCIA"}</span><strong>{insight.title}</strong><p>{insight.detail}</p><div className="insight-evidence"><b>Por qué aparece</b><p>{insight.evidence}</p><b>Regla aplicada</b><p>{insight.rule}</p><em>{insight.period}</em></div><small>{insight.action}</small><div className="insight-actions">{insight.kind === "habit" && <><button onClick={() => editInsightEntity("habit", insight.entityId)}>Editar hábito</button><button onClick={() => pauseInsightHabit(insight.entityId)}>Pausar 7 días</button></>}{insight.kind === "goal" && <button onClick={() => editInsightEntity("goal", insight.entityId)}>Ajustar objetivo</button>}<button className="quiet" onClick={() => dismissInsight(insight.id)}>Ocultar 7 días</button></div></article>)}</div>
          {!actionableInsights.length && <div className="insights-empty"><strong>No hay señales visibles</strong><p>Las señales ocultadas volverán a mostrarse automáticamente en siete días si siguen siendo relevantes.</p></div>}
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

        {mainView === "goals" && <>
        <section className="view-intro"><p className="eyebrow">RESULTADOS</p><h1>Objetivos</h1><p>Define resultados concretos y comprueba si tus hábitos te acercan a ellos.</p></section>
        <section className="panel goals-panel" id="goals">
          <div className="goals-head">
            <div><p className="eyebrow">RESULTADOS CON RUMBO</p><h2>Tus objetivos</h2><p>Define el resultado; tus hábitos sostienen el camino.</p></div>
            <div className="goal-head-actions">
              <button className="reset-button archived-button" onClick={() => setArchivedManagerOpen(true)}>
                Archivados{archivedCount > 0 && <span>{archivedCount}</span>}
              </button>
              <button className="template-button" onClick={() => setTemplateModal("fitness")}><span aria-hidden="true">♥</span>Forma física</button>
              <button className="template-button" onClick={() => setTemplateModal("reading")}><span aria-hidden="true">▥</span>Lectura anual</button>
              <button className="add-button" onClick={() => { setEditingGoalId(null); setGoalTitle(""); setGoalPeriod("monthly"); setGoalMeasurement("complete"); setGoalTarget(1); setGoalUnit(""); setGoalLinkedHabitIds([]); setGoalParentAnnualId(""); setGoalModalOpen(true); }}>+ Añadir objetivo</button>
            </div>
          </div>
          <div className="goal-toolbar">
          <div className="tabs goal-tabs">
            {(["weekly", "monthly", "yearly"] as const).map((filter) => (
              <button key={filter} className={goalFilter === filter ? "active" : ""} onClick={() => setGoalFilter(filter)}>
                {{ weekly: "Semana", monthly: "Mes", yearly: "Año" }[filter]}
              </button>
            ))}
          </div>
          <label className="goal-block-filter"><span>Bloque</span><select value={goalCategoryFilter} onChange={(event) => setGoalCategoryFilter(event.target.value)}><option value="all">Todos los bloques</option>{habitCategories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}</select></label>
          </div>
          {goalCategoryFilter !== "all" && <p className="goal-filter-note">Quita el filtro de bloque para reordenar las tarjetas.</p>}
          {visibleGoals.length ? <div className="goal-grid">{visibleGoals.map((goal) => {
            const category = habitCategories.find((item) => item.id === goal.category) ?? habitCategories[0];
            const progress = Math.min(100, Math.round(goal.currentValue / Math.max(1, goal.targetValue) * 100));
            const parentAnnualGoal = goal.parentAnnualGoalId ? resolvedGoals.find((item) => item.id === goal.parentAnnualGoalId) : undefined;
            const linkedMilestones = goal.period === "yearly" ? resolvedGoals.filter((item) => (item.period === "weekly" || item.period === "monthly") && item.parentAnnualGoalId === goal.id && item.status !== "discarded") : [];
            const visibleMilestones = linkedMilestones.filter((item) => !item.archived);
            const archivedMilestones = linkedMilestones.length - visibleMilestones.length;
            const isOverdueWeekly = goal.period === "weekly" && goal.status === "active" && goal.dueDate < realTodayKey;
            return <article data-goal-id={goal.id} className={`goal-card ${draggingGoalId === goal.id ? "is-dragging" : ""}`} key={goal.id} style={{ "--goal-color": category?.color ?? "#39c6a4" } as CSSProperties}>
              <div className="goal-card-head"><span>{category?.icon} {category?.label}</span><div className="goal-card-actions"><button type="button" className="goal-drag-handle" disabled={goalCategoryFilter !== "all"} onPointerDown={(event) => startGoalPointerDrag(event, goal.id)} onPointerMove={moveGoalPointerDrag} onPointerUp={(event) => finishGoalPointerDrag(event, goal.id)} onPointerCancel={() => setDraggingGoalId(null)} aria-label={`Arrastrar ${goal.title} para reordenar`} title={goalCategoryFilter === "all" ? "Arrastrar para reordenar" : "Quita el filtro para reordenar"}>⠿</button>{goal.status === "completed" && <button className="goal-archive" onClick={() => archiveGoal(goal.id)} aria-label={`Archivar ${goal.title}`} title="Archivar objetivo completado">▣</button>}<button onClick={() => startGoalEdit(goal)} aria-label={`Editar ${goal.title}`}>✎</button><button onClick={() => setDeletingGoal(goal)} aria-label={`Borrar ${goal.title}`}>×</button></div></div>
              <h3>{goal.title}</h3>
              {isOverdueWeekly && <small className="goal-overdue-label">Pendiente de la semana anterior</small>}
              {parentAnnualGoal && <small className="goal-parent-link">Hito de: {parentAnnualGoal.title}</small>}
              <div className="goal-progress"><i style={{ width: `${progress}%` }} /></div>
              <div className="goal-card-foot"><strong>{goal.currentValue} / {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ""}</strong><span>{progress}% · hasta {new Date(`${goal.dueDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></div>
              {linkedMilestones.length > 0 && <div className="goal-milestones"><strong>{linkedMilestones.filter((item) => item.status === "completed").length} de {linkedMilestones.length} objetivos vinculados</strong>{visibleMilestones.map((item) => <span key={item.id} className={item.status === "completed" ? "done" : ""}>{item.status === "completed" ? "✓" : "○"} {item.title}</span>)}{archivedMilestones > 0 && <small>{archivedMilestones} {archivedMilestones === 1 ? "hito archivado incluido" : "hitos archivados incluidos"}</small>}</div>}
              {(goal.steps ?? []).length > 0 && <div className="goal-plan"><div className="goal-plan-summary"><strong>Plan</strong><span>{(goal.steps ?? []).filter((step) => step.completed).length}/{(goal.steps ?? []).length}</span></div>{(goal.steps ?? []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((step) => <div className={`goal-step ${step.completed ? "done" : ""}`} key={step.id}><button className="goal-step-toggle" onClick={() => toggleGoalStep(goal.id, step.id)} aria-label={`${step.completed ? "Reabrir" : "Completar"} ${step.title}`}>{step.completed ? "✓" : "○"}</button><span><strong>{step.title}</strong><small>{step.kind === "milestone" ? "Hito" : "Acción"} · {new Date(`${step.dueDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small></span><button className="goal-step-delete" onClick={() => removeGoalStep(goal.id, step.id)} aria-label={`Eliminar ${step.title}`}>×</button></div>)}</div>}
              {planningGoalId === goal.id ? <form className="goal-step-form" onSubmit={(event) => { event.preventDefault(); addGoalStep(goal); }}><select value={goalStepDraft.kind} onChange={(event) => setGoalStepDraft((draft) => ({ ...draft, kind: event.target.value as GoalStep["kind"] }))}><option value="action">Acción</option><option value="milestone">Hito</option></select><input maxLength={160} value={goalStepDraft.title} onChange={(event) => setGoalStepDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Qué hay que conseguir" aria-label="Título del paso" /><input type="date" value={goalStepDraft.dueDate} onChange={(event) => setGoalStepDraft((draft) => ({ ...draft, dueDate: event.target.value }))} aria-label="Fecha del paso" /><div><button type="button" onClick={() => setPlanningGoalId(null)}>Cancelar</button><button type="submit" disabled={!goalStepDraft.title.trim() || !goalStepDraft.dueDate}>Añadir</button></div></form> : <button className="goal-add-step" onClick={() => { setPlanningGoalId(goal.id); setGoalStepDraft({ kind: "action", title: "", dueDate: goal.dueDate }); }}>+ Añadir hito o acción</button>}
              {goal.template === "reading" ? <><div className="book-add-actions"><button className="goal-complete" onClick={() => openBookEditor(goal)}>+ Libro en proceso</button><button className="goal-complete" onClick={() => openBookEditor(goal, undefined, "completed")}>+ Libro terminado</button></div><div className="goal-entry-list">{(goal.books ?? []).slice().reverse().map((book) => <div className="book-entry" key={book.id}><span><strong>{book.title}</strong><small>{book.author || "Autor no indicado"} · {{ audio: "Audiolibro", digital: "Electrónico", paper: "Papel" }[book.format]}</small></span><span className="book-entry-actions">{!isBookCompleted(book) && <button onClick={() => completeBook(goal.id, book.id)}>Terminar</button>}<button onClick={() => openBookEditor(goal, book)} aria-label={`Editar ${book.title}`}>Editar</button><button className="danger" onClick={() => removeBook(goal.id, book.id)} aria-label={`Eliminar ${book.title}`}>×</button></span></div>)}</div><small className="goal-consistency">{(goal.books ?? []).filter((book) => !isBookCompleted(book)).length} en proceso · {(goal.books ?? []).filter(isBookCompleted).length} terminados · Constancia: {goal.linkedHabitId ? `${yearlyHabitPercent(goal.linkedHabitId)}%` : "sin hábito vinculado"}</small></>
                : goal.template === "fitness" ? <><small className="goal-consistency">{(goal.linkedHabitIds ?? []).length ? `${(goal.linkedHabitIds ?? []).length} hábitos · cada uno pondera ${(100 / (goal.linkedHabitIds ?? []).length).toFixed(2)}% al día` : "Sin hábitos vinculados"}</small><button className="goal-complete" onClick={() => setFitnessGoal(goal)}>+ Actualizar métricas</button><div className="fitness-chart-controls"><select value={fitnessMetric} onChange={(event) => setFitnessMetric(event.target.value as FitnessMetric)}>{Object.entries(fitnessMetricMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select><div className="tabs">{([30, 90, 365] as const).map((period) => <button key={period} className={fitnessPeriod === period ? "active" : ""} onClick={() => setFitnessPeriod(period)}>{period === 30 ? "30 días" : period === 90 ? "3 meses" : "1 año"}</button>)}</div></div><FitnessChart entries={goal.fitnessEntries ?? []} metric={fitnessMetric} period={fitnessPeriod} /></>
                : isOverdueWeekly ? <div className="goal-weekly-actions"><button onClick={() => moveWeeklyGoalToCurrentWeek(goal.id)}>Mover a esta semana</button><button className="danger" onClick={() => setDeletingGoal(goal)}>Eliminar</button></div>
                : goal.measurement === "complete" ? <button className="goal-complete" onClick={() => updateGoalProgress(goal, goal.currentValue >= 1 ? 0 : 1)}>{goal.currentValue >= 1 ? "Reabrir" : "Marcar completado"}</button>
                : <form className="goal-value" onSubmit={(event) => { event.preventDefault(); addGoalProgress(goal); }}>
                    <label htmlFor={`goal-progress-${goal.id}`}>Añadir progreso</label>
                    <div className="goal-value-entry">
                      <input id={`goal-progress-${goal.id}`} type="number" min="0" max={Math.max(0, goal.targetValue - goal.currentValue)} step="any" inputMode="decimal" value={goalProgressDrafts[goal.id] ?? ""} onChange={(event) => setGoalProgressDrafts((drafts) => ({ ...drafts, [goal.id]: event.target.value }))} placeholder={goal.unit ? `Cantidad en ${goal.unit}` : "Cantidad"} aria-label={`Cantidad que añadir a ${goal.title}`} />
                      <button type="submit" disabled={!Number.isFinite(Number(goalProgressDrafts[goal.id])) || Number(goalProgressDrafts[goal.id]) <= 0 || goal.currentValue >= goal.targetValue}>Sumar</button>
                    </div>
                  </form>}
            </article>;
          })}</div> : <div className="goals-empty"><strong>No hay objetivos en este periodo{goalCategoryFilter !== "all" ? " y bloque" : ""}</strong><p>{activeGoals.length ? "Cambia el periodo o el filtro para ver tus otros objetivos." : "Crea un resultado concreto y medible para orientar tus hábitos."}</p></div>}
        </section>
        </>}

        {mainView === "habits" && <>
        <section className="view-intro"><p className="eyebrow">SISTEMAS</p><h1>Hábitos</h1><p>Configura tus rutinas, registra el seguimiento y protege tu constancia.</p></section>
        <section className="tracker panel" id="tracker">
          <div className="tracker-head">
            <div>
              <p className="eyebrow">REGISTRO INTERACTIVO</p>
              <h2>Tu constancia, día a día</h2>
            </div>
            <div className="tracker-actions">
              {canManagePhrases && <button className="reset-button" onClick={() => setMotivationManagerOpen(true)}>Frases</button>}
              <button className="reset-button blocks-button" onClick={() => { setCategoryManagerOpen(true); startCategoryEdit(); }}>Gestionar bloques</button>
              <button className="reset-button blocks-button" onClick={() => { setBackupManagerOpen(true); setBackupPreview(null); setBackupMessage(""); }}>Copia de datos</button>
              <button className="reset-button archived-button" onClick={() => setArchivedManagerOpen(true)}>
                Archivados{archivedCount > 0 && <span>{archivedCount}</span>}
              </button>
              <div className="tabs">
                <button className={activeTab === "daily" ? "active" : ""} onClick={() => setActiveTab("daily")}>Diarios</button>
                <button className={activeTab === "weekly" ? "active" : ""} onClick={() => setActiveTab("weekly")}>Semanales</button>
              </div>
              <button className="add-button" onClick={() => { setModal(activeTab); setNewGoal(activeTab === "daily" ? 12 : 1); setEveryDay(false); setWeekdaysOnly(false); resetScheduleDraft(); setSelectedCategory("health"); }}>+ Añadir hábito</button>
            </div>
          </div>

          {activeTab === "daily" ? (
            <DailyHabitTracker year={year} month={month} days={days} today={today} todayNumber={todayNumber} evaluatedThrough={evaluatedThrough} calendar={calendar} categories={habitCategories} habits={activeDaily.map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) }))} draggingHabitId={dragging?.type === "daily" ? dragging.id : undefined} scrollRef={tableScrollRef} isCollapsed={(categoryId) => isHabitBlockCollapsed("habits-daily", categoryId)} onToggleCategory={(categoryId) => toggleHabitBlock("habits-daily", categoryId)} goalFor={goalFor} checksFor={checksFor} missesFor={missesFor} skipsFor={skipsFor} toggleProps={longPressProps} onToggleDay={toggleDaily} onCycleException={(habitId, targetDate) => cycleException("daily", habitId, targetDate)} onManageHabit={(habit) => setActionHabit({ type: "daily", habit })} onDragStart={(id) => setDragging({ type: "daily", id })} onDragEnd={() => setDragging(null)} onReorder={(sourceId, targetId) => reorderHabit("daily", sourceId, targetId)} />
          ) : (
            <WeeklyHabitTracker year={year} month={month} monthName={monthNames[month]} today={today} isPastMonth={isPastMonth} monthWeeks={monthWeeks} currentMonthWeek={currentMonthWeek} categories={habitCategories} habits={activeWeekly.map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) }))} draggingHabitId={dragging?.type === "weekly" ? dragging.id : undefined} isCollapsed={(categoryId) => isHabitBlockCollapsed("habits-weekly", categoryId)} onToggleCategory={(categoryId) => toggleHabitBlock("habits-weekly", categoryId)} checksFor={weeklyChecksFor} onChangeCount={changeWeeklyCount} onManageHabit={(habit) => setActionHabit({ type: "weekly", habit: habit as WeeklyHabit })} onDragStart={(id) => setDragging({ type: "weekly", id })} onDragEnd={() => setDragging(null)} onReorder={(sourceId, targetId) => reorderHabit("weekly", sourceId, targetId)} />
          )}
          <SyncStatus status={syncStatus} onUseRemote={resolveConflictWithRemote} onKeepLocal={resolveConflictWithLocal} />
        </section>
        </>}
      </div>

      {templateModal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setTemplateModal(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setTemplateModal(null)} aria-label="Cerrar">×</button>
        <p className="eyebrow">OBJETIVO PREDETERMINADO</p><h2>{templateModal === "fitness" ? "Forma física" : "Lectura anual"}</h2>
        <p>{templateModal === "fitness" ? "Vincula tus hábitos de Salud y registra la evolución de tu composición corporal." : "Registra cada libro terminado y mide por separado tu constancia diaria de lectura."}</p>
        {templateModal === "reading" && <label>Libros que quieres leer este año<input type="number" min="1" max="200" value={readingTarget} onChange={(event) => setReadingTarget(Number(event.target.value))} /></label>}
        <fieldset className="habit-link-fieldset"><legend>{templateModal === "fitness" ? "Hábitos de Salud vinculados" : "Hábito diario de lectura"}</legend>{daily.filter((habit) => !habit.archived && (templateModal === "fitness" ? habit.category === "health" : /leer|lectura/i.test(habit.name))).map((habit) => <label className="habit-link-option" key={habit.id}><input type={templateModal === "fitness" ? "checkbox" : "radio"} name="template-habit" checked={templateHabitIds.includes(habit.id)} onChange={() => setTemplateHabitIds((ids) => templateModal === "fitness" ? ids.includes(habit.id) ? ids.filter((id) => id !== habit.id) : [...ids, habit.id] : [habit.id])} /><span>{habit.name}</span></label>)}</fieldset>
        <button className="add-button full" onClick={createTemplateGoal}>Crear objetivo</button>
      </div></div>}

      {bookGoal && <div className="modal-backdrop" role="presentation" onMouseDown={closeBookEditor}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={closeBookEditor} aria-label="Cerrar">×</button><p className="eyebrow">LECTURA ANUAL</p><h2>{editingBookId === null ? "Registrar libro" : "Editar libro"}</h2>
        <label>Título<input autoFocus value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="Título del libro" /></label>
        <label>Autor<input value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} placeholder="Autor del libro" /></label>
        <label>Estado<select value={bookStatus} onChange={(event) => setBookStatus(event.target.value as "reading" | "completed")}><option value="reading">En proceso</option><option value="completed">Terminado</option></select></label>
        <label>Formato<select value={bookFormat} onChange={(event) => setBookFormat(event.target.value as BookFormat)}><option value="paper">Papel</option><option value="digital">Electrónico</option><option value="audio">Audiolibro</option></select></label>
        <button className="add-button full" disabled={!bookTitle.trim()} onClick={saveBook}>{editingBookId === null ? "Añadir libro" : "Guardar cambios"}</button>
      </div></div>}

      {fitnessGoal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setFitnessGoal(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setFitnessGoal(null)} aria-label="Cerrar">×</button><p className="eyebrow">SAMSUNG HEALTH</p><h2>Actualizar composición corporal</h2>
        <label className="health-upload">Subir captura de Samsung Health<input type="file" accept="image/*" onChange={(event) => void importSamsungHealth(event.target.files?.[0])} /><span>{fitnessImporting ? "Analizando…" : "Seleccionar captura"}</span></label>
        {fitnessImportMessage && <p className="import-message">{fitnessImportMessage}</p>}
        <div className="goal-form-row fitness-fields">{(Object.entries(fitnessMetricMeta) as [FitnessMetric, { label: string; unit: string }][]).map(([key, meta]) => <label key={key}>{meta.label}{meta.unit ? ` (${meta.unit})` : ""}<input required inputMode="decimal" value={fitnessDraft[key]} onChange={(event) => setFitnessDraft((draft) => ({ ...draft, [key]: event.target.value }))} /></label>)}</div>
        <p className="form-note">Revisa los valores detectados antes de guardarlos; la lectura automática puede confundirse según la captura.</p>
        <button className="add-button full" disabled={Object.values(fitnessDraft).some((value) => !value.trim())} onClick={saveFitnessEntry}>Guardar valores</button>
      </div></div>}

      {deletingGoal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeletingGoal(null)}><div className="modal confirm-modal" role="alertdialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">BORRAR OBJETIVO</p><h2>¿Borrar “{deletingGoal.title}”?</h2><p>También se eliminará su historial específico. Los hábitos vinculados no se borrarán y, si es un objetivo anual, sus hitos quedarán desvinculados.</p>
        <button className="danger-button full" onClick={() => deleteGoal(deletingGoal.id)}>Borrar definitivamente</button>
      </div></div>}

      {goalModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => { setGoalModalOpen(false); setEditingGoalId(null); }}>
        <div className="modal goal-editor-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="close" onClick={() => { setGoalModalOpen(false); setEditingGoalId(null); }} aria-label="Cerrar">×</button>
          <p className="eyebrow">{editingGoalId ? "EDITAR RESULTADO" : "NUEVO RESULTADO"}</p><h2 id="goal-modal-title">{editingGoalId ? "Editar objetivo" : "Añadir objetivo"}</h2>
          <label>Objetivo<input autoFocus maxLength={160} value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Ej. Ahorrar 4.000 €" /></label>
          <label>Periodo<select value={goalPeriod === "daily" ? "weekly" : goalPeriod} onChange={(event) => setGoalPeriod(event.target.value as GoalPeriod)}><option value="weekly">Esta semana</option><option value="monthly">Este mes</option><option value="yearly">Este año</option></select></label>
          {(goalPeriod === "weekly" || goalPeriod === "monthly") && <label>Objetivo anual vinculado (opcional)<select value={goalParentAnnualId} onChange={(event) => setGoalParentAnnualId(event.target.value ? Number(event.target.value) : "")}><option value="">Sin objetivo anual vinculado</option>{goals.filter((goal) => goal.period === "yearly" && goal.periodKey === String(new Date().getFullYear()) && goal.id !== editingGoalId && goal.status !== "discarded" && !goal.archived).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><small className="field-help">Al completarlo, contará como un hito dentro del objetivo anual.</small></label>}
          <label>Pilar<select value={goalCategory} onChange={(event) => setGoalCategory(event.target.value)}>{habitCategories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}</select></label>
          <label>Cómo se mide<select value={goalMeasurement} onChange={(event) => setGoalMeasurement(event.target.value as "complete" | "quantity")}><option value="complete">Completado / pendiente</option><option value="quantity">Mediante una cantidad</option></select></label>
          {goalMeasurement === "quantity" && <fieldset className="goal-habit-picker"><legend>Vincular hábitos diarios (opcional)</legend><small>{goalLinkedHabitIds.length ? `${goalLinkedHabitIds.length} ${goalLinkedHabitIds.length === 1 ? "hábito vinculado" : "hábitos vinculados"}` : "Sin hábitos: el progreso se actualizará manualmente"}</small><div>{daily.filter((habit) => !habit.archived).map((habit) => <label key={habit.id}><input type="checkbox" checked={goalLinkedHabitIds.includes(habit.id)} onChange={() => setGoalLinkedHabitIds((ids) => ids.includes(habit.id) ? ids.filter((id) => id !== habit.id) : [...ids, habit.id])} /><span style={{ background: habit.color }} aria-hidden="true" />{habit.name}</label>)}</div></fieldset>}
          {goalMeasurement === "quantity" && <div className="goal-form-row"><label>Meta<input type="number" min="1" value={goalTarget} onChange={(event) => setGoalTarget(Number(event.target.value))} /></label><label>Unidad<input maxLength={24} value={goalUnit} onChange={(event) => setGoalUnit(event.target.value)} placeholder="€, kg, páginas…" /></label></div>}
          <button className="add-button full goal-modal-submit" onClick={createGoal}>{editingGoalId ? "Guardar cambios" : "Crear objetivo"}</button>
        </div>
      </div>}

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setModal(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">NUEVO REGISTRO</p>
          <h2 id="modal-title">Añadir hábito {modal === "daily" ? "diario" : "semanal"}</h2>
          <label>Nombre<input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Caminar 30 minutos" /></label>
          <label>Bloque<select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>{habitCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
          {modal === "daily" && <div className="frequency-options">
            {([['monthly', 'Días al mes', 'Define una meta mensual flexible.'], ['daily', 'Todos los días', `Objetivo automático de ${days} días.`], ['weekdays', 'Días laborables', 'De lunes a viernes.'], ['selectedWeekdays', 'Días concretos', 'Elige los días de la semana.'], ['interval', 'Cada X días', 'Repite desde una fecha de inicio.']] as const).map(([value, label, help]) => <label className="frequency-toggle" key={value}><input type="radio" name="new-frequency" checked={scheduleMode === value} onChange={() => { setScheduleMode(value); setEveryDay(value === 'daily'); setWeekdaysOnly(value === 'weekdays'); }} /><span><strong>{label}</strong><small>{help}</small></span></label>)}
            {scheduleMode === "selectedWeekdays" && <fieldset className="weekday-picker"><legend>Días programados</legend>{[[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]].map(([value, label]) => <button type="button" key={value} className={selectedWeekdays.includes(Number(value)) ? "selected" : ""} onClick={() => setSelectedWeekdays((items) => items.includes(Number(value)) ? items.filter((day) => day !== Number(value)) : [...items, Number(value)])}>{label}</button>)}</fieldset>}
            {scheduleMode === "interval" && <div className="schedule-fields"><label>Cada<input type="number" min="2" max="365" value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} /><small>días</small></label><label>Desde<input type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} /></label></div>}
            <><div className="schedule-fields"><label>Activo desde (opcional)<input type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} /></label><label>Hasta<input type="date" value={activeUntil} min={activeFrom || undefined} onChange={(e) => setActiveUntil(e.target.value)} /></label></div><div className="schedule-fields"><label>Pausar desde (opcional)<input type="date" value={pausedFrom} onChange={(e) => setPausedFrom(e.target.value)} /></label><label>Hasta<input type="date" value={pausedUntil} min={pausedFrom || undefined} onChange={(e) => setPausedUntil(e.target.value)} /></label></div></>
          </div>}
          {(modal === "weekly" || scheduleMode === "monthly") && <label>{modal === "weekly" ? "Veces por semana" : "Objetivo del mes"}<input type="number" min="1" max={modal === "daily" ? days : 7} value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} />{modal === "weekly" && <small className="field-help">Podrás registrar cada realización hasta alcanzar esta meta semanal.</small>}</label>}
          <button className="add-button full" disabled={scheduleMode === "selectedWeekdays" && !selectedWeekdays.length} onClick={addHabit}>Crear hábito</button>
        </div>
      </div>}
      {canManagePhrases && motivationManagerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setMotivationManagerOpen(false)}>
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
      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setEditing(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">EDITAR REGISTRO</p>
          <h2 id="edit-title">Editar hábito</h2>
          <label>Nombre<input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
          <label>Bloque<select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>{habitCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
          {editing.type === "daily" && <div className="frequency-options">
            {([['monthly', 'Días al mes'], ['daily', 'Todos los días'], ['weekdays', 'Días laborables'], ['selectedWeekdays', 'Días concretos'], ['interval', 'Cada X días']] as const).map(([value, label]) => <label className="frequency-toggle" key={value}><input type="radio" name="edit-frequency" checked={scheduleMode === value} onChange={() => { setScheduleMode(value); setEveryDay(value === 'daily'); setWeekdaysOnly(value === 'weekdays'); }} /><span><strong>{label}</strong></span></label>)}
            {scheduleMode === "selectedWeekdays" && <fieldset className="weekday-picker"><legend>Días programados</legend>{[[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]].map(([value, label]) => <button type="button" key={value} className={selectedWeekdays.includes(Number(value)) ? "selected" : ""} onClick={() => setSelectedWeekdays((items) => items.includes(Number(value)) ? items.filter((day) => day !== Number(value)) : [...items, Number(value)])}>{label}</button>)}</fieldset>}
            {scheduleMode === "interval" && <div className="schedule-fields"><label>Cada<input type="number" min="2" max="365" value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} /><small>días</small></label><label>Desde<input type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} /></label></div>}
            <><div className="schedule-fields"><label>Activo desde (opcional)<input type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} /></label><label>Hasta<input type="date" value={activeUntil} min={activeFrom || undefined} onChange={(e) => setActiveUntil(e.target.value)} /></label></div><div className="schedule-fields"><label>Pausar desde (opcional)<input type="date" value={pausedFrom} onChange={(e) => setPausedFrom(e.target.value)} /></label><label>Hasta<input type="date" value={pausedUntil} min={pausedFrom || undefined} onChange={(e) => setPausedUntil(e.target.value)} /></label></div></>
          </div>}
          {(editing.type === "weekly" || scheduleMode === "monthly") && <label>{editing.type === "weekly" ? "Veces por semana" : "Objetivo del mes"}<input type="number" min="1" max={editing.type === "daily" ? days : 7} value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} />{editing.type === "weekly" && <small className="field-help">La meta se aplica de nuevo cada semana.</small>}</label>}
          <fieldset className="color-picker">
            <legend>Color del hábito</legend>
            <div className="color-palette">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={selectedColor === color ? "selected" : ""}
                  style={{ background: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Elegir color ${color}`}
                  aria-pressed={selectedColor === color}
                >
                  {selectedColor === color && <span>✓</span>}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="add-button full habit-editor-submit" disabled={scheduleMode === "selectedWeekdays" && !selectedWeekdays.length} onClick={saveEdit}>Guardar cambios</button>
        </div>
      </div>}
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
