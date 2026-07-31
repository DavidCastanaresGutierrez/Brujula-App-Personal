"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type Habit = {
  id: number;
  name: string;
  goal: number;
  color: string;
  checks: number[];
  archived?: boolean;
  everyDay?: boolean;
  weekdaysOnly?: boolean;
  history?: Record<string, number[]>;
  category?: HabitCategory;
  celebratedStreak30?: string;
};

type WeeklyHabit = {
  id: number;
  name: string;
  goal: number;
  color: string;
  checks: number[];
  archived?: boolean;
  history?: Record<string, number[]>;
  category?: HabitCategory;
};

type HabitCategory = string;
type Category = { id: HabitCategory; label: string; icon: string; color: string };

type TrackerState = {
  daily: Habit[];
  weekly: WeeklyHabit[];
  categories?: Category[];
  motivations?: string[];
};

const palette = [
  "#ff3b88", "#ef476f", "#fb7185", "#f97316", "#f59e0b", "#fbbf24",
  "#84cc16", "#39c6a4", "#14b8a6", "#22d3ee", "#50b8e7", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a78bfa", "#d946ef", "#f472b6", "#94a3b8",
];
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
  { id: 101, name: "Colada", goal: 5, color: palette[0], checks: [], category: "family" },
  { id: 102, name: "Preparar comidas", goal: 5, color: palette[1], checks: [], category: "health" },
  { id: 103, name: "Limpieza", goal: 3, color: palette[2], checks: [], category: "family" },
  { id: 104, name: "Compra", goal: 5, color: palette[3], checks: [], category: "family" },
  { id: 105, name: "Tiempo en familia", goal: 5, color: palette[4], checks: [], category: "family" },
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
        };
      })
    : defaultCategories;

  return {
    daily: (state.daily ?? []).map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) })),
    weekly: (state.weekly ?? []).map((habit) => ({ ...habit, category: habit.category ?? inferCategory(habit.name) })),
    categories,
    motivations: state.motivations?.filter((item) => item.trim()) ?? [],
  };
}

function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function isWeekday(year: number, monthIndex: number, day: number) {
  const weekday = new Date(year, monthIndex, day).getDay();
  return weekday >= 1 && weekday <= 5;
}

