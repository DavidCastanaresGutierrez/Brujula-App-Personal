import { useState } from "react";
import {
  type BodyComposition,
} from "../../../lib/domain/nutrition";
import {
  fmt,
  bodyMetricOrder,
  bodyMetricMeta,
  bodyMetricValue,
  bodyWeeklyBuckets,
  type BodyMetric,
} from "../../../lib/domain/nutrition-analysis";

export function BodyCompositionPanel({
  bodyEntries,
  busy,
  onImport,
  onAdd,
}: {
  bodyEntries: BodyComposition[];
  busy: boolean;
  onImport: () => void;
  onAdd: () => void;
}) {
  const [bodyMetric, setBodyMetric] = useState<BodyMetric>("body_score");
    const bodyWeeks = bodyWeeklyBuckets(bodyEntries);
    const bodyValues = bodyWeeks.map((week) =>
      week.measurement
        ? bodyMetricValue(week.measurement, bodyMetric)
        : null,
    );
    const populatedBodyValues = bodyValues.filter(
      (value): value is number => value !== null,
    );
    const bodyMin = Math.min(...populatedBodyValues, 0),
      bodyMax = Math.max(...populatedBodyValues, 1),
      bodyRange = Math.max(bodyMax - bodyMin, bodyMetric === "body_fat" ? 1 : 2);
    const bodyPoints = bodyValues
      .map((value, index) =>
        value === null
          ? null
          : `${(index / (bodyWeeks.length - 1)) * 100},${100 - ((value - (bodyMin - bodyRange * 0.12)) / (bodyRange * 1.24)) * 100}`,
      )
      .filter((value): value is string => value !== null)
      .join(" ");
  return (
    <article className="panel nutrition-body">
      <div className="panel-head">
        <div>
          <p className="eyebrow">COMPOSICIÓN CORPORAL</p>
          <h2>Tu evolución semanal</h2>
        </div>
        <div className="nutrition-actions">
          <button disabled={busy} onClick={onImport}>
            Importar JSON
          </button>
          <button
            disabled={busy}
            onClick={onAdd}
          >
            + Añadir medición
          </button>
        </div>
      </div>
      {!bodyEntries.length ? (
        <p>
          Añade una medición para generar objetivos diarios y ver tu
          evolución.
        </p>
      ) : (
        <>
          <div className="nutrition-body-summary">
            {bodyMetricOrder.map((key) => {
              const latest = bodyEntries.at(-1)!;
              const value = bodyMetricValue(latest, key);
              return (
                <div key={key}>
                  <span>{bodyMetricMeta[key].label}</span>
                  <strong>
                    {value === null
                      ? "—"
                      : `${fmt(value)} ${bodyMetricMeta[key].unit}`}
                  </strong>
                </div>
              );
            })}
          </div>
          <div
            className="nutrition-history-tabs nutrition-body-tabs"
            role="tablist"
            aria-label="Métrica de composición corporal"
          >
            {bodyMetricOrder.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={bodyMetric === key}
                className={bodyMetric === key ? `active ${key}` : ""}
                onClick={() => setBodyMetric(key)}
              >
                {bodyMetricMeta[key].label}
              </button>
            ))}
          </div>
          <div
            className={`nutrition-body-trend ${bodyMetric}`}
            aria-label={`Evolución semanal de ${bodyMetricMeta[bodyMetric].label}`}
          >
            <div className="nutrition-body-scale">
              <span>
                {fmt(bodyMax)} {bodyMetricMeta[bodyMetric].unit}
              </span>
              <span>
                {fmt(bodyMin)} {bodyMetricMeta[bodyMetric].unit}
              </span>
            </div>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line x1="0" y1="50" x2="100" y2="50" />
              <polyline points={bodyPoints} />
            </svg>
            {bodyWeeks.map((week, index) => (
              <div
                key={week.start}
                className="nutrition-body-week"
                title={
                  week.measurement
                    ? `${week.label}: ${fmt(bodyValues[index] ?? 0)} ${bodyMetricMeta[bodyMetric].unit}`
                    : `${week.label}: sin medición`
                }
              >
                <i
                  className={bodyValues[index] === null ? "empty" : ""}
                  style={
                    bodyValues[index] === null
                      ? undefined
                      : {
                          top: `${100 - ((bodyValues[index]! - (bodyMin - bodyRange * 0.12)) / (bodyRange * 1.24)) * 100}%`,
                        }
                  }
                />
                <small>{week.label}</small>
              </div>
            ))}
          </div>
          <small>
            {bodyMetric === "body_score"
              ? "La nota usa todos los valores: IMC, grasa, masa grasa y libre de grasa, IMME, agua, metabolismo y masa músculo-esquelética. Las mediciones incompletas no se puntúan."
              : "Se muestra la última medición de cada semana; las semanas sin medición no se estiman."}
          </small>
        </>
      )}
    </article>
  );
}
