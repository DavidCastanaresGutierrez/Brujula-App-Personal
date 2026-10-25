import { dayCompletion, type ActionableInsight, type InsightHabit } from "./insights";
import { shiftDate, sumMacros, validDate, type BodyComposition, type Entry } from "./nutrition";
import type { NutritionGoals } from "./nutrition-analysis";
import { isoDate } from "./tracking";

type Candidate = ActionableInsight & { priority: number };

const shortDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const round = (value: number) => Math.round(value).toLocaleString("es-ES");

// Cross-domain rules for the summary: how nutrition and body measurements relate to
// the goals and to the habits. Every insight states its evidence and its threshold.
export function generateNutritionInsights(
  today: Date,
  entries: Entry[],
  goals: NutritionGoals | null,
  bodyEntries: BodyComposition[],
  habits: InsightHabit[],
): ActionableInsight[] {
  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const dayKey = (offset: number) => shiftDate(todayKey, offset);
  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
  const recordedDays = (from: number, to = 0) =>
    Array.from({ length: to - from + 1 }, (_, index) => dayKey(from + index)).filter((key) => byDay.has(key));
  const insights: Candidate[] = [];

  const last14 = recordedDays(-13);
  if (entries.some((entry) => entry.date >= dayKey(-55)) && last14.length < 7) {
    insights.push({
      id: "nutrition-logging", kind: "nutrition", severity: "attention", priority: 60 + (7 - last14.length) * 3,
      title: "El registro de comidas se ha quedado a medias",
      detail: `${last14.length} de 14 días con comidas registradas.`,
      evidence: `Días con registro: ${last14.length}; sin registro: ${14 - last14.length}.`,
      rule: "Aparece si en los últimos 14 días hay menos de 7 con comidas, habiendo registros en las últimas 8 semanas.",
      period: `${shortDate(dayKey(-13))}–${shortDate(todayKey)}`,
      action: "Registra al menos la comida principal: con medio registro las medias semanales engañan.",
    });
  }

  if (goals) {
    const recent = last14.slice(-7);
    if (recent.length >= 4) {
      const totals = recent.map((key) => sumMacros(byDay.get(key) ?? []));
      const average = (metric: "protein" | "calories") => totals.reduce((sum, total) => sum + total[metric], 0) / totals.length;
      const protein = average("protein");
      const calories = average("calories");
      const period = `${shortDate(recent[0])}–${shortDate(recent.at(-1)!)} · ${recent.length} días registrados`;
      if (protein < goals.protein * 0.85) {
        insights.push({
          id: "nutrition-protein", kind: "nutrition", severity: "attention", priority: 65 + Math.round((1 - protein / goals.protein) * 40),
          title: "Proteína por debajo del objetivo",
          detail: `Media de ${round(protein)} g frente a ${round(goals.protein)} g al día.`,
          evidence: `Media de los ${recent.length} últimos días con registro: ${round(protein)} g; objetivo ${round(goals.protein)} g (${round((protein / goals.protein) * 100)} %).`,
          rule: "Aparece con al menos 4 días registrados y una media inferior al 85 % del objetivo de proteína.",
          period,
          action: "Añade una fuente de proteína a la comida que más falle; los alimentos guardados agilizan el registro.",
        });
      }
      if (calories > goals.calories * 1.1) {
        insights.push({
          id: "nutrition-calories-high", kind: "nutrition", severity: "attention", priority: 58 + Math.round((calories / goals.calories - 1) * 50),
          title: "Calorías por encima del objetivo",
          detail: `Media de ${round(calories)} kcal frente a ${round(goals.calories)} kcal al día.`,
          evidence: `Media de los ${recent.length} últimos días con registro: ${round(calories)} kcal (${round((calories / goals.calories) * 100)} % del objetivo).`,
          rule: "Aparece con al menos 4 días registrados y una media superior al 110 % del objetivo calórico.",
          period,
          action: "Revisa las cenas y los extras entre horas antes de recortar comidas principales.",
        });
      } else if (calories < goals.calories * 0.8) {
        insights.push({
          id: "nutrition-calories-low", kind: "nutrition", severity: "attention", priority: 50,
          title: "Ingesta muy por debajo del objetivo",
          detail: `Media de ${round(calories)} kcal frente a ${round(goals.calories)} kcal al día.`,
          evidence: `Media de los ${recent.length} últimos días con registro: ${round(calories)} kcal (${round((calories / goals.calories) * 100)} % del objetivo).`,
          rule: "Aparece con al menos 4 días registrados y una media inferior al 80 % del objetivo calórico.",
          period,
          action: "Comprueba si faltan comidas por registrar; si el registro es completo, un déficit tan grande no se sostiene.",
        });
      }
    }
  }

  // Measurements are only compared when their dates are well formed and the numbers finite.
  const measurements = bodyEntries.filter((entry) => validDate(entry.recorded_at) && Number.isFinite(entry.weight) && Number.isFinite(entry.body_fat));
  const latest = measurements.at(-1);
  if (latest) {
    const limit = shiftDate(latest.recorded_at, -21);
    const reference = [...measurements].reverse().find((entry) => entry.recorded_at <= limit);
    if (reference) {
      const weightChange = latest.weight - reference.weight;
      const fatChange = latest.body_fat - reference.body_fat;
      if (Math.abs(fatChange) >= 1 || Math.abs(weightChange) >= 1.5) {
        const severity = fatChange <= -1 ? "positive" : fatChange >= 1 || (weightChange >= 1.5 && fatChange >= 0) ? "attention" : "neutral";
        const sign = (value: number, unit: string) => `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("es-ES", { maximumFractionDigits: 1 })} ${unit}`;
        insights.push({
          id: "body-trend", kind: "body", severity, priority: severity === "attention" ? 62 : 35,
          title: severity === "positive" ? "La grasa corporal está bajando" : severity === "attention" ? "El cuerpo va en la dirección contraria" : "Cambio corporal relevante",
          detail: `Peso ${sign(weightChange, "kg")} y grasa ${sign(fatChange, "puntos")} desde el ${shortDate(reference.recorded_at)}.`,
          evidence: `${shortDate(reference.recorded_at)}: ${reference.weight} kg, ${reference.body_fat} % grasa · ${shortDate(latest.recorded_at)}: ${latest.weight} kg, ${latest.body_fat} % grasa.`,
          rule: "Compara la última medición con la más reciente de hace al menos 3 semanas; aparece si la grasa cambia 1 punto o el peso 1,5 kg.",
          period: `${shortDate(reference.recorded_at)}–${shortDate(latest.recorded_at)}`,
          action: severity === "attention" ? "Cruza este dato con las calorías medias de arriba antes de cambiar el plan." : "Mantén lo que estás haciendo y sigue midiendo cada semana.",
        });
      }
    }
  }

  const strong: number[] = [];
  const weak: number[] = [];
  for (const key of recordedDays(-27)) {
    const completion = dayCompletion(habits, new Date(`${key}T12:00:00`));
    if (!completion.scheduled) continue;
    const rate = completion.completed / completion.scheduled;
    const calories = sumMacros(byDay.get(key) ?? []).calories;
    if (rate >= 0.8) strong.push(calories);
    else if (rate < 0.5) weak.push(calories);
  }
  if (strong.length >= 5 && weak.length >= 5) {
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const strongMean = mean(strong);
    const weakMean = mean(weak);
    if (strongMean > 0 && Math.abs(weakMean - strongMean) / strongMean >= 0.15) {
      const eatMore = weakMean > strongMean;
      insights.push({
        id: "nutrition-habits-link", kind: "nutrition", severity: "neutral", priority: 45,
        title: eatMore ? "Los días flojos de hábitos comes más" : "Los días flojos de hábitos comes menos",
        detail: `${round(strongMean)} kcal de media con los hábitos cumplidos frente a ${round(weakMean)} kcal los días flojos.`,
        evidence: `${strong.length} días con al menos el 80 % de hábitos completados y ${weak.length} días por debajo del 50 %, todos con comidas registradas.`,
        rule: "Aparece con al menos 5 días de cada tipo en los últimos 28 y una diferencia de calorías del 15 % o más.",
        period: `${shortDate(dayKey(-27))}–${shortDate(todayKey)}`,
        action: eatMore ? "Prepara una comida sencilla para los días que se tuercen; la decisión fácil es la que se cumple." : "Un día flojo con poca comida suele ser cansancio: vigila el descanso antes que la dieta.",
      });
    }
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 3).map(({ priority: _priority, ...insight }) => {
    void _priority;
    return insight;
  });
}
