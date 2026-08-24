import type { Category, Habit, WeeklyHabit } from "../../lib/domain/tracker-state";

export const palette = [
  "#ff0000", "#f97316", "#f59e0b", "#fbbf24", "#84cc16", "#39c6a4", "#14b8a6",
  "#22d3ee", "#50b8e7", "#3b82f6", "#6366f1", "#8b5cf6", "#a78bfa", "#d946ef",
  "#ff3b88", "#f472b6", "#fb7185", "#ef476f", "#94a3b8",
];

export const blockIcons = [
  "♥", "✦", "⌂", "€", "▣", "●", "★", "✓", "☀", "☾", "⚡", "☘", "∞", "⚖", "⚙", "☕",
  "♫", "✎", "◆", "◇", "▲", "◉", "⚑", "↑", "♜", "☯", "✈", "☎", "@", "$", "%", "&",
];

export const weeklyBarPalette = ["#3cc9ab", "#ffb51b", "#ff3b6b", "#50b8e7", "#a78bfa", "#f472b6"];

export const defaultCategories: Category[] = [
  { id: "health", label: "Salud", icon: "♥", color: "#39c6a4" },
  { id: "family", label: "Familia", icon: "⌂", color: "#f472b6" },
  { id: "growth", label: "Crecimiento personal", icon: "✦", color: "#a78bfa" },
  { id: "finance", label: "Finanzas", icon: "€", color: "#fbbf24" },
  { id: "work", label: "Trabajo", icon: "▣", color: "#50b8e7" },
];

export const initialDaily: Habit[] = [
  { id: 1, name: "Correr", goal: 16, color: palette[0], checks: [], category: "health" },
  { id: 2, name: "Meditar", goal: 25, color: palette[1], checks: [], category: "growth" },
  { id: 3, name: "Ducha fría", goal: 5, color: palette[2], checks: [], category: "health" },
  { id: 4, name: "Comer saludable", goal: 25, color: palette[3], checks: [], category: "health" },
  { id: 5, name: "Beber 2 L de agua", goal: 25, color: palette[4], checks: [], category: "health" },
  { id: 6, name: "Leer", goal: 10, color: palette[5], checks: [], category: "growth" },
  { id: 7, name: "Estirar", goal: 28, color: "#67e8f9", checks: [], category: "health" },
];

export const initialWeekly: WeeklyHabit[] = [
  { id: 101, name: "Colada", goal: 1, color: palette[0], checks: [], category: "family" },
  { id: 102, name: "Preparar comidas", goal: 1, color: palette[1], checks: [], category: "health" },
  { id: 103, name: "Limpieza", goal: 1, color: palette[2], checks: [], category: "family" },
  { id: 104, name: "Compra", goal: 1, color: palette[3], checks: [], category: "family" },
  { id: 105, name: "Tiempo en familia", goal: 1, color: palette[4], checks: [], category: "family" },
];

export const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const dayNames = ["D", "L", "M", "X", "J", "V", "S"];

export const dailyMotivations = [
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

export function motivationForToday(motivations = dailyMotivations) {
  const available = motivations.length ? motivations : dailyMotivations;
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return available[dayNumber % available.length];
}
