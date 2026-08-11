import type { CSSProperties } from "react";

export type FitnessMetric = "weight" | "muscle" | "fatMass" | "bodyWater" | "bodyFat" | "bmi" | "basalMetabolicRate";
export type FitnessEntry = { id: number; recordedAt: string; weight: number; muscle: number; fatMass: number; bodyWater: number; bodyFat: number; bmi: number; basalMetabolicRate: number };
export type ChartSeries = { name: string; color: string; data: { label: string; value: number }[] };

export const fitnessMetricMeta: Record<FitnessMetric, { label: string; unit: string }> = {
  weight: { label: "Peso", unit: "kg" }, muscle: { label: "Masa muscular", unit: "kg" }, fatMass: { label: "Masa grasa", unit: "kg" }, bodyWater: { label: "Agua corporal", unit: "kg" }, bodyFat: { label: "Grasa corporal", unit: "%" }, bmi: { label: "IMC", unit: "" }, basalMetabolicRate: { label: "Tasa metabólica basal", unit: "kcal/día" },
};

export function fitnessChartModel(entries: FitnessEntry[], metric: FitnessMetric, period: number, now = new Date()) {
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - period);
  const points = entries.filter((entry) => new Date(`${entry.recordedAt}T12:00:00`) >= cutoff && Number.isFinite(entry[metric])).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const values = points.map((entry) => entry[metric]);
  const min = points.length ? Math.min(...values) : 0;
  const max = points.length ? Math.max(...values) : 0;
  return { points, values, min, span: Math.max(1, max - min), change: points.length ? values.at(-1)! - values[0] : 0 };
}

export function clampProgress(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function FitnessChart({ entries, metric, period }: { entries: FitnessEntry[]; metric: FitnessMetric; period: number }) {
  const { points, values, min, span, change } = fitnessChartModel(entries, metric, period);
  if (!points.length) return <p className="fitness-chart-empty">Añade mediciones para ver tu evolución.</p>;
  const coords = points.map((entry, index) => ({ x: points.length === 1 ? 50 : 6 + index * 88 / (points.length - 1), y: 82 - (entry[metric] - min) / span * 64, entry }));
  const meta = fitnessMetricMeta[metric];
  return <div className="fitness-chart"><div className="fitness-chart-summary"><span>Última <b>{values.at(-1)} {meta.unit}</b></span><span>Registros <b>{points.length}</b></span><span>Variación <b className={change <= 0 ? "positive" : ""}>{change > 0 ? "+" : ""}{change.toFixed(1)} {meta.unit}</b></span></div><svg viewBox="0 0 100 92" role="img" aria-label={`Evolución de ${meta.label}`} preserveAspectRatio="none"><path className="fitness-area" d={`M ${coords.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${coords.at(-1)!.x} 88 L ${coords[0].x} 88 Z`} /><polyline points={coords.map((p) => `${p.x},${p.y}`).join(" ")} /><g>{coords.map((p) => <circle key={p.entry.id} cx={p.x} cy={p.y} r="1.7"><title>{p.entry.recordedAt}: {p.entry[metric]} {meta.unit}</title></circle>)}</g></svg><div className="fitness-chart-dates"><span>{points[0].recordedAt}</span><span>{points.at(-1)!.recordedAt}</span></div></div>;
}

export function Ring({ value }: { value: number }) {
  const safe = clampProgress(value);
  return <div className="ring" style={{ "--progress": `${safe * 3.6}deg` } as CSSProperties}><div><strong>{Math.round(safe)}%</strong><span>completado</span></div></div>;
}

export function TrendChart({ series }: { series: ChartSeries[] }) {
  const plotted = series.map((item) => ({ ...item, points: item.data.map((point, index) => ({ ...point, x: item.data.length <= 1 ? 60 : 60 + index * (900 / (item.data.length - 1)), y: 220 - Math.min(100, Math.max(0, point.value)) * 1.8 })) }));
  const labels = series[0]?.data ?? []; const labelStep = labels.length > 16 ? 3 : 1;
  return <div className="trend-chart">{series.length > 1 && <div className="chart-legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>}<svg viewBox="0 0 1000 260" role="img" aria-label="Evolución del porcentaje de cumplimiento">{[0, 25, 50, 75, 100].map((tick) => { const y = 220 - tick * 1.8; return <g key={tick}><line x1="60" y1={y} x2="960" y2={y} className="chart-grid" /><text x="49" y={y + 4} textAnchor="end" className="chart-y-label">{tick}%</text></g>; })}{plotted.map((item) => <g key={item.name}><polyline points={item.points.map((point) => `${point.x},${point.y}`).join(" ")} className="trend-line" style={{ stroke: item.color }} />{item.points.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r={series.length > 1 ? 3 : 4} className="trend-point" style={{ stroke: item.color }}><title>{`${item.name} · ${point.label}: ${Math.round(point.value)}%`}</title></circle>)}</g>)}{labels.map((point, index) => index % labelStep === 0 && <text key={`${point.label}-${index}`} x={labels.length <= 1 ? 60 : 60 + index * (900 / (labels.length - 1))} y="245" textAnchor="middle" className="chart-x-label">{point.label}</text>)}</svg></div>;
}
