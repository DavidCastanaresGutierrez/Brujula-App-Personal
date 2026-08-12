import type { Dispatch, SetStateAction } from "react";
import type { Category } from "../../lib/domain/tracker-state";
import type { WeeklyCategorySummary, WeeklyReview } from "../../lib/domain/weekly-review";
import { shiftWeekBounds } from "../../lib/domain/weekly-review";

type WeekBounds = { start: Date; end: Date; key: string };
type WeeklyPlanDraft = { priorities: string[]; adjustment: string; reflection: string };
type WeeklySummary = { score: number; completed: number; scheduled: number; categories: WeeklyCategorySummary[] };

type Props = {
  currentWeek: WeekBounds;
  previousWeek: WeekBounds;
  reviewWeek: WeekBounds;
  reviewWeekKey: string;
  reviewSummary: WeeklySummary;
  selectedWeeklyReview?: WeeklyReview;
  reviewCompletedGoals: number;
  reviewGoalCount: number;
  weakestWeeklyCategory?: WeeklyCategorySummary;
  categories: Category[];
  weeklyPlanDraft: WeeklyPlanDraft;
  setWeeklyPlanDraft: Dispatch<SetStateAction<WeeklyPlanDraft>>;
  weeklyPlanSaved: boolean;
  onSaveWeeklyPlan: () => void;
  onReviewWeekChange: (weekKey: string) => void;
};

const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function WeeklyPlanningView({ currentWeek, previousWeek, reviewWeek, reviewWeekKey, reviewSummary, selectedWeeklyReview, reviewCompletedGoals, reviewGoalCount, weakestWeeklyCategory, categories, weeklyPlanDraft, setWeeklyPlanDraft, weeklyPlanSaved, onSaveWeeklyPlan, onReviewWeekChange }: Props) {
  return <>
    <section className="view-intro"><p className="eyebrow">PLANIFICAR · EJECUTAR · REAJUSTAR</p><h1>Tu semana</h1><p>Decide qué importa y convierte los datos de la semana anterior en una mejora concreta.</p></section>
    <section className="weekly-review-grid">
      <article className="panel weekly-plan-card">
        <div className="panel-head"><div><p className="eyebrow">SEMANA ACTUAL</p><h2>Del {currentWeek.start.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} al {currentWeek.end.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</h2></div><span className="weekly-step">01</span></div>
        <p className="weekly-guidance">Elige como máximo tres resultados que justifiquen tu atención. Si todo es prioridad, nada lo es.</p>
        <div className="weekly-priorities">
          {weeklyPlanDraft.priorities.map((priority, index) => <label key={index}><span>Prioridad {index + 1}</span><input maxLength={160} value={priority} placeholder={index === 0 ? "Lo más importante de esta semana" : "Opcional"} onChange={(event) => setWeeklyPlanDraft((draft) => ({ ...draft, priorities: draft.priorities.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /></label>)}
        </div>
        <label className="weekly-text-field"><span>Ajuste del sistema</span><textarea maxLength={500} value={weeklyPlanDraft.adjustment} placeholder="¿Qué vas a cambiar para que esta semana funcione mejor?" onChange={(event) => setWeeklyPlanDraft((draft) => ({ ...draft, adjustment: event.target.value }))} /></label>
        <label className="weekly-text-field"><span>Reflexión en curso</span><textarea maxLength={1500} value={weeklyPlanDraft.reflection} placeholder="Anota contexto, decisiones o aprendizajes mientras avanza la semana." onChange={(event) => setWeeklyPlanDraft((draft) => ({ ...draft, reflection: event.target.value }))} /></label>
        <button className="add-button weekly-save" onClick={onSaveWeeklyPlan}>{weeklyPlanSaved ? "Guardado ✓" : "Guardar planificación"}</button>
      </article>

      <article className="panel weekly-review-card">
        <div className="panel-head weekly-review-head"><div><p className="eyebrow">HISTORIAL SEMANAL</p><h2>Del {reviewWeek.start.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} al {reviewWeek.end.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</h2></div><span className="weekly-step">02</span></div>
        <div className="week-history-nav" aria-label="Navegar por revisiones semanales"><button onClick={() => onReviewWeekChange(shiftWeekBounds(reviewWeekKey, -1).key)} aria-label="Semana anterior">← Anterior</button><span>{selectedWeeklyReview ? "Reflexión guardada" : "Sin reflexión guardada"}</span><button onClick={() => onReviewWeekChange(shiftWeekBounds(reviewWeekKey, 1).key)} disabled={reviewWeek.key >= previousWeek.key} aria-label="Semana siguiente">Siguiente →</button></div>
        <div className="weekly-score-row"><div><span>Nota semanal</span><strong>{scoreLabel(reviewSummary.score)}<small> / 10</small></strong></div><div><span>Hábitos</span><strong>{reviewSummary.completed}<small> / {reviewSummary.scheduled}</small></strong></div><div><span>Objetivos</span><strong>{reviewCompletedGoals}<small> / {reviewGoalCount}</small></strong></div></div>
        <div className="weekly-blocks"><h3>Balance por bloques</h3>{reviewSummary.categories.map((summary) => { const category = categories.find((item) => item.id === summary.categoryId); return <div className="weekly-block-row" key={summary.categoryId}><span><i style={{ background: category?.color }} />{category?.label ?? "Sin bloque"}</span><div><i style={{ width: `${summary.percent}%`, background: category?.color }} /></div><strong>{Math.round(summary.percent)}%</strong></div>; })}{!reviewSummary.categories.length && <p className="today-empty">No hay datos programados para esta semana.</p>}</div>
        <div className="weekly-signal"><span>SEÑAL A REVISAR</span><strong>{weakestWeeklyCategory ? `${categories.find((item) => item.id === weakestWeeklyCategory.categoryId)?.label ?? "Un bloque"} quedó en ${Math.round(weakestWeeklyCategory.percent)}%.` : "Aún no hay datos suficientes."}</strong><p>{weakestWeeklyCategory && weakestWeeklyCategory.percent < 60 ? "No añadas más carga: reduce fricción o reajusta la programación." : "Mantén el sistema estable antes de aumentar la exigencia."}</p></div>
        <div className="weekly-reflection"><span>Reflexión registrada</span><p>{selectedWeeklyReview?.reflection || "No dejaste una reflexión para esta semana."}</p>{selectedWeeklyReview?.adjustment && <small>Ajuste decidido: {selectedWeeklyReview.adjustment}</small>}{selectedWeeklyReview?.priorities.length ? <small>Prioridades: {selectedWeeklyReview.priorities.join(" · ")}</small> : null}</div>
      </article>
    </section>
  </>;
}
