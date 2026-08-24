import type { ReactNode } from "react";
import type { Category, HabitCategory } from "../../lib/domain/tracker-state";

type GoalFilter = "weekly" | "monthly" | "yearly";

type GoalsViewProps = {
  archivedCount: number;
  goalFilter: GoalFilter;
  categoryFilter: HabitCategory | "all";
  categories: Category[];
  hasVisibleGoals: boolean;
  hasActiveGoals: boolean;
  children: ReactNode;
  onOpenArchived: () => void;
  onOpenTemplate: (template: "fitness" | "reading") => void;
  onAddGoal: () => void;
  onFilterChange: (filter: GoalFilter) => void;
  onCategoryFilterChange: (category: HabitCategory | "all") => void;
};

const periodLabels: Record<GoalFilter, string> = {
  weekly: "Semana",
  monthly: "Mes",
  yearly: "Año",
};

export function GoalsView(props: GoalsViewProps) {
  return <>
    <section className="view-intro">
      <p className="eyebrow">RESULTADOS</p>
      <h1>Objetivos</h1>
      <p>Define resultados concretos y comprueba si tus hábitos te acercan a ellos.</p>
    </section>
    <section className="panel goals-panel" id="goals">
      <div className="goals-head">
        <div><p className="eyebrow">RESULTADOS CON RUMBO</p><h2>Tus objetivos</h2><p>Define el resultado; tus hábitos sostienen el camino.</p></div>
        <div className="goal-head-actions">
          <button className="reset-button archived-button" onClick={props.onOpenArchived}>Archivados{props.archivedCount > 0 && <span>{props.archivedCount}</span>}</button>
          <button className="template-button" onClick={() => props.onOpenTemplate("fitness")}><span aria-hidden="true">♥</span>Forma física</button>
          <button className="template-button" onClick={() => props.onOpenTemplate("reading")}><span aria-hidden="true">▥</span>Lectura anual</button>
          <button className="add-button" onClick={props.onAddGoal}>+ Añadir objetivo</button>
        </div>
      </div>
      <div className="goal-toolbar">
        <div className="tabs goal-tabs">
          {(Object.keys(periodLabels) as GoalFilter[]).map((filter) => <button key={filter} className={props.goalFilter === filter ? "active" : ""} onClick={() => props.onFilterChange(filter)}>{periodLabels[filter]}</button>)}
        </div>
        <label className="goal-block-filter"><span>Bloque</span><select value={props.categoryFilter} onChange={(event) => props.onCategoryFilterChange(event.target.value as HabitCategory | "all")}><option value="all">Todos los bloques</option>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}</select></label>
      </div>
      {props.categoryFilter !== "all" && <p className="goal-filter-note">Quita el filtro de bloque para reordenar las tarjetas.</p>}
      {props.hasVisibleGoals
        ? <div className="goal-grid">{props.children}</div>
        : <div className="goals-empty"><strong>No hay objetivos en este periodo{props.categoryFilter !== "all" ? " y bloque" : ""}</strong><p>{props.hasActiveGoals ? "Cambia el periodo o el filtro para ver tus otros objetivos." : "Crea un resultado concreto y medible para orientar tus hábitos."}</p></div>}
    </section>
  </>;
}
