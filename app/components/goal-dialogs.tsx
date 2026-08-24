import type { GoalPeriod } from "../../lib/domain/tracking";
import type { BookFormat, Category, Goal, Habit, HabitCategory } from "../../lib/domain/tracker-state";
import { fitnessMetricMeta, type FitnessMetric } from "./charts";

export function GoalTemplateDialog({ template, habits, selectedHabitIds, readingTarget, onReadingTargetChange, onToggleHabit, onClose, onCreate }: {
  template: "fitness" | "reading"; habits: Habit[]; selectedHabitIds: number[]; readingTarget: number;
  onReadingTargetChange: (value: number) => void; onToggleHabit: (habitId: number) => void; onClose: () => void; onCreate: () => void;
}) {
  const eligibleHabits = habits.filter((habit) => !habit.archived && (template === "fitness" ? habit.category === "health" : /leer|lectura/i.test(habit.name)));
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
    <p className="eyebrow">OBJETIVO PREDETERMINADO</p><h2>{template === "fitness" ? "Forma física" : "Lectura anual"}</h2>
    <p>{template === "fitness" ? "Vincula tus hábitos de Salud y registra la evolución de tu composición corporal." : "Registra cada libro terminado y mide por separado tu constancia diaria de lectura."}</p>
    {template === "reading" && <label>Libros que quieres leer este año<input type="number" min="1" max="200" value={readingTarget} onChange={(event) => onReadingTargetChange(Number(event.target.value))} /></label>}
    <fieldset className="habit-link-fieldset"><legend>{template === "fitness" ? "Hábitos de Salud vinculados" : "Hábito diario de lectura"}</legend>{eligibleHabits.map((habit) => <label className="habit-link-option" key={habit.id}><input type={template === "fitness" ? "checkbox" : "radio"} name="template-habit" checked={selectedHabitIds.includes(habit.id)} onChange={() => onToggleHabit(habit.id)} /><span>{habit.name}</span></label>)}</fieldset>
    <button className="add-button full" onClick={onCreate}>Crear objetivo</button>
  </div></div>;
}