function weekdaysInMonth(year: number, monthIndex: number, throughDay?: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const limit = Math.min(throughDay ?? monthDays, monthDays);
  let count = 0;
  for (let day = 1; day <= limit; day += 1) {
    if (isWeekday(year, monthIndex, day)) count += 1;
  }
  return count;
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

function Ring({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div className="ring" style={{ "--progress": `${safe * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{Math.round(safe)}%</strong><span>completado</span></div>
    </div>
  );
}

type ChartSeries = { name: string; color: string; data: { label: string; value: number }[] };

function TrendChart({ series }: { series: ChartSeries[] }) {
  const plotted = series.map((item) => ({
    ...item,
    points: item.data.map((point, index) => ({
      ...point,
      x: item.data.length <= 1 ? 60 : 60 + index * (900 / (item.data.length - 1)),
      y: 220 - Math.min(100, Math.max(0, point.value)) * 1.8,
    })),
  }));
  const labels = series[0]?.data ?? [];
  const labelStep = labels.length > 16 ? 3 : 1;
  return (
    <div className="trend-chart">
      {series.length > 1 && <div className="chart-legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>}
      <svg viewBox="0 0 1000 260" role="img" aria-label="Evolución del porcentaje de cumplimiento">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = 220 - tick * 1.8;
          return <g key={tick}><line x1="60" y1={y} x2="960" y2={y} className="chart-grid" /><text x="49" y={y + 4} textAnchor="end" className="chart-y-label">{tick}%</text></g>;
        })}
        {plotted.map((item) => <g key={item.name}>
          <polyline points={item.points.map((point) => `${point.x},${point.y}`).join(" ")} className="trend-line" style={{ stroke: item.color }} />
          {item.points.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r={series.length > 1 ? 3 : 4} className="trend-point" style={{ stroke: item.color }}><title>{`${item.name} · ${point.label}: ${Math.round(point.value)}%`}</title></circle>)}
        </g>)}
        {labels.map((point, index) => index % labelStep === 0 && <text key={`${point.label}-${index}`} x={labels.length <= 1 ? 60 : 60 + index * (900 / (labels.length - 1))} y="245" textAnchor="middle" className="chart-x-label">{point.label}</text>)}
      </svg>
    </div>
  );
}

function Brand({ lightBackground = false }: { lightBackground?: boolean }) {
  return <div className="brand"><Image className="brand-logo" src={lightBackground ? "/brujula-logo-light.svg" : "/brujula-logo-simple.svg"} width={68} height={68} alt="" priority /><span>Brújula</span></div>;
}

function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage("Te hemos enviado un enlace para restablecer la contraseña. Revisa también la carpeta de spam.");
        return;
      }
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "register" && !result.data.session) {
        setMessage("Revisa tu correo para confirmar la cuenta y después inicia sesión.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar el acceso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><Brand lightBackground /></div>
        <p className="eyebrow">TU RUMBO PERSONAL</p>
        <h1>{mode === "login" ? "Continúa avanzando." : mode === "register" ? "Empieza tu recorrido." : "Recupera el acceso."}</h1>
        <p>{mode === "forgot" ? "Escribe tu correo y recibirás un enlace seguro para crear una contraseña nueva." : "Tus hábitos se guardarán de forma privada y estarán disponibles en todos tus dispositivos."}</p>
        <form onSubmit={submit}>
          <label>Correo<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {mode !== "forgot" && <label>Contraseña<span className="password-field"><input type={showPassword ? "text" : "password"} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>}
          {message && <p className="auth-message">{message}</p>}
          <button className="add-button full" disabled={busy}>{busy ? "Procesando…" : mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}</button>
        </form>
        {mode === "login" && <button className="auth-switch" onClick={() => { setMode("forgot"); setMessage(""); }}>¿Has olvidado tu contraseña?</button>}
        <button className="auth-switch secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); setShowPassword(false); }}>
          {mode === "login" ? "¿Primera vez? Crear una cuenta" : "Volver al inicio de sesión"}
        </button>
      </section>
    </main>
  );
}

function ResetPassword({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      onComplete();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><Brand lightBackground /></div>
        <p className="eyebrow">NUEVA CONTRASEÑA</p>
        <h1>Recupera tu rumbo.</h1>
        <p>Elige una contraseña nueva de al menos 8 caracteres.</p>
        <form onSubmit={submit}>
          <label>Nueva contraseña<span className="password-field"><input type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>
          <label>Repite la contraseña<input type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {message && <p className="auth-message">{message}</p>}
          <button className="add-button full" disabled={busy}>{busy ? "Guardando…" : "Guardar nueva contraseña"}</button>
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const [daily, setDaily] = useState(initialDaily);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [habitCategories, setHabitCategories] = useState<Category[]>(defaultCategories);
  const [motivations, setMotivations] = useState<string[]>(dailyMotivations);
  const [motivationManagerOpen, setMotivationManagerOpen] = useState(false);
  const [motivationDraft, setMotivationDraft] = useState("");
  const [editingMotivationIndex, setEditingMotivationIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const [date, setDate] = useState(() => new Date());
  const [modal, setModal] = useState<null | "daily" | "weekly">(null);
  const [editing, setEditing] = useState<{ type: "daily" | "weekly"; id: number } | null>(null);
  const [deleting, setDeleting] = useState<{ type: "daily" | "weekly"; id: number; name: string } | null>(null);
  const [actionHabit, setActionHabit] = useState<{ type: "daily" | "weekly"; habit: Habit } | null>(null);
  const [dragging, setDragging] = useState<{ type: "daily" | "weekly"; id: number } | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"monthly" | "yearly">("monthly");
  const [chartScope, setChartScope] = useState<"general" | "category" | "habit">("general");
  const [rankingView, setRankingView] = useState<"best" | "watch">("best");
  const [selectedChartCategory, setSelectedChartCategory] = useState<HabitCategory>("health");
  const [selectedHabitId, setSelectedHabitId] = useState<number>(initialDaily[0].id);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState(12);
  const [everyDay, setEveryDay] = useState(false);
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>("health");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<HabitCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(defaultCategories[0].color);
  const [categoryIcon, setCategoryIcon] = useState("●");
  const [deletingCategoryId, setDeletingCategoryId] = useState<HabitCategory | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState<HabitCategory>("health");
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "offline">("loading");
  const [streakCelebration, setStreakCelebration] = useState<{ name: string; color: string } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setHydrated(false);
      setSyncStatus("loading");
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !session) return;
    const accessToken = session.access_token;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    let cancelled = false;
    const localSaved = localStorage.getItem(storageKey);
    let localState: TrackerState | null = null;
    try {
      if (localSaved) localState = JSON.parse(localSaved);
    } catch {
      localState = null;
    }

    async function loadState() {
      try {
        const response = await fetch("/api/state", {
          cache: "no-store",
          headers: { authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error("No se pudo cargar la base de datos");
        const payload = await response.json() as { state: TrackerState | null };
        const state = payload.state ?? localState;
        if (cancelled) return;
        if (state) {
          const normalized = normalizeState(state);
          setDaily(normalized.daily);
          setWeekly(normalized.weekly);
          setHabitCategories(normalized.categories);
          const savedMotivations = (state.motivations?.length ? state.motivations : localState?.motivations)?.filter((item) => item.trim()) ?? [];
          setMotivations(savedMotivations.length ? savedMotivations : dailyMotivations);
        }
        setSyncStatus("synced");

        if (!payload.state && localState) {
          await fetch("/api/state", {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(localState),
          });
        }
      } catch {
        if (!cancelled && localState) {
          const normalized = normalizeState(localState);
          setDaily(normalized.daily);
          setWeekly(normalized.weekly);
          setHabitCategories(normalized.categories);
          const savedMotivations = localState.motivations?.filter((item) => item.trim()) ?? [];
          setMotivations(savedMotivations.length ? savedMotivations : dailyMotivations);
        }
        if (!cancelled) setSyncStatus("offline");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    loadState();
    return () => { cancelled = true; };
  }, [authReady, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const accessToken = session.access_token;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const state = { daily, weekly, categories: habitCategories, motivations };
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(state),
        });
        if (!response.ok) throw new Error("No se pudo guardar");
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [daily, weekly, habitCategories, motivations, hydrated, session]);

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayNumber = isCurrentMonth ? today.getDate() : null;
  const calendar = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    week: Math.floor(i / 7) + 1,
    label: dayNames[new Date(year, month, i + 1).getDay()],
  }));

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
  const checksFor = (habit: Habit, key = monthKey) => habit.history?.[key] ?? [];
  const weeklyChecksFor = (habit: WeeklyHabit, key = monthKey) => habit.history?.[key] ?? [];
  const goalFor = (habit: Habit) => habit.everyDay ? days : habit.weekdaysOnly ? weekdaysInMonth(year, month) : habit.goal;
  const totalChecks = activeDaily.reduce((sum, habit) => sum + checksFor(habit).filter((d) => d <= days).length, 0);
  const totalGoal = activeDaily.reduce((sum, habit) => sum + goalFor(habit), 0);
  const globalProgress = totalGoal ? (totalChecks / totalGoal) * 100 : 0;
  const scoreFromPercent = (percent: number) => Math.min(10, Math.max(0, percent / 10));
  const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const referenceDay = isCurrentMonth ? today.getDate() : days;
  const referenceDate = new Date(year, month, referenceDay);
  const mondayOffset = (referenceDate.getDay() + 6) % 7;
  const weekStart = Math.max(1, referenceDay - mondayOffset);
  const weekEnd = Math.min(days, weekStart + 6);
  const dayChecks = activeDaily.filter((habit) => checksFor(habit).includes(referenceDay)).length;
  const dayProgress = activeDaily.length ? dayChecks / activeDaily.length * 100 : 0;
  const weekChecks = activeDaily.reduce((sum, habit) => sum + checksFor(habit).filter((day) => day >= weekStart && day <= weekEnd).length, 0);
  const weekGoal = activeDaily.length * (weekEnd - weekStart + 1);
  const weekScore = scoreFromPercent(weekGoal ? weekChecks / weekGoal * 100 : 0);
  const dayScore = scoreFromPercent(dayProgress);
  const monthScore = scoreFromPercent(globalProgress);
  const habitCompletion = (habit: Habit) => checksFor(habit).length / Math.max(1, goalFor(habit));
  const ranked = [...daily].filter((habit) => !habit.archived).sort((a, b) => habitCompletion(b) - habitCompletion(a));
  const rankingItems = rankingView === "best" ? ranked : [...ranked].reverse();
  const weeklyProgress = Array.from({ length: 5 }, (_, week) => {
    const start = week * 7 + 1;
    const end = Math.min(days, start + 6);
    const count = activeDaily.reduce((sum, habit) => sum + checksFor(habit).filter((d) => d >= start && d <= end).length, 0);
    const possible = activeDaily.length * (end - start + 1);
    return possible ? Math.round((count / possible) * 100) : 0;
  });
  const selectedHabit = activeDaily.find((habit) => habit.id === selectedHabitId) ?? activeDaily[0];
  const allCategoriesSelected = selectedChartCategory === "__all__";
  const allHabitsSelected = selectedHabitId === 0;
  const selectedCategoryMeta = habitCategories.find((category) => category.id === selectedChartCategory) ?? habitCategories[0] ?? defaultCategories[0];
  const dataForHabits = (habits: Habit[]) => {
    if (chartPeriod === "monthly") {
      return Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const completed = habits.reduce((sum, habit) => sum + checksFor(habit).filter((value) => value <= day).length, 0);
        const target = habits.reduce((sum, habit) => sum + (habit.everyDay ? day : habit.weekdaysOnly ? weekdaysInMonth(year, month, day) : Math.min(habit.goal, day)), 0);
        return { label: String(day), value: target ? Math.min(100, completed / target * 100) : 0 };
      });
    }
    return monthNames.map((label, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      const monthDays = new Date(year, index + 1, 0).getDate();
      const completed = habits.reduce((sum, habit) => sum + checksFor(habit, key).length, 0);
      const target = habits.reduce((sum, habit) => sum + (habit.everyDay ? monthDays : habit.weekdaysOnly ? weekdaysInMonth(year, index) : habit.goal), 0);
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

  function shiftMonth(direction: number) {
    setDate(new Date(year, month + direction, 1));
  }

  function toggleDaily(id: number, day: number) {
    const habit = daily.find((item) => item.id === id);
    if (habit?.weekdaysOnly && !isWeekday(year, month, day)) return;
    setDaily((items) => items.map((habit) => {
      if (habit.id !== id) return habit;
      const current = checksFor(habit);
      const isRemoving = current.includes(day);
      const next = isRemoving ? current.filter((d) => d !== day) : [...current, day];
      const history = { ...(habit.history ?? {}), [monthKey]: next };
      if (!isRemoving) {
        const streak = streakContaining(history, isoDate(year, month, day));
        if (streak.length >= 30 && habit.celebratedStreak30 !== streak.start) {
          setStreakCelebration({ name: habit.name, color: habit.color });
          return { ...habit, history, celebratedStreak30: streak.start };
        }
      }
      return { ...habit, history };
    }));
  }

  function toggleWeekly(id: number, week: number) {
    setWeekly((items) => items.map((habit) => {
      if (habit.id !== id) return habit;
      const current = weeklyChecksFor(habit);
      const next = current.includes(week) ? current.filter((d) => d !== week) : [...current, week];
      return { ...habit, history: { ...(habit.history ?? {}), [monthKey]: next } };
    }));
  }

  function addHabit() {
    if (!newName.trim() || !modal) return;
    const color = palette[(daily.length + weekly.length) % palette.length];
    if (modal === "daily") {
      setDaily((items) => [...items, { id: Date.now(), name: newName.trim(), goal: everyDay ? days : weekdaysOnly ? weekdaysInMonth(year, month) : newGoal, everyDay, weekdaysOnly, color, checks: [], category: selectedCategory }]);
    } else {
      setWeekly((items) => [...items, { id: Date.now(), name: newName.trim(), goal: Math.min(5, newGoal), color, checks: [], category: selectedCategory }]);
    }
    setNewName("");
    setNewGoal(12);
    setEveryDay(false);
    setWeekdaysOnly(false);
    setSelectedCategory("health");
    setModal(null);
  }

  function startEdit(type: "daily" | "weekly", habit: Habit) {
    setEditing({ type, id: habit.id });
    setNewName(habit.name);
    setNewGoal(habit.goal);
    setEveryDay(Boolean(habit.everyDay));
    setWeekdaysOnly(Boolean(habit.weekdaysOnly));
    setSelectedColor(habit.color);
    setSelectedCategory(habit.category ?? inferCategory(habit.name));
    setActionHabit(null);
  }

  function saveEdit() {
    if (!editing || !newName.trim()) return;
    const update = (habit: Habit) => habit.id === editing.id ? { ...habit, name: newName.trim(), goal: editing.type === "daily" && everyDay ? days : editing.type === "daily" && weekdaysOnly ? weekdaysInMonth(year, month) : newGoal, everyDay: editing.type === "daily" ? everyDay : false, weekdaysOnly: editing.type === "daily" ? weekdaysOnly : false, color: selectedColor, category: selectedCategory } : habit;
    if (editing.type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
    setEditing(null);
    setNewName("");
    setEveryDay(false);
    setWeekdaysOnly(false);
    setSelectedColor(palette[0]);
    setSelectedCategory("health");
  }

  function archiveHabit(type: "daily" | "weekly", id: number) {
    const update = (habit: Habit) => habit.id === id ? { ...habit, archived: true } : habit;
    if (type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
    setActionHabit(null);
  }

  function deleteHabit() {
    if (!deleting) return;
    if (deleting.type === "daily") setDaily((items) => items.filter((habit) => habit.id !== deleting.id));
    else setWeekly((items) => items.filter((habit) => habit.id !== deleting.id));
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

  function requestCategoryDelete(categoryId: HabitCategory) {
    const replacement = habitCategories.find((category) => category.id !== categoryId);
    if (!replacement) return;
    setDeletingCategoryId(categoryId);
    setReplacementCategoryId(replacement.id);
  }

  function deleteCategory() {
    if (!deletingCategoryId || deletingCategoryId === replacementCategoryId) return;
    const move = (habit: Habit) => habit.category === deletingCategoryId ? { ...habit, category: replacementCategoryId } : habit;
    setDaily((items) => items.map(move));
    setWeekly((items) => items.map(move));
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

  if (!authReady) {
    return <main className="auth-page"><p className="eyebrow">CARGANDO BRÚJULA…</p></main>;
  }
  if (passwordRecovery) return <ResetPassword onComplete={() => setPasswordRecovery(false)} />;
  if (!session) return <AuthGate />;

  return (
    <main>
      <header className="topbar">
        <Brand />
        <nav aria-label="Navegación principal">
          <button className="nav-active">Panel</button>
          <button onClick={() => document.getElementById("tracker")?.scrollIntoView({ behavior: "smooth" })}>Hábitos</button>
          <button onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })}>Análisis</button>
          <button onClick={() => setMotivationManagerOpen(true)}>Frases</button>
        </nav>
        <div className="session-actions">
          <span className="avatar" aria-hidden="true">{(session.user.email?.slice(0, 2) ?? "BR").toUpperCase()}</span>
          <button className="logout-button" onClick={() => getSupabaseBrowserClient().auth.signOut()}>Cerrar sesión</button>
        </div>
      </header>

      <div className="page-shell">
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

        <section className="metrics">
          <article className="metric primary">
            <div><span>Nota del día</span><strong>{scoreLabel(dayScore)}<small> / 10</small></strong><p>{dayChecks} de {activeDaily.length} hábitos completados</p></div>
            <Ring value={dayProgress} />
          </article>
          <article className="metric">
            <span>Nota semanal</span>
            <strong>{scoreLabel(weekScore)} <small>/ 10</small></strong>
            <p>Del día {weekStart} al {weekEnd}</p>
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
            <div className="panel-head"><div><p className="eyebrow">RITMO DEL MES</p><h2>Progreso semanal</h2></div><span className="legend"><i /> Completado</span></div>
            <div className="bars">
              {weeklyProgress.map((value, index) => (
                <div className="bar-column" key={index}>
                  <span>{value}%</span>
                  <div className="bar-track"><div style={{ height: `${Math.max(value, 4)}%`, background: palette[index] }} /></div>
                  <strong>S{index + 1}</strong>
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
              <div className="tabs"><button className={chartPeriod === "monthly" ? "active" : ""} onClick={() => setChartPeriod("monthly")}>Mensual</button><button className={chartPeriod === "yearly" ? "active" : ""} onClick={() => setChartPeriod("yearly")}>Anual</button></div>
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
            <span>Periodo: <strong>{chartPeriod === "monthly" ? `${monthNames[month]} ${year}` : year}</strong></span>
            <span>{chartSeries.length > 1 ? <><strong>{chartSeries.length}</strong> series comparadas</> : <>Último valor: <strong>{Math.round(chartSeries[0]?.data.at(-1)?.value ?? 0)}%</strong></>}</span>
          </div>
        </section>

        <section className="tracker panel" id="tracker">
          <div className="tracker-head">
            <div>
              <p className="eyebrow">REGISTRO INTERACTIVO</p>
              <h2>Tu constancia, día a día</h2>
            </div>
            <div className="tracker-actions">
              <button className="reset-button blocks-button" onClick={() => { setCategoryManagerOpen(true); startCategoryEdit(); }}>Gestionar bloques</button>
              <div className="tabs">
                <button className={activeTab === "daily" ? "active" : ""} onClick={() => setActiveTab("daily")}>Diarios</button>
                <button className={activeTab === "weekly" ? "active" : ""} onClick={() => setActiveTab("weekly")}>Semanales</button>
              </div>
              <button className="add-button" onClick={() => { setModal(activeTab); setNewGoal(activeTab === "daily" ? 12 : 5); setEveryDay(false); setWeekdaysOnly(false); setSelectedCategory("health"); }}>+ Añadir hábito</button>
            </div>
          </div>

          {activeTab === "daily" ? (
            <div className="table-scroll" ref={tableScrollRef}>
              <div className="habit-table" style={{ minWidth: `${410 + days * 38}px` }}>
                <div className="habit-row header-row">
                  <div className="habit-name">HÁBITO</div>
                  <div className="goal-cell">META</div>
                  <div className="day-grid" style={{ gridTemplateColumns: `repeat(${days}, 34px)` }}>
                    {calendar.map((d) => <div className={d.day === todayNumber ? "today-column today-header" : ""} key={d.day}><span>{d.day === todayNumber ? "HOY" : d.label}</span><b>{d.day}</b></div>)}
                  </div>
                  <div className="result-cell">PROGRESO</div>
                </div>
                {habitCategories.map((category) => {
                  const categoryHabits = activeDaily.filter((habit) => (habit.category ?? inferCategory(habit.name)) === category.id);
                  if (!categoryHabits.length) return null;
                  return <div className="category-group" key={category.id}>
                    <div className="category-band" style={{ "--category-color": category.color } as React.CSSProperties}>
                      <span className="category-band-label"><span>{category.icon}</span><strong>{category.label}</strong></span>
                      <small>{categoryHabits.length}</small>
                    </div>
                    {categoryHabits.map((habit) => {
                  const effectiveGoal = goalFor(habit);
                  const currentChecks = checksFor(habit);
                  const progress = Math.min(100, Math.round(currentChecks.filter((d) => d <= days).length / effectiveGoal * 100));
                  return <div className={`habit-row ${dragging?.id === habit.id ? "is-dragging" : ""}`} key={habit.id} onDragOver={(e) => e.preventDefault()} onDrop={() => dragging?.type === "daily" && reorderHabit("daily", dragging.id, habit.id)}>
                    <div className="habit-name"><span className="drag-handle" draggable onDragStart={() => setDragging({ type: "daily", id: habit.id })} onDragEnd={() => setDragging(null)} title="Arrastrar para reordenar" aria-label={`Arrastrar ${habit.name}`}>⠿</span><i style={{ background: habit.color }} /><span>{habit.name}</span><div className="habit-menu"><button className="menu-trigger" aria-label={`Gestionar ${habit.name}`} onClick={() => setActionHabit({ type: "daily", habit })}>⋯</button></div></div>
                    <div className="goal-cell">{habit.everyDay ? <span className="daily-goal">Diario · {days}</span> : habit.weekdaysOnly ? <span className="daily-goal">Laborables · {effectiveGoal}</span> : habit.goal}</div>
                    <div className="day-grid" style={{ gridTemplateColumns: `repeat(${days}, 34px)` }}>
                      {calendar.map((d) => { const disabled = Boolean(habit.weekdaysOnly && !isWeekday(year, month, d.day)); return <button key={d.day} disabled={disabled} className={`${currentChecks.includes(d.day) ? "checked" : ""} ${d.day === todayNumber ? "today-column" : ""} ${disabled ? "non-working-day" : ""}`.trim()} onClick={() => toggleDaily(habit.id, d.day)} aria-label={`${habit.name}, día ${d.day}${d.day === todayNumber ? ", hoy" : ""}${disabled ? ", fin de semana" : ""}`}>{currentChecks.includes(d.day) ? "✓" : ""}</button>; })}
                    </div>
                    <div className="result-cell"><strong>{progress}%</strong><span>{currentChecks.filter((d) => d <= days).length}/{effectiveGoal}</span></div>
                  </div>;
                    })}
                  </div>;
                })}
              </div>
            </div>
          ) : (
            <div className="weekly-list">
              {habitCategories.map((category) => {
                const categoryHabits = activeWeekly.filter((habit) => (habit.category ?? inferCategory(habit.name)) === category.id);
                if (!categoryHabits.length) return null;
                return <div className="weekly-category" key={category.id}>
                  <div className="category-band" style={{ "--category-color": category.color } as React.CSSProperties}>
                    <span className="category-band-label"><span>{category.icon}</span><strong>{category.label}</strong></span>
                    <small>{categoryHabits.length}</small>
                  </div>
                  {categoryHabits.map((habit) => {
                const currentChecks = weeklyChecksFor(habit);
                const progress = Math.round(currentChecks.length / habit.goal * 100);
                return <div className={`weekly-row ${dragging?.id === habit.id ? "is-dragging" : ""}`} key={habit.id} onDragOver={(e) => e.preventDefault()} onDrop={() => dragging?.type === "weekly" && reorderHabit("weekly", dragging.id, habit.id)}>
                  <div className="habit-name"><span className="drag-handle" draggable onDragStart={() => setDragging({ type: "weekly", id: habit.id })} onDragEnd={() => setDragging(null)} title="Arrastrar para reordenar" aria-label={`Arrastrar ${habit.name}`}>⠿</span><i style={{ background: habit.color }} /><span>{habit.name}</span><div className="habit-menu"><button className="menu-trigger" aria-label={`Gestionar ${habit.name}`} onClick={() => setActionHabit({ type: "weekly", habit })}>⋯</button></div></div>
                  <div className="week-checks">{[1, 2, 3, 4, 5].map((week) => <button key={week} className={currentChecks.includes(week) ? "checked" : ""} onClick={() => toggleWeekly(habit.id, week)}><span>S{week}</span>{currentChecks.includes(week) ? "✓" : ""}</button>)}</div>
                  <div className="weekly-result"><strong>{progress}%</strong><span>{currentChecks.length}/{habit.goal}</span></div>
                </div>;
                  })}
                </div>;
              })}
            </div>
          )}
          <p className={`save-note ${syncStatus}`}>
            <span>●</span>
            {syncStatus === "loading" && " Cargando tus datos…"}
            {syncStatus === "saving" && " Guardando cambios…"}
            {syncStatus === "synced" && " Sincronizado en todos tus dispositivos."}
            {syncStatus === "offline" && " Sin conexión: los cambios quedan guardados temporalmente en este dispositivo."}
          </p>
        </section>
      </div>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setModal(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">NUEVO REGISTRO</p>
          <h2 id="modal-title">Añadir hábito {modal === "daily" ? "diario" : "semanal"}</h2>
          <label>Nombre<input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Caminar 30 minutos" /></label>
          <label>Bloque<select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>{habitCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
          {modal === "daily" && <div className="frequency-options">
            <label className="frequency-toggle"><input type="checkbox" checked={everyDay} onChange={(e) => { setEveryDay(e.target.checked); if (e.target.checked) setWeekdaysOnly(false); }} /><span><strong>Todos los días</strong><small>Objetivo automático de {days} días en {monthNames[month]}.</small></span></label>
            <label className="frequency-toggle"><input type="checkbox" checked={weekdaysOnly} onChange={(e) => { setWeekdaysOnly(e.target.checked); if (e.target.checked) setEveryDay(false); }} /><span><strong>Todos los días laborables</strong><small>De lunes a viernes; excluye sábados y domingos ({weekdaysInMonth(year, month)} días).</small></span></label>
          </div>}
          {!everyDay && !weekdaysOnly && <label>Objetivo del mes<input type="number" min="1" max={modal === "daily" ? days : 5} value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} /></label>}
          <button className="add-button full" onClick={addHabit}>Crear hábito</button>
        </div>
      </div>}
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
              const count = [...daily, ...weekly].filter((habit) => !habit.archived && habit.category === category.id).length;
              return <div className="block-manager-row" key={category.id}>
                <span className="block-manager-icon" style={{ background: `${category.color}26`, color: category.color }}>{category.icon}</span>
                <div><strong>{category.label}</strong><small>{count} {count === 1 ? "hábito" : "hábitos"}</small></div>
                <button className="menu-trigger" onClick={() => startCategoryEdit(category)} aria-label={`Editar bloque ${category.label}`}>✎</button>
                <button className="menu-trigger danger-text" disabled={habitCategories.length === 1} onClick={() => requestCategoryDelete(category.id)} aria-label={`Eliminar bloque ${category.label}`}>×</button>
              </div>;
            })}
          </div>
          <div className="block-editor">
            <p className="eyebrow">{editingCategoryId ? "EDITAR BLOQUE" : "NUEVO BLOQUE"}</p>
            <div className="block-fields">
              <label>Nombre<input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ej. Ocio" /></label>
              <label className="icon-field">Icono<input value={categoryIcon} maxLength={2} onChange={(e) => setCategoryIcon(e.target.value)} aria-label="Icono del bloque" /></label>
            </div>
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
      {deletingCategoryId && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeletingCategoryId(null)}>
        <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-block-title" onMouseDown={(e) => e.stopPropagation()}>
          <p className="eyebrow danger-text">ELIMINAR BLOQUE</p>
          <h2 id="delete-block-title">¿Dónde movemos sus hábitos?</h2>
          <p>El bloque desaparecerá, pero sus hábitos y todo su historial se conservarán.</p>
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
            <label className="frequency-toggle"><input type="checkbox" checked={everyDay} onChange={(e) => { setEveryDay(e.target.checked); if (e.target.checked) setWeekdaysOnly(false); }} /><span><strong>Todos los días</strong><small>El objetivo se ajustará al número real de días del mes.</small></span></label>
            <label className="frequency-toggle"><input type="checkbox" checked={weekdaysOnly} onChange={(e) => { setWeekdaysOnly(e.target.checked); if (e.target.checked) setEveryDay(false); }} /><span><strong>Todos los días laborables</strong><small>De lunes a viernes; excluye sábados y domingos ({weekdaysInMonth(year, month)} días).</small></span></label>
          </div>}
          {!everyDay && !weekdaysOnly && <label>Objetivo del mes<input type="number" min="1" max={editing.type === "daily" ? days : 5} value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} /></label>}
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
          <button className="add-button full" onClick={saveEdit}>Guardar cambios</button>
        </div>
      </div>}
      {deleting && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleting(null)}>
        <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(e) => e.stopPropagation()}>
          <p className="eyebrow danger-text">ACCIÓN IRREVERSIBLE</p>
          <h2 id="delete-title">¿Eliminar “{deleting.name}”?</h2>
          <p>Se borrarán también todos sus registros. Si quieres conservar el historial, utiliza “Archivar”.</p>
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
