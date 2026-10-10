import {
  metricKeys,
  metrics,
  sumMacros,
  weeklyNutrition,
  type Entry,
} from "../../../lib/domain/nutrition";
import {
  fmt,
  type NutritionGoals,
} from "../../../lib/domain/nutrition-analysis";

export function WeeklyBalance({
  entries,
  days,
  today,
  goals,
}: {
  entries: Entry[];
  days: string[];
  today: string;
  goals: NutritionGoals | null;
}) {
  const start = days[0],
    end = days[6];
  const week = weeklyNutrition(entries, days, today, goals);
    const chartMax = Math.max(
      goals?.calories ?? 0,
      ...days.map(
        (day) => sumMacros(entries.filter((e) => e.date === day)).calories,
      ),
      1,
    );
    const recordedWeekDays = days.filter((day) =>
      entries.some((entry) => entry.date === day),
    );
    const weeklyCalorieDelta = goals
      ? recordedWeekDays.reduce(
          (sum, day) =>
            sum +
            (sumMacros(entries.filter((entry) => entry.date === day)).calories -
              goals.calories),
          0,
        )
      : 0;
  return (
    <article className="panel">
      <h2>Balance semanal</h2>
      <p>
        {start} — {end} · {week.recorded}/7 días con registros hasta hoy.
      </p>
      <p>
        Medias de los días registrados; pueden incluir días incompletos.
        Comparación con tus objetivos actuales.
      </p>
      <div className="nutrition-grid">
        {metricKeys.map((key) => (
          <div key={key}>
            <h3>{metrics[key]} medias/día</h3>
            <strong>
              {week.recorded ? fmt(week.average[key]) : "—"}{" "}
              {key === "calories" ? "kcal" : "g"}
            </strong>
            <p>Objetivo: {goals ? fmt(goals[key]) : "—"}</p>
          </div>
        ))}
      </div>
      {goals && (
        <p>
          Calorías dentro del rango: {week.caloriesWithin}/{week.recorded}{" "}
          días registrados · Proteína alcanzada: {week.proteinReached}/
          {week.recorded} días registrados
        </p>
      )}
      <h3>Calorías de la semana</h3>
      <p>
        La línea marca el objetivo:{" "}
        {goals ? `${fmt(goals.calories)} kcal` : "sin configurar"}.{" "}
        {goals && recordedWeekDays.length ? (
          <strong
            className={
              weeklyCalorieDelta <= 0
                ? "nutrition-deficit"
                : "nutrition-surplus"
            }
          >
            {weeklyCalorieDelta <= 0
              ? `Déficit acumulado: ${fmt(Math.abs(weeklyCalorieDelta))} kcal`
              : `Exceso acumulado: ${fmt(weeklyCalorieDelta)} kcal`}{" "}
            en {recordedWeekDays.length} días con registro.
          </strong>
        ) : null}
      </p>
      <div className="nutrition-chart">
        {days.map((day) => {
          const meals = entries.filter((e) => e.date === day);
          const calories = sumMacros(meals).calories;
          const delta =
            goals && meals.length ? calories - goals.calories : null;
          return (
            <div key={day}>
              <small>{meals.length ? fmt(calories) : "—"}</small>
              <div className="nutrition-track">
                {goals && (
                  <span
                    className="nutrition-target"
                    style={{
                      bottom: `${(goals.calories / chartMax) * 100}%`,
                    }}
                  />
                )}
                {meals.length > 0 && (
                  <i
                    style={{ height: `${(calories / chartMax) * 100}%` }}
                  />
                )}
              </div>
              {delta !== null && (
                <em
                  className={
                    delta <= 0 ? "nutrition-deficit" : "nutrition-surplus"
                  }
                >
                  {delta <= 0
                    ? `−${fmt(Math.abs(delta))}`
                    : `+${fmt(delta)}`}{" "}
                  kcal
                </em>
              )}
              <small>
                {new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", {
                  weekday: "short",
                })}
              </small>
            </div>
          );
        })}
      </div>
    </article>
  );
}
