import { useState } from "react";
import {
  metricKeys,
  metrics,
  type Entry,
  type Macros,
} from "../../../lib/domain/nutrition";
import {
  fmt,
  macroStackOrder,
  macroEnergyPercentages,
  historyBuckets,
  type NutritionGoals,
  type HistoryPeriod,
} from "../../../lib/domain/nutrition-analysis";

export function NutritionHistory({
  entries,
  goals,
  today,
}: {
  entries: Entry[];
  goals: NutritionGoals | null;
  today: string;
}) {
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("weeks");
  const [historyChart, setHistoryChart] = useState<"calories" | "macros">(
    "calories",
  );
    const history = historyBuckets(historyPeriod, today, entries);
    const historyRecorded = history.filter((item) => item.macros !== null);
    const historyAverage = metricKeys.reduce(
      (result, key) => ({
        ...result,
        [key]:
          historyRecorded.reduce(
            (sum, item) => sum + (item.macros?.[key] ?? 0),
            0,
          ) / (historyRecorded.length || 1),
      }),
      {} as Macros,
    );
    const historyChartMax = Math.max(
      goals?.calories ?? 0,
      ...history.map((item) => item.macros?.calories ?? 0),
      1,
    );
    const historyCalorieDelta = goals
      ? history.reduce(
          (sum, item) =>
            sum +
            (item.recorded
              ? item.total.calories - goals.calories * item.recorded
              : 0),
          0,
        )
      : 0;
    const idealMacroDistribution = goals ? macroEnergyPercentages(goals) : null;
    const periodConclusion = (() => {
      if (!goals || !historyRecorded.length) return null;
      const calorieAverage = historyAverage.calories,
        proteinAverage = historyAverage.protein;
      const balance =
        calorieAverage < goals.calories * 0.9
          ? "Has mantenido un déficit medio."
          : calorieAverage > goals.calories * 1.1
            ? "Has estado, de media, por encima de tu objetivo calórico."
            : "Tu ingesta calórica media ha estado cerca del objetivo.";
      const protein =
        proteinAverage < goals.protein
          ? `La principal mejora es subir la proteína: promedias ${fmt(proteinAverage)} g frente a ${fmt(goals.protein)} g.`
          : "La proteína media ha alcanzado el objetivo, una buena base para preservar masa muscular.";
      return { balance, protein };
    })();
  return (
    <>
      <article className="panel nutrition-history">
        <div className="panel-head">
          <div>
            <p className="eyebrow">EVOLUCIÓN NUTRICIONAL</p>
            <h2>Resumen combinado</h2>
          </div>
          <div className="nutrition-history-tabs" role="tablist">
            {(["weeks", "months"] as HistoryPeriod[]).map(
              (period) => (
                <button
                  key={period}
                  role="tab"
                  aria-selected={historyPeriod === period}
                  className={historyPeriod === period ? "active" : ""}
                  onClick={() => setHistoryPeriod(period)}
                >
                  {period === "weeks" ? "Semanas" : "Meses"}
                </button>
              ),
            )}
          </div>
        </div>
        <div
          className="nutrition-history-tabs nutrition-history-data-tabs"
          role="tablist"
          aria-label="Dato mostrado en la gráfica"
        >
          <button
            role="tab"
            aria-selected={historyChart === "calories"}
            className={historyChart === "calories" ? "active" : ""}
            onClick={() => setHistoryChart("calories")}
          >
            Calorías
          </button>
          <button
            role="tab"
            aria-selected={historyChart === "macros"}
            className={historyChart === "macros" ? "active" : ""}
            onClick={() => setHistoryChart("macros")}
          >
            Macronutrientes
          </button>
        </div>
        <div className="nutrition-history-summary">
          {metricKeys.map((key) => (
            <div className={`nutrition-history-stat ${key}`} key={key}>
              <span>{metrics[key]}</span>
              <strong>
                {historyRecorded.length ? fmt(historyAverage[key]) : "—"}
                <small>{key === "calories" ? " kcal" : " g"}</small>
              </strong>
              <em>media</em>
            </div>
          ))}
        </div>
        <div className="nutrition-history-legend" aria-label="Leyenda">
          {historyChart === "calories" ? (
            <>
              <span className="calories">Calorías</span>
              <i>La línea marca tu objetivo diario</i>
            </>
          ) : (
            <>
              <span className="protein">Proteína</span>
              <span className="carbs">Hidratos</span>
              <span className="fat">Grasas</span>
              <i>Las barras muestran el reparto energético</i>
            </>
          )}
        </div>
        <p>
          {historyRecorded.length}/{history.length} periodos con registros.
          Las medias excluyen periodos sin datos.
        </p>
        {historyChart === "calories" ? (
          <div
            className="nutrition-chart nutrition-period-chart"
            aria-label="Evolución de calorías medias diarias"
          >
            {history.map((item) => {
              const calories = item.macros?.calories ?? null;
              const delta =
                goals && calories !== null
                  ? calories - goals.calories
                  : null;
              return (
                <div
                  key={item.start}
                  title={
                    calories === null
                      ? `${item.label}: sin registros`
                      : `${item.label}: media de ${fmt(calories)} kcal al día`
                  }
                >
                  <small>{calories === null ? "—" : fmt(calories)}</small>
                  <div className="nutrition-track">
                    {goals && (
                      <span
                        className="nutrition-target"
                        style={{
                          bottom: `${(goals.calories / historyChartMax) * 100}%`,
                        }}
                      />
                    )}
                    {calories !== null && (
                      <i
                        style={{
                          height: `${(calories / historyChartMax) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                  {delta !== null && (
                    <em
                      className={
                        delta <= 0
                          ? "nutrition-deficit"
                          : "nutrition-surplus"
                      }
                    >
                      {delta <= 0
                        ? `−${fmt(Math.abs(delta))}`
                        : `+${fmt(delta)}`} {" "}
                      kcal/día
                    </em>
                  )}
                  <small>{item.label}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="nutrition-history-chart macros"
            aria-label="Evolución de distribución de macronutrientes"
          >
            {history.map((item) => {
              const distribution = item.macros
                ? macroEnergyPercentages(item.macros)
                : null;
              return (
                <div
                  key={item.start}
                  title={
                    item.macros === null
                      ? `${item.label}: sin registros`
                      : `${item.label}: ${metricKeys.map((key) => `${metrics[key]} ${fmt(item.macros?.[key] ?? 0)}${key === "calories" ? " kcal" : " g"}`).join(" · ")}`
                  }
                >
                  <div className="nutrition-history-track">
                    {distribution &&
                      macroStackOrder.map((key, index) => (
                        <i
                          className={key}
                          key={key}
                          style={{
                            height: `${distribution[key]}%`,
                            bottom: `${macroStackOrder.slice(0, index).reduce((sum, previous) => sum + distribution[previous], 0)}%`,
                          }}
                        />
                      ))}
                  </div>
                  <small>{item.label}</small>
                </div>
              );
            })}
            {idealMacroDistribution && <div className="nutrition-history-ideal" aria-label="Reparto ideal de macronutrientes"><span>Ideal</span><div className="nutrition-history-track">{macroStackOrder.map((key, index) => <i className={key} key={key} style={{ height: `${idealMacroDistribution[key]}%`, bottom: `${macroStackOrder.slice(0,index).reduce((sum, previous) => sum + idealMacroDistribution[previous], 0)}%` }} />)}</div><small>Objetivo</small></div>}
          </div>
        )}
      </article>
      {periodConclusion && (
        <article className="panel nutrition-period-conclusion">
          <p className="eyebrow">CONCLUSIÓN DEL PERÍODO</p>
          <h2>
            {historyPeriod === "weeks"
              ? "Cómo va tu semana"
              : "Cómo va tu mes"}
          </h2>
          <p>{periodConclusion.balance}</p>
          <p>{periodConclusion.protein}</p>
          <small>
            Conclusión basada en {historyRecorded.length} períodos con
            comidas registradas; no se imputan consumos a los días sin
            datos.
          </small>
        </article>
      )}
      {goals && historyRecorded.length > 0 && (
        <article
          className={`panel nutrition-history-balance ${historyCalorieDelta <= 0 ? "deficit" : "surplus"}`}
        >
          <p className="eyebrow">BALANCE DEL PERÍODO SELECCIONADO</p>
          <h2>
            {historyCalorieDelta <= 0
              ? "Déficit calórico"
              : "Exceso calórico"}
          </h2>
          <strong>
            {historyCalorieDelta <= 0 ? "−" : "+"}
            {fmt(Math.abs(historyCalorieDelta))} <small>kcal</small>
          </strong>
          <p>
            {historyPeriod === "weeks"
              ? "Suma de las semanas mostradas"
              : "Suma de los meses mostrados"}
            . Solo cuenta períodos con comidas registradas.
          </p>
        </article>
      )}
    </>
  );
}
