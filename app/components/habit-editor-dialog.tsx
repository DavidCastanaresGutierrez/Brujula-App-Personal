import type { Category, HabitCategory } from "../../lib/domain/tracker-state";

export type HabitScheduleMode = "monthly" | "daily" | "weekdays" | "selectedWeekdays" | "interval";

type Props = {
  variant: "create" | "edit"; habitType: "daily" | "weekly"; daysInMonth: number;
  name: string; category: HabitCategory; categories: Category[]; goal: number;
  scheduleMode: HabitScheduleMode; selectedWeekdays: number[]; intervalDays: number; scheduleStart: string;
  activeFrom: string; activeUntil: string; pausedFrom: string; pausedUntil: string;
  color?: string; palette?: string[];
  onNameChange: (value: string) => void; onCategoryChange: (value: HabitCategory) => void; onGoalChange: (value: number) => void;
  onScheduleModeChange: (value: HabitScheduleMode) => void; onToggleWeekday: (value: number) => void;
  onIntervalDaysChange: (value: number) => void; onScheduleStartChange: (value: string) => void;
  onActiveFromChange: (value: string) => void; onActiveUntilChange: (value: string) => void;
  onPausedFromChange: (value: string) => void; onPausedUntilChange: (value: string) => void;
  onColorChange?: (value: string) => void; onClose: () => void; onSave: () => void;
};

const weekdays = [[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]] as const;
const frequencies = [
  ["monthly", "Días al mes", "Define una meta mensual flexible."],
  ["daily", "Todos los días", "Objetivo automático según los días del mes."],
  ["weekdays", "Días laborables", "De lunes a viernes."],
  ["selectedWeekdays", "Días concretos", "Elige los días de la semana."],
  ["interval", "Cada X días", "Repite desde una fecha de inicio."],
] as const;

export function HabitEditorDialog(props: Props) {
  const isCreate = props.variant === "create";
  const submitDisabled = props.scheduleMode === "selectedWeekdays" && !props.selectedWeekdays.length;
  return <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="habit-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={props.onClose} aria-label="Cerrar">×</button>
      <p className="eyebrow">{isCreate ? "NUEVO REGISTRO" : "EDITAR REGISTRO"}</p>
      <h2 id="habit-editor-title">{isCreate ? `Añadir hábito ${props.habitType === "daily" ? "diario" : "semanal"}` : "Editar hábito"}</h2>
      <label>Nombre<input autoFocus value={props.name} onChange={(event) => props.onNameChange(event.target.value)} placeholder={isCreate ? "Ej. Caminar 30 minutos" : undefined} /></label>
      <label>Bloque<select value={props.category} onChange={(event) => props.onCategoryChange(event.target.value)}>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
      {props.habitType === "daily" && <div className="frequency-options">
        {frequencies.map(([value, label, help]) => <label className="frequency-toggle" key={value}><input type="radio" name={`${props.variant}-frequency`} checked={props.scheduleMode === value} onChange={() => props.onScheduleModeChange(value)} /><span><strong>{label}</strong>{isCreate && <small>{value === "daily" ? `Objetivo automático de ${props.daysInMonth} días.` : help}</small>}</span></label>)}
        {props.scheduleMode === "selectedWeekdays" && <fieldset className="weekday-picker"><legend>Días programados</legend>{weekdays.map(([value, label]) => <button type="button" key={value} className={props.selectedWeekdays.includes(value) ? "selected" : ""} onClick={() => props.onToggleWeekday(value)}>{label}</button>)}</fieldset>}
        {props.scheduleMode === "interval" && <div className="schedule-fields"><label>Cada<input type="number" min="2" max="365" value={props.intervalDays} onChange={(event) => props.onIntervalDaysChange(Number(event.target.value))} /><small>días</small></label><label>Desde<input type="date" value={props.scheduleStart} onChange={(event) => props.onScheduleStartChange(event.target.value)} /></label></div>}
        <div className="schedule-fields"><label>Activo desde (opcional)<input type="date" value={props.activeFrom} onChange={(event) => props.onActiveFromChange(event.target.value)} /></label><label>Hasta<input type="date" value={props.activeUntil} min={props.activeFrom || undefined} onChange={(event) => props.onActiveUntilChange(event.target.value)} /></label></div>
        <div className="schedule-fields"><label>Pausar desde (opcional)<input type="date" value={props.pausedFrom} onChange={(event) => props.onPausedFromChange(event.target.value)} /></label><label>Hasta<input type="date" value={props.pausedUntil} min={props.pausedFrom || undefined} onChange={(event) => props.onPausedUntilChange(event.target.value)} /></label></div>
      </div>}
      {(props.habitType === "weekly" || props.scheduleMode === "monthly") && <label>{props.habitType === "weekly" ? "Veces por semana" : "Objetivo del mes"}<input type="number" min="1" max={props.habitType === "daily" ? props.daysInMonth : 7} value={props.goal} onChange={(event) => props.onGoalChange(Number(event.target.value))} />{props.habitType === "weekly" && <small className="field-help">{isCreate ? "Podrás registrar cada realización hasta alcanzar esta meta semanal." : "La meta se aplica de nuevo cada semana."}</small>}</label>}
      {!isCreate && props.color && props.palette && props.onColorChange && <fieldset className="color-picker"><legend>Color del hábito</legend><div className="color-palette">{props.palette.map((color) => <button key={color} type="button" className={props.color === color ? "selected" : ""} style={{ background: color }} onClick={() => props.onColorChange?.(color)} aria-label={`Elegir color ${color}`} aria-pressed={props.color === color}>{props.color === color && <span>✓</span>}</button>)}</div></fieldset>}
      <button className={`add-button full ${isCreate ? "" : "habit-editor-submit"}`} disabled={submitDisabled} onClick={props.onSave}>{isCreate ? "Crear hábito" : "Guardar cambios"}</button>
    </div>
  </div>;
}
