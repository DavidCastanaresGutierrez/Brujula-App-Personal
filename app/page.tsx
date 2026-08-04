"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
type GoalPeriod = "daily" | "weekly" | "monthly" | "yearly";
type MainView = "summary" | "today" | "habits" | "goals";
type BookFormat = "audio" | "digital" | "paper";
type BookEntry = { id: number; title: string; format: BookFormat; completedAt: string };
type FitnessMetric = "weight" | "muscle" | "fatMass" | "bodyWater" | "bodyFat" | "bmi" | "basalMetabolicRate";
type FitnessEntry = { id: number; recordedAt: string; weight: number; muscle: number; fatMass: number; bodyWater: number; bodyFat: number; bmi: number; basalMetabolicRate: number };
type Goal = {
  id: number; title: string; category: HabitCategory; period: GoalPeriod; periodKey: string;
  measurement: "complete" | "quantity"; targetValue: number; currentValue: number;
  unit?: string; status: "active" | "completed" | "discarded"; dueDate: string;
  linkedHabitId?: number;
  linkedHabitIds?: number[];
  trackingStart?: string;
  template?: "fitness" | "reading";
  books?: BookEntry[];
  fitnessEntries?: FitnessEntry[];
  parentAnnualGoalId?: number;
  archived?: boolean;
};

type TrackerState = {
  daily: Habit[];
  weekly: WeeklyHabit[];
  categories?: Category[];
  motivations?: string[];
  goals?: Goal[];
};

const palette = [
  "#ff0000", "#f97316", "#f59e0b", "#fbbf24",
  "#84cc16", "#39c6a4", "#14b8a6", "#22d3ee", "#50b8e7", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a78bfa", "#d946ef", "#ff3b88", "#f472b6", "#fb7185",
  "#ef476f", "#94a3b8",
];
const weeklyBarPalette = ["#3cc9ab", "#ffb51b", "#ff3b6b", "#50b8e7", "#a78bfa"];
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
const fitnessMetricMeta: Record<FitnessMetric, { label: string; unit: string }> = {
  weight: { label: "Peso", unit: "kg" }, muscle: { label: "Masa muscular", unit: "kg" },
  fatMass: { label: "Masa grasa", unit: "kg" }, bodyWater: { label: "Agua corporal", unit: "kg" },
  bodyFat: { label: "Grasa corporal", unit: "%" }, bmi: { label: "IMC", unit: "" },
  basalMetabolicRate: { label: "Tasa metabólica basal", unit: "kcal/día" },
};

function motivationForToday(motivations = dailyMotivations) {
  const available = motivations.length ? motivations : dailyMotivations;
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return available[dayNumber % available.length];
}

function FitnessChart({ entries, metric, period }: { entries: FitnessEntry[]; metric: FitnessMetric; period: number }) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
  const points = entries.filter((entry) => new Date(`${entry.recordedAt}T12:00:00`) >= cutoff && Number.isFinite(entry[metric])).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (!points.length) return <p className="fitness-chart-empty">Añade mediciones para ver tu evolución.</p>;
  const values = points.map((entry) => entry[metric]); const min = Math.min(...values); const max = Math.max(...values); const span = Math.max(1, max - min);
  const coords = points.map((entry, index) => ({ x: points.length === 1 ? 50 : 6 + index * 88 / (points.length - 1), y: 82 - (entry[metric] - min) / span * 64, entry }));
  const meta = fitnessMetricMeta[metric]; const change = values.at(-1)! - values[0];
  return <div className="fitness-chart"><div className="fitness-chart-summary"><span>Última <b>{values.at(-1)} {meta.unit}</b></span><span>Registros <b>{points.length}</b></span><span>Variación <b className={change <= 0 ? "positive" : ""}>{change > 0 ? "+" : ""}{change.toFixed(1)} {meta.unit}</b></span></div><svg viewBox="0 0 100 92" role="img" aria-label={`Evolución de ${meta.label}`} preserveAspectRatio="none"><path className="fitness-area" d={`M ${coords.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${coords.at(-1)!.x} 88 L ${coords[0].x} 88 Z`} /><polyline points={coords.map((p) => `${p.x},${p.y}`).join(" ")} /><g>{coords.map((p) => <circle key={p.entry.id} cx={p.x} cy={p.y} r="1.7"><title>{p.entry.recordedAt}: {p.entry[metric]} {meta.unit}</title></circle>)}</g></svg><div className="fitness-chart-dates"><span>{points[0].recordedAt}</span><span>{points.at(-1)!.recordedAt}</span></div></div>;
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
    goals: state.goals ?? [],
  };
}