export function BookEditorDialog({ editing, title, author, status, format, onTitleChange, onAuthorChange, onStatusChange, onFormatChange, onClose, onSave }: {
  editing: boolean; title: string; author: string; status: "reading" | "completed"; format: BookFormat;
  onTitleChange: (value: string) => void; onAuthorChange: (value: string) => void; onStatusChange: (value: "reading" | "completed") => void; onFormatChange: (value: BookFormat) => void; onClose: () => void; onSave: () => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">LECTURA ANUAL</p><h2>{editing ? "Editar libro" : "Registrar libro"}</h2>
    <label>Título<input autoFocus value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Título del libro" /></label>
    <label>Autor<input value={author} onChange={(event) => onAuthorChange(event.target.value)} placeholder="Autor del libro" /></label>
    <label>Estado<select value={status} onChange={(event) => onStatusChange(event.target.value as "reading" | "completed")}><option value="reading">En proceso</option><option value="completed">Terminado</option></select></label>
    <label>Formato<select value={format} onChange={(event) => onFormatChange(event.target.value as BookFormat)}><option value="paper">Papel</option><option value="digital">Electrónico</option><option value="audio">Audiolibro</option></select></label>
    <button className="add-button full" disabled={!title.trim()} onClick={onSave}>{editing ? "Guardar cambios" : "Añadir libro"}</button>
  </div></div>;
}

export function FitnessEditorDialog({ draft, importing, importMessage, onDraftChange, onImport, onClose, onSave }: {
  draft: Record<FitnessMetric, string>; importing: boolean; importMessage: string;
  onDraftChange: (metric: FitnessMetric, value: string) => void; onImport: (file?: File) => void; onClose: () => void; onSave: () => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">SAMSUNG HEALTH</p><h2>Actualizar composición corporal</h2>
    <label className="health-upload">Subir captura de Samsung Health<input type="file" accept="image/*" onChange={(event) => onImport(event.target.files?.[0])} /><span>{importing ? "Analizando…" : "Seleccionar captura"}</span></label>
    {importMessage && <p className="import-message">{importMessage}</p>}
    <div className="goal-form-row fitness-fields">{(Object.entries(fitnessMetricMeta) as [FitnessMetric, { label: string; unit: string }][]).map(([key, meta]) => <label key={key}>{meta.label}{meta.unit ? ` (${meta.unit})` : ""}<input required inputMode="decimal" value={draft[key]} onChange={(event) => onDraftChange(key, event.target.value)} /></label>)}</div>
    <p className="form-note">Revisa los valores detectados antes de guardarlos; la lectura automática puede confundirse según la captura.</p>
    <button className="add-button full" disabled={Object.values(draft).some((value) => !value.trim())} onClick={onSave}>Guardar valores</button>
  </div></div>;
}

export function DeleteGoalDialog({ goal, onClose, onDelete }: { goal: Goal; onClose: () => void; onDelete: (id: number) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal confirm-modal" role="alertdialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <p className="eyebrow">BORRAR OBJETIVO</p><h2>¿Borrar “{goal.title}”?</h2><p>También se eliminará su historial específico. Los hábitos vinculados no se borrarán y, si es un objetivo anual, sus hitos quedarán desvinculados.</p>
    <button className="danger-button full" onClick={() => onDelete(goal.id)}>Borrar definitivamente</button>
  </div></div>;
}

export function GoalEditorDialog({ editingGoalId, title, period, parentAnnualId, category, measurement, linkedHabitIds, target, unit, goals, habits, categories, onTitleChange, onPeriodChange, onParentAnnualChange, onCategoryChange, onMeasurementChange, onToggleHabit, onTargetChange, onUnitChange, onClose, onSave }: {
  editingGoalId: number | null; title: string; period: GoalPeriod; parentAnnualId: number | ""; category: HabitCategory;
  measurement: "complete" | "quantity"; linkedHabitIds: number[]; target: number; unit: string;
  goals: Goal[]; habits: Habit[]; categories: Category[];
  onTitleChange: (value: string) => void; onPeriodChange: (value: GoalPeriod) => void; onParentAnnualChange: (value: number | "") => void;
  onCategoryChange: (value: HabitCategory) => void; onMeasurementChange: (value: "complete" | "quantity") => void;
  onToggleHabit: (habitId: number) => void; onTargetChange: (value: number) => void; onUnitChange: (value: string) => void;
  onClose: () => void; onSave: () => void;
}) {
  const annualGoals = goals.filter((goal) => goal.period === "yearly" && goal.periodKey === String(new Date().getFullYear()) && goal.id !== editingGoalId && goal.status !== "discarded" && !goal.archived);
  const activeHabits = habits.filter((habit) => !habit.archived);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="modal goal-editor-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
      <p className="eyebrow">{editingGoalId ? "EDITAR RESULTADO" : "NUEVO RESULTADO"}</p><h2 id="goal-modal-title">{editingGoalId ? "Editar objetivo" : "Añadir objetivo"}</h2>
      <label>Objetivo<input autoFocus maxLength={160} value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Ej. Ahorrar 4.000 €" /></label>
      <label>Periodo<select value={period === "daily" ? "weekly" : period} onChange={(event) => onPeriodChange(event.target.value as GoalPeriod)}><option value="weekly">Esta semana</option><option value="monthly">Este mes</option><option value="yearly">Este año</option></select></label>
      {(period === "weekly" || period === "monthly") && <label>Objetivo anual vinculado (opcional)<select value={parentAnnualId} onChange={(event) => onParentAnnualChange(event.target.value ? Number(event.target.value) : "")}><option value="">Sin objetivo anual vinculado</option>{annualGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><small className="field-help">Al completarlo, contará como un hito dentro del objetivo anual.</small></label>}
      <label>Pilar<select value={category} onChange={(event) => onCategoryChange(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}</select></label>
      <label>Cómo se mide<select value={measurement} onChange={(event) => onMeasurementChange(event.target.value as "complete" | "quantity")}><option value="complete">Completado / pendiente</option><option value="quantity">Mediante una cantidad</option></select></label>
      {measurement === "quantity" && <fieldset className="goal-habit-picker"><legend>Vincular hábitos diarios (opcional)</legend><small>{linkedHabitIds.length ? `${linkedHabitIds.length} ${linkedHabitIds.length === 1 ? "hábito vinculado" : "hábitos vinculados"}` : "Sin hábitos: el progreso se actualizará manualmente"}</small><div>{activeHabits.map((habit) => <label key={habit.id}><input type="checkbox" checked={linkedHabitIds.includes(habit.id)} onChange={() => onToggleHabit(habit.id)} /><span style={{ background: habit.color }} aria-hidden="true" />{habit.name}</label>)}</div></fieldset>}
      {measurement === "quantity" && <div className="goal-form-row"><label>Meta<input type="number" min="1" value={target} onChange={(event) => onTargetChange(Number(event.target.value))} /></label><label>Unidad<input maxLength={24} value={unit} onChange={(event) => onUnitChange(event.target.value)} placeholder="€, kg, páginas…" /></label></div>}
      <button className="add-button full goal-modal-submit" onClick={onSave}>{editingGoalId ? "Guardar cambios" : "Crear objetivo"}</button>
    </div>
  </div>;
}
