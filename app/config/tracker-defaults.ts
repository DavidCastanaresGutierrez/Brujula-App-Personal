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

const legacyDailyMotivations = [
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

const extendedDailyMotivations = [
  "El día mejora cuando eliges una acción que sí depende de ti.",
  "No necesitas más tiempo; necesitas proteger mejor el que ya tienes.",
  "Una decisión útil ahora vale más que diez planes para mañana.",
  "Tu identidad se fortalece cada vez que cumples una promesa pequeña.",
  "El cansancio pide pausa; la renuncia decide abandonar. No son lo mismo.",
  "Busca continuidad, no intensidad.",
  "Hoy cuenta aunque el resultado todavía no se vea.",
  "Reduce la fricción y deja que el hábito haga el resto.",
  "El siguiente paso no tiene que impresionar; tiene que ocurrir.",
  "Lo difícil se vuelve familiar cuando dejas de evitarlo.",
  "Construye un día que mañana quieras repetir.",
  "Tu atención marca el rumbo antes que tu agenda.",
  "Una pausa consciente también puede proteger tu progreso.",
  "El mejor momento para retomar es antes de sentirte preparado.",
  "Terminar algo pequeño libera energía para lo importante.",
  "El progreso sostenible deja espacio para vivir.",
  "No conviertas un tropiezo en una dirección.",
  "Repite lo esencial hasta que deje de depender de la motivación.",
  "Elegir bien una vez ayuda; diseñarlo bien ayuda todos los días.",
  "Tu futuro se beneficia de lo que haces cuando nadie te exige nada.",
  "Hoy puedes reducir la distancia entre intención y acción.",
  "Menos objetivos abiertos; más compromisos terminados.",
  "Descansar a tiempo también es una forma de disciplina.",
  "Cada límite bien puesto protege algo importante.",
  "La claridad aparece cuando empiezas a moverte.",
  "No hace falta recuperar todo hoy; basta con recuperar el rumbo.",
  "El hábito correcto simplifica decisiones futuras.",
  "Una semana sólida empieza cuidando este día.",
  "Lo que haces con frecuencia importa más que lo que haces de vez en cuando.",
  "El avance silencioso sigue siendo avance.",
  "Puedes exigirte sin tratarte como un enemigo.",
  "La consistencia admite días lentos, pero no necesita días perfectos.",
  "Si hoy cuesta más, haz una versión más pequeña.",
  "Priorizar es aceptar que no todo merece tu energía.",
  "Elige una acción que haga más fácil la siguiente.",
  "Tu sistema debe ayudarte también en los días malos.",
  "Cumplir lo básico protege el impulso.",
  "Una decisión consciente puede cambiar el tono de todo el día.",
  "No confundas estar ocupado con estar avanzando.",
  "Tu progreso no desaparece por necesitar descanso.",
  "Vuelve al motivo, ajusta el método y continúa.",
  "El día no está perdido mientras aún puedas elegir bien una cosa.",
  "Acumula evidencia de que puedes confiar en ti.",
  "Una rutina útil debe sostenerte, no castigarte.",
  "Empieza por lo que desbloquea lo demás.",
  "Cuando baje la energía, reduce el tamaño, no abandones la dirección.",
  "Tu entorno también participa en tus decisiones: prepáralo a tu favor.",
  "Deja preparado hoy el primer paso de mañana.",
  "El equilibrio se construye corrigiendo, no permaneciendo inmóvil.",
  "No necesitas sentir ganas para actuar de acuerdo con tus valores.",
  "Protege tus prioridades antes de llenar los huecos.",
  "El progreso más valioso suele ser el que puedes mantener.",
  "Cumple la siguiente repetición; la racha se ocupará del resto.",
  "Una elección sencilla puede evitar una negociación innecesaria.",
  "Lo importante merece un lugar concreto en el día.",
  "Tu medida real es la capacidad de regresar.",
  "Avanza con intención, incluso cuando avances despacio.",
  "El esfuerzo de hoy puede convertirse en facilidad futura.",
  "Revisar el rumbo no significa haber fracasado.",
  "Haz visible el progreso para recordar que está ocurriendo.",
  "Tu mejor versión también sabe ajustar expectativas.",
  "Elige terminar el día un poco más cerca."
];

export const dailyMotivations = [...legacyDailyMotivations, ...extendedDailyMotivations];

export function upgradeDefaultMotivations(motivations: string[] | undefined) {
  const available = motivations?.filter((item) => item.trim()) ?? [];
  const stillUsesLegacyDefaults = available.length === legacyDailyMotivations.length
    && available.every((item, index) => item === legacyDailyMotivations[index]);
  return stillUsesLegacyDefaults ? dailyMotivations : available;
}

export function motivationForToday(motivations = dailyMotivations, date = new Date()) {
  const available = motivations.length ? motivations : dailyMotivations;
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return available[dayNumber % available.length];
}