function statesEqual(a: TrackerState | null, b: TrackerState | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeStates(serverState: TrackerState, localState: TrackerState): Required<TrackerState> {
  const server = normalizeState(serverState);
  const local = normalizeState(localState);
  const mergeHabits = <T extends Habit | WeeklyHabit>(remote: T[], device: T[]) => {
    const merged = new Map(remote.map((habit) => [habit.id, habit]));
    device.forEach((habit) => {
      const existing = merged.get(habit.id);
      if (!existing) {
        merged.set(habit.id, habit);
        return;
      }
      const history = { ...(habit.history ?? {}), ...(existing.history ?? {}) };
      Object.keys(history).forEach((key) => {
        history[key] = [...new Set([...(habit.history?.[key] ?? []), ...(existing.history?.[key] ?? [])])].sort((a, b) => a - b);
      });
      merged.set(habit.id, { ...habit, ...existing, history });
    });
    return [...merged.values()];
  };
  const categories = new Map(local.categories.map((category) => [category.id, category]));
  server.categories.forEach((category) => categories.set(category.id, category));
  return {
    daily: mergeHabits(server.daily, local.daily),
    weekly: mergeHabits(server.weekly, local.weekly),
    categories: [...categories.values()],
    motivations: server.motivations.length ? server.motivations : local.motivations,
    goals: (() => {
      const merged = new Map(local.goals.map((goal) => [goal.id, goal]));
      server.goals.forEach((goal) => merged.set(goal.id, goal));
      return [...merged.values()];
    })(),
  };
}

function goalPeriodDetails(period: GoalPeriod, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "daily") return { key: now.toISOString().slice(0, 10), due: now.toISOString().slice(0, 10) };
  if (period === "weekly") {
    const day = now.getDay() || 7;
    const monday = new Date(y, m, now.getDate() - day + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { key: monday.toISOString().slice(0, 10), due: sunday.toISOString().slice(0, 10) };
  }
  if (period === "monthly") return { key: `${y}-${String(m + 1).padStart(2, "0")}`, due: isoDate(y, m, new Date(y, m + 1, 0).getDate()) };
  return { key: String(y), due: `${y}-12-31` };
}

function linkedGoalProgress(goal: Goal, habits: Array<Habit | WeeklyHabit>) {
  const linkedIds = [...new Set([...(goal.linkedHabitIds ?? []), ...(goal.linkedHabitId ? [goal.linkedHabitId] : [])])];
  if (!linkedIds.length) return goal.currentValue;
  const linkedHabits = habits.filter((item) => linkedIds.includes(item.id));
  if (!linkedHabits.length) return goal.currentValue;
  let count = 0;
  linkedHabits.forEach((habit) => {
    Object.entries(habit.history ?? {}).forEach(([monthKey, values]) => {
      values.forEach((value) => {
        const date = `${monthKey}-${String(value).padStart(2, "0")}`;
        const inPeriod = goal.period === "daily" ? date === goal.periodKey
          : goal.period === "weekly" ? date >= goal.periodKey && date <= goal.dueDate
          : goal.period === "monthly" ? monthKey === goal.periodKey
          : monthKey.startsWith(`${goal.periodKey}-`);
        if (inPeriod) count += 1;
      });
    });
  });
  return Math.min(count, goal.targetValue);
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

function weekOfMonth(day: number) {
  return Math.floor((day - 1) / 7) + 1;
}

function daysForMonthWeek(year: number, monthIndex: number, week: number) {
  const monthDays = new Date(year, monthIndex + 1, 0).getDate();
  const start = (week - 1) * 7 + 1;
  const end = Math.min(start + 6, monthDays);
  return start > monthDays ? [] : Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
  return <div className="brand"><Image className="brand-logo" src={lightBackground ? "/compass-mark-light.png" : "/compass-mark-dark.png"} width={68} height={68} alt="" priority /><span>Brújula</span></div>;
}

function AuthIcon({ name }: { name: "mail" | "lock" | "eye" | "eyeOff" | "shield" | "compass" }) {
  if (name === "mail") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4 7 8 6 8-6"/></svg>;
  if (name === "lock") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>;
  if (name === "eye") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === "eyeOff") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3.1M6.1 6.2C3.7 8 2.5 12 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>;
  if (name === "shield") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9.5 12 1.7 1.7 3.5-3.7"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3Z"/></svg>;
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
      <div className="auth-shell">
        <section className="auth-card">
          <div className="auth-content">
            <div className="auth-brand" aria-label="Brújula, tu rumbo personal">
              <Image className="auth-logo" src="/compass-mark-light.png" width={92} height={92} alt="" priority />
              <strong>Brújula</strong>
              <span>TU RUMBO PERSONAL</span>
            </div>
            <div className="auth-intro">
              <h1>{mode === "login" ? "Construye la persona que quieres llegar a ser." : mode === "register" ? "Empieza a construir tu mejor versión." : "Recupera el acceso a tu rumbo."}</h1>
              <p>{mode === "forgot" ? "Escribe tu correo y recibirás un enlace seguro para crear una contraseña nueva." : "Cada pequeño hábito cambia tu dirección."}</p>
            </div>
            <form onSubmit={submit}>
              <label htmlFor="auth-email">Correo</label>
              <div className="auth-field">
                <span className="auth-field-icon"><AuthIcon name="mail" /></span>
                <input id="auth-email" type="email" placeholder="tu@email.com" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {mode !== "forgot" && <>
                <label htmlFor="auth-password">Contraseña</label>
                <div className="auth-field password-field">
                  <span className="auth-field-icon"><AuthIcon name="lock" /></span>
                  <input id="auth-password" type={showPassword ? "text" : "password"} placeholder="Mínimo 8 caracteres" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><AuthIcon name={showPassword ? "eyeOff" : "eye"} /></button>
                </div>
              </>}
              {message && <p className="auth-message" role="status">{message}</p>}
              <button className="auth-submit" disabled={busy}>
                {busy ? <><span className="auth-spinner" aria-hidden="true" />Procesando…</> : <>{mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}<span aria-hidden="true">→</span></>}
              </button>
            </form>
            <p className="auth-trust"><AuthIcon name="shield" /> Privado · Seguro · Sincronizado</p>
            <div className="auth-links">
              {mode === "login" && <button className="auth-switch" onClick={() => { setMode("forgot"); setMessage(""); }}>¿Has olvidado tu contraseña?</button>}
              <button className="auth-switch secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); setShowPassword(false); }}>
                {mode === "login" ? <>¿Primera vez? <strong>Crear una cuenta</strong></> : "Volver al inicio de sesión"}
              </button>
            </div>
          </div>
        </section>
        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-visual-message">
            <span className="auth-visual-icon"><AuthIcon name="compass" /></span>
            <blockquote>“No se trata de llegar más rápido, sino de avanzar en la dirección correcta.”</blockquote>
          </div>
        </aside>
      </div>
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
  const [mainView, setMainView] = useState<MainView>("summary");
  const [daily, setDaily] = useState(initialDaily);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [habitCategories, setHabitCategories] = useState<Category[]>(defaultCategories);
  const [motivations, setMotivations] = useState<string[]>(dailyMotivations);
  const [goals, setGoals] = useState<Goal[]>([]);
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
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [templateModal, setTemplateModal] = useState<null | "fitness" | "reading">(null);
  const [templateHabitIds, setTemplateHabitIds] = useState<number[]>([]);
  const [readingTarget, setReadingTarget] = useState(12);
  const [bookGoal, setBookGoal] = useState<Goal | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookFormat, setBookFormat] = useState<BookFormat>("paper");
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
  const [date, setDate] = useState(() => new Date());
  const [modal, setModal] = useState<null | "daily" | "weekly">(null);
  const [editing, setEditing] = useState<{ type: "daily" | "weekly"; id: number } | null>(null);
  const [deleting, setDeleting] = useState<{ type: "daily" | "weekly"; id: number; name: string } | null>(null);
  const [actionHabit, setActionHabit] = useState<{ type: "daily" | "weekly"; habit: Habit } | null>(null);
  const [dragging, setDragging] = useState<{ type: "daily" | "weekly"; id: number } | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
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
  const [archivedManagerOpen, setArchivedManagerOpen] = useState(false);
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
  const baselineRef = useRef<TrackerState | null>(null);
  const stateRef = useRef<TrackerState>({ daily: initialDaily, weekly: initialWeekly, categories: defaultCategories, motivations: dailyMotivations, goals: [] });
  const syncInFlight = useRef(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const canManagePhrases = session?.user.email?.trim().toLocaleLowerCase("es") === PHRASES_OWNER_EMAIL;

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
    stateRef.current = { daily, weekly, categories: habitCategories, motivations, goals };
  }, [daily, weekly, habitCategories, motivations, goals]);

  useEffect(() => {
    if (!authReady || !session) return;
    const accessToken = session.access_token;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    let cancelled = false;
    const localSaved = localStorage.getItem(storageKey);
    let localState: TrackerState | null = null;
    try {
      if (localSaved) localState = JSON.parse(localSaved);
    } catch {
      localState = null;
    }
    let localBaseline: TrackerState | null = null;
    try {
      const savedBaseline = localStorage.getItem(baselineKey);
      if (savedBaseline) localBaseline = JSON.parse(savedBaseline);
    } catch {
      localBaseline = null;
    }

    async function loadState() {
      try {
        const response = await fetch(`/api/state?ts=${Date.now()}`, {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "cache-control": "no-cache",
          },
        });
        if (!response.ok) throw new Error("No se pudo cargar la base de datos");
        const payload = await response.json() as { state: TrackerState | null };
        const hasPendingLocalChanges = Boolean(localState && (!localBaseline || !statesEqual(localState, localBaseline)));
        const state = payload.state
          ? (hasPendingLocalChanges && localState ? mergeStates(payload.state, localState) : payload.state)
          : localState;
        if (cancelled) return;
        if (state) {
          const normalized = normalizeState(state);
          setDaily(normalized.daily);
          setWeekly(normalized.weekly);
          setHabitCategories(normalized.categories);
          setGoals(normalized.goals);
          const savedMotivations = (state.motivations?.length ? state.motivations : localState?.motivations)?.filter((item) => item.trim()) ?? [];
          setMotivations(savedMotivations.length ? savedMotivations : dailyMotivations);
        }
        baselineRef.current = payload.state ? normalizeState(payload.state) : null;
        localStorage.setItem(baselineKey, JSON.stringify(baselineRef.current));
        setSyncStatus("synced");
      } catch {
        if (!cancelled && localState) {
          const normalized = normalizeState(localState);
          setDaily(normalized.daily);
          setWeekly(normalized.weekly);
          setHabitCategories(normalized.categories);
          setGoals(normalized.goals);
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
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const state = { daily, weekly, categories: habitCategories, motivations, goals };
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (statesEqual(state, baselineRef.current)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (syncInFlight.current) return;
      syncInFlight.current = true;
      setSyncStatus("saving");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw sessionError ?? new Error("La sesión ha caducado");
        const snapshot = stateRef.current;
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ base: baselineRef.current, state: snapshot }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(payload?.error ?? "No se pudo guardar");
        }
        baselineRef.current = snapshot;
        localStorage.setItem(baselineKey, JSON.stringify(snapshot));
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      } finally {
        syncInFlight.current = false;
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [daily, weekly, habitCategories, motivations, goals, hydrated, session]);

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

    const pullLatest = async () => {
      if (pulling || syncInFlight.current || !navigator.onLine) return;
      pulling = true;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const response = await fetch(`/api/state?ts=${Date.now()}`, {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${data.session.access_token}`,
            "cache-control": "no-cache",
          },
        });
        if (!response.ok) return;
        const payload = await response.json() as { state: TrackerState | null };
        if (cancelled || !payload.state) return;
        const serverState = normalizeState(payload.state);
        const localState = stateRef.current;
        const hasPendingLocalChanges = !statesEqual(localState, baselineRef.current);
        const nextState = hasPendingLocalChanges ? mergeStates(serverState, localState) : serverState;
        baselineRef.current = serverState;
        localStorage.setItem(baselineKey, JSON.stringify(serverState));
        localStorage.setItem(storageKey, JSON.stringify(nextState));
        setDaily(nextState.daily);
        setWeekly(nextState.weekly);
        setHabitCategories(nextState.categories);
        setMotivations(nextState.motivations.length ? nextState.motivations : dailyMotivations);
        setGoals(nextState.goals);
        setSyncStatus(hasPendingLocalChanges ? "saving" : "synced");
      } finally {
        pulling = false;
      }
    };

    const onFocus = () => { if (document.visibilityState === "visible") void pullLatest(); };
    const onPageShow = () => void pullLatest();
    const supabase = getSupabaseBrowserClient();
    const realtime = supabase
      .channel(`brujula-sync:${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_completions", filter: `user_id=eq.${session.user.id}` }, () => void pullLatest())
      .on("postgres_changes", { event: "*", schema: "public", table: "habits", filter: `user_id=eq.${session.user.id}` }, () => void pullLatest())
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${session.user.id}` }, () => void pullLatest())
      .subscribe();
    const interval = window.setInterval(() => void pullLatest(), 3_000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onPageShow);
    document.addEventListener("visibilitychange", onFocus);
    void pullLatest();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onPageShow);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase.removeChannel(realtime);
    };
  }, [hydrated, session]);

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  const todayNumber = isCurrentMonth ? today.getDate() : null;
  const elapsedDays = isPastMonth ? days : isCurrentMonth ? today.getDate() : 0;
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
  const archivedHabits = [
    ...daily.filter((habit) => habit.archived).map((habit) => ({ type: "daily" as const, habit })),
    ...weekly.filter((habit) => habit.archived).map((habit) => ({ type: "weekly" as const, habit })),
  ];
  const checksFor = (habit: Habit, key = monthKey) => habit.history?.[key] ?? [];
  const weeklyChecksFor = (habit: WeeklyHabit, key = monthKey) => habit.history?.[key] ?? [];
  const goalFor = (habit: Habit) => habit.everyDay ? days : habit.weekdaysOnly ? weekdaysInMonth(year, month) : habit.goal;
  const evaluatedThrough = isCurrentMonth ? today.getDate() : isPastMonth ? days : 0;
  const totalChecks = activeDaily.reduce((sum, habit) => sum + checksFor(habit).filter((d) => d <= evaluatedThrough).length, 0);
  const effectiveGoalThrough = (habit: Habit, through: number) => habit.everyDay
    ? through
    : habit.weekdaysOnly
      ? weekdaysInMonth(year, month, through)
      : Math.min(habit.goal, Math.ceil(habit.goal * through / Math.max(1, days)));
  const totalGoal = activeDaily.reduce((sum, habit) => sum + effectiveGoalThrough(habit, evaluatedThrough), 0);
  const globalProgress = totalGoal ? (totalChecks / totalGoal) * 100 : 0;
  const scoreFromPercent = (percent: number) => Math.min(10, Math.max(0, percent / 10));
  const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const referenceDay = isCurrentMonth ? today.getDate() : days;
  const referenceDate = new Date(year, month, referenceDay);
  const mondayOffset = (referenceDate.getDay() + 6) % 7;
  const weekStart = Math.max(1, referenceDay - mondayOffset);
  const weekEnd = Math.min(days, weekStart + 6);
  const evaluatedWeekEnd = isCurrentMonth ? Math.min(weekEnd, today.getDate()) : weekEnd;
  const habitsScheduledForDay = (day: number) => activeDaily.filter((habit) => !habit.weekdaysOnly || isWeekday(year, month, day));
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
  const weekChecks = activeDaily.reduce((sum, habit) => sum + checksFor(habit).filter((day) => day >= weekStart && day <= evaluatedWeekEnd).length, 0);
  let weekGoal = 0;
  for (let day = weekStart; day <= evaluatedWeekEnd; day += 1) weekGoal += habitsScheduledForDay(day).length;
  const weekScore = scoreFromPercent(weekGoal ? weekChecks / weekGoal * 100 : 0);
  const dayScore = scoreFromPercent(dayProgress);
  const dayScoreTitle = isPastMonth ? "Nota media diaria" : "Nota del día";
  const dayScoreDetail = isPastMonth
    ? `Media de ${pastMonthDailyValues.length} días con hábitos en ${monthNames[month].toLowerCase()}`
    : `${dayChecks} de ${referenceDayHabits.length} hábitos completados`;
  const monthScore = scoreFromPercent(globalProgress);
  const habitCompletion = (habit: Habit) => checksFor(habit).length / Math.max(1, goalFor(habit));
  const ranked = [...daily].filter((habit) => !habit.archived).sort((a, b) => habitCompletion(b) - habitCompletion(a));
  const rankingItems = rankingView === "best" ? ranked : [...ranked].reverse();
  const weeklyProgress = Array.from({ length: Math.ceil(days / 7) }, (_, index) => {
    const start = index * 7 + 1;
    const end = Math.min(days, start + 6);
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
        const dueHabits = habits.filter((habit) => !habit.weekdaysOnly || isWeekday(item.getFullYear(), item.getMonth(), day));
        const completed = dueHabits.filter((habit) => checksFor(habit, key).includes(day)).length;
        const label = item.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");
        return { label, value: dueHabits.length ? completed / dueHabits.length * 100 : 0 };
      });
    }
    if (chartPeriod === "monthly") {
      return Array.from({ length: elapsedDays }, (_, index) => {
        const day = index + 1;
        const completed = habits.reduce((sum, habit) => sum + checksFor(habit).filter((value) => value <= day).length, 0);
        const target = habits.reduce((sum, habit) => sum + (habit.everyDay ? day : habit.weekdaysOnly ? weekdaysInMonth(year, month, day) : Math.min(habit.goal, day)), 0);
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

  function toggleTodayHabit(id: number) {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const habit = daily.find((item) => item.id === id);
    if (habit?.weekdaysOnly && !isWeekday(currentYear, currentMonth, currentDay)) return;
    setDaily((items) => items.map((item) => {
      if (item.id !== id) return item;
      const current = item.history?.[key] ?? [];
      const next = current.includes(currentDay) ? current.filter((day) => day !== currentDay) : [...current, currentDay];
      return { ...item, history: { ...(item.history ?? {}), [key]: next } };
    }));
  }

  function toggleCurrentWeekHabit(id: number) {
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const currentWeek = weekOfMonth(today.getDate());
    setWeekly((items) => items.map((item) => {
      if (item.id !== id) return item;
      const current = item.history?.[key] ?? [];
      const weekDays = daysForMonthWeek(today.getFullYear(), today.getMonth(), currentWeek);
      const weekChecks = current.filter((day) => weekDays.includes(day));
      const next = current.includes(today.getDate())
        ? current.filter((day) => day !== today.getDate())
        : weekChecks.length < item.goal ? [...current, today.getDate()].sort((a, b) => a - b) : current;
      return { ...item, history: { ...(item.history ?? {}), [key]: next } };
    }));
  }

  function changeWeeklyCount(id: number, week: number, direction: 1 | -1) {
    setWeekly((items) => items.map((habit) => {
      if (habit.id !== id) return habit;
      const current = weeklyChecksFor(habit);
      const weekDays = daysForMonthWeek(year, month, week);
      const weekChecks = current.filter((day) => weekDays.includes(day)).sort((a, b) => a - b);
      let next = current;
      if (direction === 1 && weekChecks.length < habit.goal) {
        const availableDay = weekDays.find((day) => !current.includes(day));
        if (availableDay) next = [...current, availableDay].sort((a, b) => a - b);
      }
      if (direction === -1 && weekChecks.length) {
        const lastDay = weekChecks.at(-1)!;
        next = current.filter((day) => day !== lastDay);
      }
      return { ...habit, history: { ...(habit.history ?? {}), [monthKey]: next } };
    }));
  }

  function addHabit() {
    if (!newName.trim() || !modal) return;
    const color = palette[(daily.length + weekly.length) % palette.length];
    if (modal === "daily") {
      setDaily((items) => [...items, { id: Date.now(), name: newName.trim(), goal: everyDay ? days : weekdaysOnly ? weekdaysInMonth(year, month) : newGoal, everyDay, weekdaysOnly, color, checks: [], category: selectedCategory }]);
    } else {
      setWeekly((items) => [...items, { id: Date.now(), name: newName.trim(), goal: Math.min(7, Math.max(1, newGoal)), color, checks: [], category: selectedCategory }]);
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
    const update = (habit: Habit) => habit.id === editing.id ? { ...habit, name: newName.trim(), goal: editing.type === "daily" && everyDay ? days : editing.type === "daily" && weekdaysOnly ? weekdaysInMonth(year, month) : editing.type === "weekly" ? Math.min(7, Math.max(1, newGoal)) : newGoal, everyDay: editing.type === "daily" ? everyDay : false, weekdaysOnly: editing.type === "daily" ? weekdaysOnly : false, color: selectedColor, category: selectedCategory } : habit;
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

  function restoreHabit(type: "daily" | "weekly", id: number) {
    const update = (habit: Habit) => habit.id === id ? { ...habit, archived: false } : habit;
    if (type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
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

  function addGoalProgress(goal: Goal) {
    const amount = Number(goalProgressDrafts[goal.id] ?? "");
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateGoalProgress(goal, goal.currentValue + amount);
    setGoalProgressDrafts((drafts) => ({ ...drafts, [goal.id]: "" }));
  }

  function deleteGoal(id: number) {
    setGoals((items) => items.filter((goal) => goal.id !== id));
    setDeletingGoal(null);
  }

  function archiveGoal(id: number) {
    setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, archived: true } : goal));
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

  function addBook() {
    if (!bookGoal || !bookTitle.trim()) return;
    const entry: BookEntry = { id: Date.now(), title: bookTitle.trim(), format: bookFormat, completedAt: new Date().toISOString().slice(0, 10) };
    setGoals((items) => items.map((goal) => goal.id === bookGoal.id
      ? { ...goal, books: [...(goal.books ?? []), entry], currentValue: Math.min(goal.targetValue, (goal.books?.length ?? 0) + 1), status: (goal.books?.length ?? 0) + 1 >= goal.targetValue ? "completed" : "active" }
      : goal));
    setBookGoal(null); setBookTitle(""); setBookFormat("paper");
  }

  function removeBook(goalId: number, bookId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId ? { ...goal, books: (goal.books ?? []).filter((book) => book.id !== bookId) } : goal));
  }

  function saveFitnessEntry() {
    if (!fitnessGoal) return;
    const parse = (value: string) => value.trim() ? Number(value.replace(",", ".")) : undefined;
    const values = Object.fromEntries(Object.entries(fitnessDraft).map(([key, value]) => [key, parse(value)])) as Record<FitnessMetric, number | undefined>;
    if (Object.values(values).some((value) => value === undefined || Number.isNaN(value) || value < 0)) return;
    const entry: FitnessEntry = { id: Date.now(), recordedAt: new Date().toISOString().slice(0, 10), ...(values as Record<FitnessMetric, number>) };
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
      expected += habit.everyDay ? through : habit.weekdaysOnly ? weekdaysInMonth(today.getFullYear(), index, through) : Math.min(habit.goal, through);
    }
    return Math.min(100, Math.round(completed / Math.max(1, expected) * 100));
  };

  const yearlyWeightedDays = (habitIds: number[], trackingStart?: string) => {
    const selected = daily.filter((habit) => habitIds.includes(habit.id));
    if (!selected.length) return 0;
    let completedWeight = 0;
    const start = trackingStart ? new Date(`${trackingStart}T12:00:00`) : today;
    const startMonth = start.getFullYear() === today.getFullYear() ? start.getMonth() : 0;
    for (let index = startMonth; index <= today.getMonth(); index += 1) {
      const key = `${today.getFullYear()}-${String(index + 1).padStart(2, "0")}`;
      const monthDays = new Date(today.getFullYear(), index + 1, 0).getDate();
      const through = index === today.getMonth() ? today.getDate() : monthDays;
      const firstDay = index === startMonth ? start.getDate() : 1;
      for (let day = firstDay; day <= through; day += 1) {
        const completed = selected.filter((habit) => (habit.history?.[key] ?? []).includes(day)).length;
        completedWeight += completed / selected.length;
      }
    }
    return Math.round(completedWeight * 100) / 100;
  };

  const progressResolvedGoals = goals.map((goal) => {
    if (goal.template === "reading") {
      const currentValue = goal.books?.length ?? 0;
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    }
    if (goal.template === "fitness") {
      const ids = goal.linkedHabitIds ?? [];
      const weightedDays = yearlyWeightedDays(ids, goal.trackingStart);
      const currentValue = Math.min(weightedDays, goal.targetValue);
      return { ...goal, currentValue, status: currentValue >= goal.targetValue ? "completed" as const : "active" as const };
    }
    if (!(goal.linkedHabitIds?.length || goal.linkedHabitId) || goal.status === "discarded") return goal;
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
  const visibleGoals = resolvedGoals.filter((goal) => goal.period === goalFilter
    && goal.status !== "discarded"
    && !goal.archived
    && (goalCategoryFilter === "all" || goal.category === goalCategoryFilter));
  const activeGoals = resolvedGoals.filter((goal) => goal.status === "active" && !goal.archived);
  const realTodayKey = today.toISOString().slice(0, 10);
  const todayMonthKey = realTodayKey.slice(0, 7);
  const currentWeekIndex = Math.floor((today.getDate() - 1) / 7) + 1;
  const todayHabits = activeDaily.filter((habit) => !habit.weekdaysOnly || isWeekday(today.getFullYear(), today.getMonth(), today.getDate()));
  const todayHabitGroups = habitCategories.map((category) => ({ category, habits: todayHabits.filter((habit) => habit.category === category.id) })).filter((group) => group.habits.length);
  const weeklyHabitGroups = habitCategories.map((category) => ({ category, habits: activeWeekly.filter((habit) => habit.category === category.id) })).filter((group) => group.habits.length);
  const todayGoals = activeGoals
    .filter((goal) => goal.period === "daily" ? goal.periodKey === realTodayKey : goal.dueDate >= realTodayKey)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  function openView(view: MainView) {
    if (view === "goals") setGoalFilter("yearly");
    setMainView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          <button className={mainView === "summary" ? "nav-active" : ""} onClick={() => openView("summary")}>Resumen</button>
          <button className={mainView === "today" ? "nav-active" : ""} onClick={() => openView("today")}>Tu día</button>
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

        {mainView === "today" && <>
        <section className="view-intro"><p className="eyebrow">ACCIÓN DIARIA</p><h1>Tu día</h1><p>Lo que requiere tu atención hoy, sin ruido.</p></section>
        <section className="panel today-panel" id="today">
          <div className="today-head">
            <div><p className="eyebrow">HOY · {today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p><h2>Tu día, en una sola vista</h2><p>Marca lo que completas y mantén a la vista los resultados que estás persiguiendo.</p></div>
            <strong>{todayHabits.filter((habit) => (habit.history?.[todayMonthKey] ?? []).includes(today.getDate())).length}/{todayHabits.length} hábitos</strong>
          </div>
          <div className="today-grid">
            <article className="today-column-card">
              <div className="today-section-title"><h3>Hábitos de hoy</h3><span>{todayHabits.length}</span></div>
              <div className="today-list grouped">
                {todayHabitGroups.map(({ category, habits }) => <div className="today-block" key={category.id}><div className="today-block-title" style={{ color: category.color }}><span>{category.icon}</span><strong>{category.label}</strong><small>{habits.length}</small></div>{habits.map((habit) => {
                  const checked = (habit.history?.[todayMonthKey] ?? []).includes(today.getDate());
                  return <button key={habit.id} className={`today-item ${checked ? "done" : ""}`} onClick={() => toggleTodayHabit(habit.id)} aria-pressed={checked}>
                    <i style={{ background: habit.color }} /><span><strong>{habit.name}</strong><small>{checked ? "Completado" : "Pendiente"}</small></span><b>{checked ? "✓" : ""}</b>
                  </button>;
                })}</div>)}
                {!todayHabits.length && <p className="today-empty">No tienes hábitos previstos para hoy.</p>}
              </div>
              {!!activeWeekly.length && <><div className="today-section-title secondary"><h3>Esta semana</h3><span>{activeWeekly.length}</span></div><div className="today-list compact grouped">{weeklyHabitGroups.map(({ category, habits }) => <div className="today-block" key={category.id}><div className="today-block-title" style={{ color: category.color }}><span>{category.icon}</span><strong>{category.label}</strong><small>{habits.length}</small></div>{habits.map((habit) => {
                const weekDays = daysForMonthWeek(today.getFullYear(), today.getMonth(), currentWeekIndex);
                const count = (habit.history?.[todayMonthKey] ?? []).filter((day) => weekDays.includes(day)).length;
                const completed = count >= habit.goal;
                const doneToday = (habit.history?.[todayMonthKey] ?? []).includes(today.getDate());
                return <button key={habit.id} className={`today-item ${completed ? "done" : ""}`} onClick={() => toggleCurrentWeekHabit(habit.id)} aria-pressed={doneToday}><i style={{ background: habit.color }} /><span><strong>{habit.name}</strong><small>{count}/{habit.goal} esta semana{doneToday ? " · hecho hoy" : ""}</small></span><b>{completed ? "✓" : "+"}</b></button>;
              })}</div>)}</div></>}
            </article>
            <article className="today-column-card">
              <div className="today-section-title"><h3>Objetivos en foco</h3><span>{todayGoals.length}</span></div>
              <div className="today-goals">
                {todayGoals.map((goal) => {
                  const category = habitCategories.find((item) => item.id === goal.category) ?? habitCategories[0];
                  const progress = Math.min(100, Math.round(goal.currentValue / Math.max(1, goal.targetValue) * 100));
                  return <div className="today-goal" key={goal.id} style={{ "--goal-color": category?.color ?? "#39c6a4" } as CSSProperties}>
                    <div><span>{category?.icon} {goal.period === "daily" ? "Hoy" : goal.period === "weekly" ? "Semana" : goal.period === "monthly" ? "Mes" : "Año"}</span><strong>{goal.title}</strong><small>{progress}% · vence {new Date(`${goal.dueDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small></div>
                    {goal.measurement === "complete" ? <button onClick={() => updateGoalProgress(goal, 1)}>✓</button> : <b>{goal.currentValue}/{goal.targetValue}{goal.unit ? ` ${goal.unit}` : ""}</b>}
                  </div>;
                })}
                {!todayGoals.length && <p className="today-empty">No hay objetivos activos que requieran tu atención.</p>}
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
            <p>Del día {weekStart} al {evaluatedWeekEnd}</p>
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
            return <article data-goal-id={goal.id} className={`goal-card ${draggingGoalId === goal.id ? "is-dragging" : ""}`} key={goal.id} style={{ "--goal-color": category?.color ?? "#39c6a4" } as CSSProperties}>
              <div className="goal-card-head"><span>{category?.icon} {category?.label}</span><div className="goal-card-actions"><button type="button" className="goal-drag-handle" disabled={goalCategoryFilter !== "all"} onPointerDown={(event) => startGoalPointerDrag(event, goal.id)} onPointerMove={moveGoalPointerDrag} onPointerUp={(event) => finishGoalPointerDrag(event, goal.id)} onPointerCancel={() => setDraggingGoalId(null)} aria-label={`Arrastrar ${goal.title} para reordenar`} title={goalCategoryFilter === "all" ? "Arrastrar para reordenar" : "Quita el filtro para reordenar"}>⠿</button>{goal.status === "completed" && <button className="goal-archive" onClick={() => archiveGoal(goal.id)} aria-label={`Archivar ${goal.title}`} title="Archivar objetivo completado">▣</button>}<button onClick={() => startGoalEdit(goal)} aria-label={`Editar ${goal.title}`}>✎</button><button onClick={() => setDeletingGoal(goal)} aria-label={`Borrar ${goal.title}`}>×</button></div></div>
              <h3>{goal.title}</h3>
              {parentAnnualGoal && <small className="goal-parent-link">Hito de: {parentAnnualGoal.title}</small>}
              <div className="goal-progress"><i style={{ width: `${progress}%` }} /></div>
              <div className="goal-card-foot"><strong>{goal.currentValue} / {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ""}</strong><span>{progress}% · hasta {new Date(`${goal.dueDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></div>
              {linkedMilestones.length ? <div className="goal-milestones"><strong>{linkedMilestones.filter((item) => item.status === "completed").length} de {linkedMilestones.length} hitos completados</strong>{visibleMilestones.map((item) => <span key={item.id} className={item.status === "completed" ? "done" : ""}>{item.status === "completed" ? "✓" : "○"} {item.title}</span>)}{archivedMilestones > 0 && <small>{archivedMilestones} {archivedMilestones === 1 ? "hito archivado incluido" : "hitos archivados incluidos"}</small>}</div>
                : goal.template === "reading" ? <><button className="goal-complete" onClick={() => setBookGoal(goal)}>+ Registrar libro terminado</button><div className="goal-entry-list">{(goal.books ?? []).slice(-3).reverse().map((book) => <div key={book.id}><span>{book.title}</span><small>{{ audio: "Audiolibro", digital: "Electrónico", paper: "Papel" }[book.format]}</small><button onClick={() => removeBook(goal.id, book.id)} aria-label={`Eliminar ${book.title}`}>×</button></div>)}</div><small className="goal-consistency">Constancia de lectura: {goal.linkedHabitId ? `${yearlyHabitPercent(goal.linkedHabitId)}%` : "sin hábito vinculado"}</small></>
                : goal.template === "fitness" ? <><small className="goal-consistency">{(goal.linkedHabitIds ?? []).length ? `${(goal.linkedHabitIds ?? []).length} hábitos · cada uno pondera ${(100 / (goal.linkedHabitIds ?? []).length).toFixed(2)}% al día` : "Sin hábitos vinculados"}</small><button className="goal-complete" onClick={() => setFitnessGoal(goal)}>+ Actualizar métricas</button><div className="fitness-chart-controls"><select value={fitnessMetric} onChange={(event) => setFitnessMetric(event.target.value as FitnessMetric)}>{Object.entries(fitnessMetricMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select><div className="tabs">{([30, 90, 365] as const).map((period) => <button key={period} className={fitnessPeriod === period ? "active" : ""} onClick={() => setFitnessPeriod(period)}>{period === 30 ? "30 días" : period === 90 ? "3 meses" : "1 año"}</button>)}</div></div><FitnessChart entries={goal.fitnessEntries ?? []} metric={fitnessMetric} period={fitnessPeriod} /></>
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
              <button className="reset-button archived-button" onClick={() => setArchivedManagerOpen(true)}>
                Archivados{archivedHabits.length > 0 && <span>{archivedHabits.length}</span>}
              </button>
              <div className="tabs">
                <button className={activeTab === "daily" ? "active" : ""} onClick={() => setActiveTab("daily")}>Diarios</button>
                <button className={activeTab === "weekly" ? "active" : ""} onClick={() => setActiveTab("weekly")}>Semanales</button>
              </div>
              <button className="add-button" onClick={() => { setModal(activeTab); setNewGoal(activeTab === "daily" ? 12 : 1); setEveryDay(false); setWeekdaysOnly(false); setSelectedCategory("health"); }}>+ Añadir hábito</button>
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
                const availableWeeks = [1, 2, 3, 4, 5].filter((week) => daysForMonthWeek(year, month, week).length);
                const monthlyTarget = habit.goal * availableWeeks.length;
                const progress = Math.min(100, Math.round(currentChecks.length / Math.max(1, monthlyTarget) * 100));
                return <div className={`weekly-row ${dragging?.id === habit.id ? "is-dragging" : ""}`} key={habit.id} onDragOver={(e) => e.preventDefault()} onDrop={() => dragging?.type === "weekly" && reorderHabit("weekly", dragging.id, habit.id)}>
                  <div className="habit-name"><span className="drag-handle" draggable onDragStart={() => setDragging({ type: "weekly", id: habit.id })} onDragEnd={() => setDragging(null)} title="Arrastrar para reordenar" aria-label={`Arrastrar ${habit.name}`}>⠿</span><i style={{ background: habit.color }} /><span>{habit.name}</span><div className="habit-menu"><button className="menu-trigger" aria-label={`Gestionar ${habit.name}`} onClick={() => setActionHabit({ type: "weekly", habit })}>⋯</button></div></div>
                  <div className="week-checks">{availableWeeks.map((week) => { const weekDays = daysForMonthWeek(year, month, week); const count = currentChecks.filter((day) => weekDays.includes(day)).length; return <div className={`week-counter ${count >= habit.goal ? "checked" : ""}`} key={week}><span>S{week}</span><button onClick={() => changeWeeklyCount(habit.id, week, -1)} disabled={count === 0} aria-label={`Restar una realización de ${habit.name} en la semana ${week}`}>−</button><strong>{count}/{habit.goal}</strong><button onClick={() => changeWeeklyCount(habit.id, week, 1)} disabled={count >= habit.goal} aria-label={`Sumar una realización de ${habit.name} en la semana ${week}`}>+</button></div>; })}</div>
                  <div className="weekly-result"><strong>{progress}%</strong><span>{currentChecks.length}/{monthlyTarget}</span></div>
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

      {bookGoal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setBookGoal(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setBookGoal(null)} aria-label="Cerrar">×</button><p className="eyebrow">LECTURA ANUAL</p><h2>Registrar libro terminado</h2>
        <label>Título<input autoFocus value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="Título del libro" /></label>
        <label>Formato<select value={bookFormat} onChange={(event) => setBookFormat(event.target.value as BookFormat)}><option value="paper">Papel</option><option value="digital">Electrónico</option><option value="audio">Audiolibro</option></select></label>
        <button className="add-button full" disabled={!bookTitle.trim()} onClick={addBook}>Añadir libro</button>
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
        <p className="eyebrow">BORRAR OBJETIVO</p><h2>¿Borrar “{deletingGoal.title}”?</h2><p>También se eliminará su historial específico. Esta acción no afecta a los hábitos vinculados.</p>
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
            <label className="frequency-toggle"><input type="radio" name="new-frequency" checked={!everyDay && !weekdaysOnly} onChange={() => { setEveryDay(false); setWeekdaysOnly(false); }} /><span><strong>Días al mes</strong><small>Define cuántos días quieres completar el hábito cada mes.</small></span></label>
            <label className="frequency-toggle"><input type="radio" name="new-frequency" checked={everyDay} onChange={() => { setEveryDay(true); setWeekdaysOnly(false); }} /><span><strong>Todos los días</strong><small>Objetivo automático de {days} días en {monthNames[month]}.</small></span></label>
            <label className="frequency-toggle"><input type="radio" name="new-frequency" checked={weekdaysOnly} onChange={() => { setWeekdaysOnly(true); setEveryDay(false); }} /><span><strong>Días laborables</strong><small>De lunes a viernes; excluye sábados y domingos ({weekdaysInMonth(year, month)} días).</small></span></label>
          </div>}
          {!everyDay && !weekdaysOnly && <label>{modal === "weekly" ? "Veces por semana" : "Objetivo del mes"}<input type="number" min="1" max={modal === "daily" ? days : 7} value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} />{modal === "weekly" && <small className="field-help">Podrás registrar cada realización hasta alcanzar esta meta semanal.</small>}</label>}
          <button className="add-button full" onClick={addHabit}>Crear hábito</button>
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
      {archivedManagerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setArchivedManagerOpen(false)}>
        <div className="modal archived-modal" role="dialog" aria-modal="true" aria-labelledby="archived-title" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close" onClick={() => setArchivedManagerOpen(false)} aria-label="Cerrar">×</button>
          <p className="eyebrow">HISTORIAL CONSERVADO</p>
          <h2 id="archived-title">Hábitos archivados</h2>
          {archivedHabits.length === 0 ? (
            <div className="archived-empty">
              <strong>No tienes hábitos archivados</strong>
              <p>Cuando archives uno, podrás encontrarlo y restaurarlo desde aquí sin perder sus registros.</p>
            </div>
          ) : (
            <div className="archived-list">
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
            </div>
          )}
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
            <label className="frequency-toggle"><input type="radio" name="edit-frequency" checked={!everyDay && !weekdaysOnly} onChange={() => { setEveryDay(false); setWeekdaysOnly(false); }} /><span><strong>Días al mes</strong><small>Define cuántos días quieres completar el hábito cada mes.</small></span></label>
            <label className="frequency-toggle"><input type="radio" name="edit-frequency" checked={everyDay} onChange={() => { setEveryDay(true); setWeekdaysOnly(false); }} /><span><strong>Todos los días</strong><small>El objetivo se ajustará al número real de días del mes.</small></span></label>
            <label className="frequency-toggle"><input type="radio" name="edit-frequency" checked={weekdaysOnly} onChange={() => { setWeekdaysOnly(true); setEveryDay(false); }} /><span><strong>Días laborables</strong><small>De lunes a viernes; excluye sábados y domingos ({weekdaysInMonth(year, month)} días).</small></span></label>
          </div>}
          {!everyDay && !weekdaysOnly && <label>{editing.type === "weekly" ? "Veces por semana" : "Objetivo del mes"}<input type="number" min="1" max={editing.type === "daily" ? days : 7} value={newGoal} onChange={(e) => setNewGoal(Number(e.target.value))} />{editing.type === "weekly" && <small className="field-help">La meta se aplica de nuevo cada semana.</small>}</label>}
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
