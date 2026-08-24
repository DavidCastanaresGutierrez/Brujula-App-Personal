import type { Dispatch, PointerEvent, SetStateAction } from "react";
import type { BookEntry, Category, Goal, GoalStep } from "../../lib/domain/tracker-state";
import { FitnessChart, fitnessMetricMeta, type FitnessMetric } from "./charts";

type GoalStepDraft = { kind: GoalStep["kind"]; title: string; dueDate: string };

type GoalCardProps = {
  goal: Goal;
  category?: Category;
  allGoals: Goal[];
  todayKey: string;
  canReorder: boolean;
  dragging: boolean;
  planning: boolean;
  stepDraft: GoalStepDraft;
  setStepDraft: Dispatch<SetStateAction<GoalStepDraft>>;
  progressDraft: string;
  setProgressDraft: (value: string) => void;
  fitnessMetric: FitnessMetric;
  setFitnessMetric: (metric: FitnessMetric) => void;
  fitnessPeriod: 30 | 90 | 365;
  setFitnessPeriod: (period: 30 | 90 | 365) => void;
  isBookCompleted: (book: BookEntry) => boolean;
  yearlyHabitPercent: (habitId?: number) => number;
  onDragStart: (event: PointerEvent<HTMLButtonElement>, id: number) => void;
  onDragMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: PointerEvent<HTMLButtonElement>, id: number) => void;
  onDragCancel: () => void;
  onArchive: (id: number) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onToggleStep: (goalId: number, stepId: number) => void;
  onRemoveStep: (goalId: number, stepId: number) => void;
  onAddStep: (goal: Goal) => void;
  onBeginPlanning: (goal: Goal) => void;
  onCancelPlanning: () => void;
  onOpenBook: (goal: Goal, book?: BookEntry, status?: "reading" | "completed") => void;
  onCompleteBook: (goalId: number, bookId: number) => void;
  onRemoveBook: (goalId: number, bookId: number) => void;
  onOpenFitness: (goal: Goal) => void;
  onMoveWeekly: (id: number) => void;
  onUpdateProgress: (goal: Goal, value: number) => void;
  onAddProgress: (goal: Goal) => void;
};

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

