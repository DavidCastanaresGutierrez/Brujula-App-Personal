import {
  detailMetrics,
  detailMetricUnits,
  metricKeys,
  metrics,
  metricStatus,
  sumDetails,
  sumMacros,
  type Entry,
  type Macros,
} from "../../../lib/domain/nutrition";
import {
  fmt,
  detailDirection,
  detailCardOrder,
  dailyNutritionTips,
  type NutritionGoals,
} from "../../../lib/domain/nutrition-analysis";

export function DailySummary({
  daily,
  goals,
}: { daily: Entry[]; goals: NutritionGoals | null }) {
  const total = sumMacros(daily);
  const detailTotal = sumDetails(daily);
  const dailyTips = dailyNutritionTips(
    total,
    detailTotal,
    goals,
    daily.length > 0,
  );
  const calorieScale = goals
    ? Math.max(goals.calories * 1.2, total.calories, 1)
    : 1;
  const macroChart = goals
    ? ([
        {
          key: "carbs",
          label: "Hidratos",
          value: total.carbs,
          goal: goals.carbs,
          color: "carbs",
        },
        {
          key: "fat",
          label: "Grasa",
          value: total.fat,
          goal: goals.fat,
          color: "fat",
        },
        {
          key: "protein",
          label: "Proteína",
          value: total.protein,
          goal: goals.protein,
          color: "protein",
        },
      ] as const)
    : [];
  const macroCalories = (macro: Pick<Macros, "carbs" | "fat" | "protein">) => ({
    carbs: macro.carbs * 4,
    fat: macro.fat * 9,
    protein: macro.protein * 4,
  });
  const macroDistribution = (() => {
    if (!goals) return [];
    const actualCalories = macroCalories(total),
      recommendedCalories = macroCalories(goals);
    const actualTotal = Object.values(actualCalories).reduce(
      (sum, value) => sum + value,
      0,
    );
    const recommendedTotal = Object.values(recommendedCalories).reduce(
      (sum, value) => sum + value,
      0,
    );
    return macroChart.map((macro) => ({
      ...macro,
      actualPercent: actualTotal
        ? (actualCalories[macro.key] / actualTotal) * 100
        : 0,
      recommendedPercent: recommendedTotal
        ? (recommendedCalories[macro.key] / recommendedTotal) * 100
        : 0,
    }));
  })();
  const detailChart = goals
    ? detailCardOrder.map((key) => ({
        key,
        label: detailMetrics[key],
        value: detailTotal[key],
        target: goals[key],
        direction: detailDirection[key] ?? "maximum",
        color: key,
        unit: detailMetricUnits[key],
        note:
          detailDirection[key] === "minimum"
            ? "mínimo diario"
            : "máximo diario",
      }))
    : [];
  return (
    <>
      <article
        className="panel nutrition-tips"
        aria-label="Consejos nutricionales del día"
      >
        <div>
          <p className="eyebrow">PÍLDORAS DEL DÍA</p>
          <h2>Tu brújula nutricional</h2>
        </div>
        <div className="nutrition-tip-pills">
          {dailyTips.map((tip) => (
            <div className={tip.tone} key={tip.title}>
              <b>{tip.title}</b>
              <span>{tip.detail}</span>
              <small>{tip.fact}</small>
            </div>
          ))}
        </div>
      </article>
      <div className="nutrition-grid">
        {metricKeys.map((key) => {
          const target = goals?.[key];
          const unit = key === "calories" ? "kcal" : "g";
          const state = target
            ? metricStatus(key, total[key], target)
            : "below";
          return (
            <article
              className={`panel nutrition-metric ${state}`}
              key={key}
            >
              <h3>{metrics[key]}</h3>
              <strong>
                {fmt(total[key])}{" "}
                <small>
                  / {target ? fmt(target) : "—"} {unit}
                </small>
              </strong>
              {target && (
                <progress
                  aria-label={`${metrics[key]} consumidas respecto al objetivo`}
                  value={Math.min(total[key], target)}
                  max={target}
                />
              )}
            </article>
          );
        })}
      </div>
      {goals && (
        <>
          <div className="nutrition-visuals">
            <article className="panel nutrition-calorie-card">
              <div>
                <p className="eyebrow">CALORÍAS</p>
                <strong>{fmt(total.calories)}</strong>
                <span>kcal</span>
              </div>
              <div className="nutrition-calorie-target">
                <span>Objetivo diario</span>
                <strong>{fmt(goals.calories)} kcal</strong>
              </div>
              <div
                className="nutrition-calorie-progress"
                aria-label={`${fmt(total.calories)} de ${fmt(goals.calories)} kcal`}
              >
                <i
                  style={{
                    width: `${Math.min((total.calories / calorieScale) * 100, 100)}%`,
                  }}
                />
                <b
                  style={{
                    left: `${(goals.calories / calorieScale) * 100}%`,
                  }}
                />
              </div>
              <div className="nutrition-calorie-scale">
                <span>0</span>
                <span>{fmt(Math.ceil(calorieScale / 10) * 10)} kcal</span>
              </div>
              <p>
                {total.calories < goals.calories
                  ? `Te quedan ${fmt(goals.calories - total.calories)} kcal para el objetivo.`
                  : `Vas ${fmt(total.calories - goals.calories)} kcal por encima del objetivo.`}
              </p>
            </article>
            <article className="panel nutrition-macro-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">INFO NUTRICIONAL</p>
                  <h2>Real frente a recomendado</h2>
                </div>
              </div>
              <div className="nutrition-macro-values">
                {macroDistribution.map((macro) => (
                  <div className={macro.color} key={macro.key}>
                    <span>{macro.label}</span>
                    <strong>
                      {fmt(macro.value)}
                      <small> g</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div
                className="nutrition-macro-distribution"
                aria-label="Comparación de distribución de macronutrientes real y recomendada"
              >
                <span>Real</span>
                <div className="nutrition-macro-percentages">
                  {macroDistribution.map((macro) => (
                    <strong className={macro.color} key={macro.key}>
                      {fmt(macro.actualPercent)}%
                    </strong>
                  ))}
                </div>
                <div className="nutrition-macro-bar">
                  {macroDistribution.map((macro) => (
                    <i
                      className={macro.color}
                      key={macro.key}
                      style={{ width: `${macro.actualPercent}%` }}
                    />
                  ))}
                </div>
                <div className="nutrition-macro-percentages recommended">
                  {macroDistribution.map((macro) => (
                    <strong className={macro.color} key={macro.key}>
                      {fmt(macro.recommendedPercent)}%
                    </strong>
                  ))}
                </div>
                <div className="nutrition-macro-bar target">
                  {macroDistribution.map((macro) => (
                    <i
                      className={macro.color}
                      key={macro.key}
                      style={{ width: `${macro.recommendedPercent}%` }}
                    />
                  ))}
                </div>
                <span>Recomendados</span>
              </div>
            </article>
          </div>
          <details className="panel nutrition-quality-card">
            <summary>
              <div>
                <p className="eyebrow">MÁS DETALLE</p>
                <h2>Micronutrientes y límites diarios</h2>
                <p>Azúcares, grasas, fibra, vitaminas y minerales.</p>
              </div>
              <span aria-hidden="true">⌄</span>
            </summary>
            <p className="nutrition-color-key">
              Violeta: hidratos · Rosa: grasas · Amarillo: límite de sodio ·
              Verde: fibra, vitaminas y minerales.
            </p>
            <div className="nutrition-quality-grid">
              {detailChart.map((item) => {
                const isAbove =
                  item.direction === "maximum" && item.value > item.target;
                const isBelow =
                  item.direction === "minimum" && item.value < item.target;
                const state = isAbove
                  ? "above"
                  : isBelow
                    ? "below"
                    : "within";
                return (
                  <div
                    className={`nutrition-quality-item ${item.color} ${state}`}
                    key={item.key}
                    title={item.note}
                  >
                    <div>
                      <span>{item.label}</span>
                      <strong>
                        {fmt(item.value)}{" "}
                        <small>
                          / {fmt(item.target)} {item.unit}
                        </small>
                      </strong>
                    </div>
                    <progress
                      aria-label={`${item.label}: ${fmt(item.value)} de ${fmt(item.target)} ${item.unit}; ${item.note}`}
                      value={Math.min(item.value, item.target)}
                      max={item.target || 1}
                    />
                  </div>
                );
              })}
            </div>
            <small className="nutrition-quality-note">
              Los objetivos son referencias editables. Azúcares: la
              referencia es para azúcares libres.
            </small>
          </details>
        </>
      )}
    </>
  );
}