export function GoalCard(props: GoalCardProps) {
  const { goal, category, allGoals } = props;
  const progress = Math.min(100, Math.round(goal.currentValue / Math.max(1, goal.targetValue) * 100));
  const parentAnnualGoal = goal.parentAnnualGoalId ? allGoals.find((item) => item.id === goal.parentAnnualGoalId) : undefined;
  const linkedMilestones = goal.period === "yearly"
    ? allGoals.filter((item) => (item.period === "weekly" || item.period === "monthly") && item.parentAnnualGoalId === goal.id && item.status !== "discarded")
    : [];
  const visibleMilestones = linkedMilestones.filter((item) => !item.archived);
  const archivedMilestones = linkedMilestones.length - visibleMilestones.length;
  const isOverdueWeekly = goal.period === "weekly" && goal.status === "active" && goal.dueDate < props.todayKey;

  return <article data-goal-id={goal.id} className={`goal-card ${props.dragging ? "is-dragging" : ""}`} style={{ "--goal-color": category?.color ?? "#39c6a4" } as React.CSSProperties}>
    <div className="goal-card-head"><span>{category?.icon} {category?.label}</span><div className="goal-card-actions">
      <button type="button" className="goal-drag-handle" disabled={!props.canReorder} onPointerDown={(event) => props.onDragStart(event, goal.id)} onPointerMove={props.onDragMove} onPointerUp={(event) => props.onDragEnd(event, goal.id)} onPointerCancel={props.onDragCancel} aria-label={`Arrastrar ${goal.title} para reordenar`} title={props.canReorder ? "Arrastrar para reordenar" : "Quita el filtro para reordenar"}>⠿</button>
      {goal.status === "completed" && <button className="goal-archive" onClick={() => props.onArchive(goal.id)} aria-label={`Archivar ${goal.title}`} title="Archivar objetivo completado">▣</button>}
      <button onClick={() => props.onEdit(goal)} aria-label={`Editar ${goal.title}`}>✎</button>
      <button onClick={() => props.onDelete(goal)} aria-label={`Borrar ${goal.title}`}>×</button>
    </div></div>
    <h3>{goal.title}</h3>
    {isOverdueWeekly && <small className="goal-overdue-label">Pendiente de la semana anterior</small>}
    {parentAnnualGoal && <small className="goal-parent-link">Hito de: {parentAnnualGoal.title}</small>}
    <div className="goal-progress"><i style={{ width: `${progress}%` }} /></div>
    <div className="goal-card-foot"><strong>{goal.currentValue} / {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ""}</strong><span>{progress}% · hasta {shortDate(goal.dueDate)}</span></div>
    {linkedMilestones.length > 0 && <div className="goal-milestones"><strong>{linkedMilestones.filter((item) => item.status === "completed").length} de {linkedMilestones.length} objetivos vinculados</strong>{visibleMilestones.map((item) => <span key={item.id} className={item.status === "completed" ? "done" : ""}>{item.status === "completed" ? "✓" : "○"} {item.title}</span>)}{archivedMilestones > 0 && <small>{archivedMilestones} {archivedMilestones === 1 ? "hito archivado incluido" : "hitos archivados incluidos"}</small>}</div>}
    {(goal.steps ?? []).length > 0 && <div className="goal-plan"><div className="goal-plan-summary"><strong>Plan</strong><span>{(goal.steps ?? []).filter((step) => step.completed).length}/{(goal.steps ?? []).length}</span></div>{(goal.steps ?? []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((step) => <div className={`goal-step ${step.completed ? "done" : ""}`} key={step.id}><button className="goal-step-toggle" onClick={() => props.onToggleStep(goal.id, step.id)} aria-label={`${step.completed ? "Reabrir" : "Completar"} ${step.title}`}>{step.completed ? "✓" : "○"}</button><span><strong>{step.title}</strong><small>{step.kind === "milestone" ? "Hito" : "Acción"} · {shortDate(step.dueDate)}</small></span><button className="goal-step-delete" onClick={() => props.onRemoveStep(goal.id, step.id)} aria-label={`Eliminar ${step.title}`}>×</button></div>)}</div>}
    {props.planning ? <form className="goal-step-form" onSubmit={(event) => { event.preventDefault(); props.onAddStep(goal); }}><select value={props.stepDraft.kind} onChange={(event) => props.setStepDraft((draft) => ({ ...draft, kind: event.target.value as GoalStep["kind"] }))}><option value="action">Acción</option><option value="milestone">Hito</option></select><input maxLength={160} value={props.stepDraft.title} onChange={(event) => props.setStepDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Qué hay que conseguir" aria-label="Título del paso" /><input type="date" value={props.stepDraft.dueDate} onChange={(event) => props.setStepDraft((draft) => ({ ...draft, dueDate: event.target.value }))} aria-label="Fecha del paso" /><div><button type="button" onClick={props.onCancelPlanning}>Cancelar</button><button type="submit" disabled={!props.stepDraft.title.trim() || !props.stepDraft.dueDate}>Añadir</button></div></form> : <button className="goal-add-step" onClick={() => props.onBeginPlanning(goal)}>+ Añadir hito o acción</button>}
    {goal.template === "reading" ? <><div className="book-add-actions"><button className="goal-complete" onClick={() => props.onOpenBook(goal)}>+ Libro en proceso</button><button className="goal-complete" onClick={() => props.onOpenBook(goal, undefined, "completed")}>+ Libro terminado</button></div><div className="goal-entry-list">{(goal.books ?? []).slice().reverse().map((book) => <div className="book-entry" key={book.id}><span><strong>{book.title}</strong><small>{book.author || "Autor no indicado"} · {{ audio: "Audiolibro", digital: "Electrónico", paper: "Papel" }[book.format]}</small></span><span className="book-entry-actions">{!props.isBookCompleted(book) && <button onClick={() => props.onCompleteBook(goal.id, book.id)}>Terminar</button>}<button onClick={() => props.onOpenBook(goal, book)} aria-label={`Editar ${book.title}`}>Editar</button><button className="danger" onClick={() => props.onRemoveBook(goal.id, book.id)} aria-label={`Eliminar ${book.title}`}>×</button></span></div>)}</div><small className="goal-consistency">{(goal.books ?? []).filter((book) => !props.isBookCompleted(book)).length} en proceso · {(goal.books ?? []).filter(props.isBookCompleted).length} terminados · Constancia: {goal.linkedHabitId ? `${props.yearlyHabitPercent(goal.linkedHabitId)}%` : "sin hábito vinculado"}</small></>
      : goal.template === "fitness" ? <><small className="goal-consistency">{(goal.linkedHabitIds ?? []).length ? `${(goal.linkedHabitIds ?? []).length} hábitos · cada uno pondera ${(100 / (goal.linkedHabitIds ?? []).length).toFixed(2)}% al día` : "Sin hábitos vinculados"}</small><button className="goal-complete" onClick={() => props.onOpenFitness(goal)}>+ Actualizar métricas</button><div className="fitness-chart-controls"><select value={props.fitnessMetric} onChange={(event) => props.setFitnessMetric(event.target.value as FitnessMetric)}>{Object.entries(fitnessMetricMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select><div className="tabs">{([30, 90, 365] as const).map((period) => <button key={period} className={props.fitnessPeriod === period ? "active" : ""} onClick={() => props.setFitnessPeriod(period)}>{period === 30 ? "30 días" : period === 90 ? "3 meses" : "1 año"}</button>)}</div></div><FitnessChart entries={goal.fitnessEntries ?? []} metric={props.fitnessMetric} period={props.fitnessPeriod} /></>
      : isOverdueWeekly ? <div className="goal-weekly-actions"><button onClick={() => props.onMoveWeekly(goal.id)}>Mover a esta semana</button><button className="danger" onClick={() => props.onDelete(goal)}>Eliminar</button></div>
      : goal.measurement === "complete" ? <button className="goal-complete" onClick={() => props.onUpdateProgress(goal, goal.currentValue >= 1 ? 0 : 1)}>{goal.currentValue >= 1 ? "Reabrir" : "Marcar completado"}</button>
      : <form className="goal-value" onSubmit={(event) => { event.preventDefault(); props.onAddProgress(goal); }}><label htmlFor={`goal-progress-${goal.id}`}>Añadir progreso</label><div className="goal-value-entry"><input id={`goal-progress-${goal.id}`} type="number" min="0" max={Math.max(0, goal.targetValue - goal.currentValue)} step="any" inputMode="decimal" value={props.progressDraft} onChange={(event) => props.setProgressDraft(event.target.value)} placeholder={goal.unit ? `Cantidad en ${goal.unit}` : "Cantidad"} aria-label={`Cantidad que añadir a ${goal.title}`} /><button type="submit" disabled={!Number.isFinite(Number(props.progressDraft)) || Number(props.progressDraft) <= 0 || goal.currentValue >= goal.targetValue}>Sumar</button></div></form>}
  </article>;
}
