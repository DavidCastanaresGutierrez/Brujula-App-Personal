import type { ButtonHTMLAttributes, CSSProperties } from "react";
import type { Category, Goal, Habit, HabitCategory, WeeklyHabit } from "../../lib/domain/tracker-state";
import { daysForMonthWeek } from "../../lib/domain/tracking";

type HabitGroup<T> = { category: Category; habits: T[] };

type Props = {
  today: Date;
  date: Date;
  monthKey: string;
  weekIndex: number;
  isViewingToday: boolean;
  habits: Habit[];
  habitGroups: HabitGroup<Habit>[];
  weeklyHabits: WeeklyHabit[];
  weeklyHabitGroups: HabitGroup<WeeklyHabit>[];
  goals: Goal[];
  categories: Category[];
  completedHabits: number;
  finalScore: number;
  categoryScores: Map<string, { percent: number }>;
  isCollapsed: (scope: "today-daily" | "today-weekly", categoryId: HabitCategory) => boolean;
  onToggleCategory: (scope: "today-daily" | "today-weekly", categoryId: HabitCategory) => void;
  toggleProps: (onTap: () => void, onLongPress: () => void) => ButtonHTMLAttributes<HTMLButtonElement>;
  onShiftDay: (direction: -1 | 1) => void;
  onReturnToToday: () => void;
  onToggleHabit: (habitId: number) => void;
  onToggleWeeklyHabit: (habitId: number) => void;
  onCycleException: (type: "daily" | "weekly", habitId: number, date: Date) => void;
  onUpdateGoal: (goal: Goal, value: number) => void;
  onMarkGoalNotCompleted: (goal: Goal) => void;
};

const scoreLabel = (score: number) => score.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function TodayView({ today, date, monthKey, weekIndex, isViewingToday, habits, habitGroups, weeklyHabits, weeklyHabitGroups, goals, categories, completedHabits, finalScore, categoryScores, isCollapsed, onToggleCategory, toggleProps, onShiftDay, onReturnToToday, onToggleHabit, onToggleWeeklyHabit, onCycleException, onUpdateGoal, onMarkGoalNotCompleted }: Props) {
  return <>
    <section className="view-intro"><p className="eyebrow">ACCIÓN DIARIA</p><h1>Tu día</h1><p>Lo que requiere tu atención hoy, sin ruido.</p></section>
    <section className="panel today-panel" id="today">
      <div className="today-head">
        <div><p className="eyebrow">{isViewingToday ? "HOY" : "DÍA CONSULTADO"} · {date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p><h2>Tu día, en una sola vista</h2><p>Marca lo que completas y mantén a la vista los resultados que estás persiguiendo.</p></div>
        <div className="today-head-summary"><strong>{completedHabits}/{habits.length} hábitos</strong><strong>Nota {scoreLabel(finalScore)} / 10</strong></div>
      </div>
      <div className="day-navigation"><button onClick={() => onShiftDay(-1)} aria-label="Ver el día anterior">← Día anterior</button><button onClick={() => onShiftDay(1)} disabled={isViewingToday} aria-label="Ver el día siguiente">Día siguiente →</button>{!isViewingToday && <button onClick={onReturnToToday} title={`Volver al ${today.toLocaleDateString("es-ES")}`}>Volver a hoy</button>}</div>
      <div className="today-grid">
        <article className="today-column-card">
          <div className="today-section-title"><h3>Hábitos del día</h3><span>{habits.length}</span></div>
          <div className="today-list grouped">
            {habitGroups.map(({ category, habits: groupedHabits }) => { const collapsed = isCollapsed("today-daily", category.id); return <div className={`today-block ${collapsed ? "is-collapsed" : ""}`} key={category.id}><button type="button" className="today-block-title" style={{ color: category.color }} onClick={() => onToggleCategory("today-daily", category.id)} aria-expanded={!collapsed}><span>{category.icon}</span><strong>{category.label}{category.priority ? " ★" : ""}</strong><small>{Math.round(categoryScores.get(category.id)?.percent ?? 0)}%</small><i aria-hidden="true">⌄</i></button>{!collapsed && groupedHabits.map((habit) => {
              const checked = (habit.history?.[monthKey] ?? []).includes(date.getDate());
              const missed = !checked && (habit.misses?.[monthKey] ?? []).includes(date.getDate());
              const skipped = !checked && (habit.skips?.[monthKey] ?? []).includes(date.getDate());
              return <button key={habit.id} className={`today-item ${checked ? "done" : missed ? "missed" : skipped ? "skipped" : ""}`} {...toggleProps(() => onToggleHabit(habit.id), () => onCycleException("daily", habit.id, date))} aria-pressed={checked} title="Pulsación larga: no completado → omitido → pendiente"><i style={{ background: habit.color }} /><span><strong>{habit.name}</strong><small>{checked ? "Completado" : missed ? "No completado" : skipped ? "Omitido · no afecta a la puntuación" : "Pendiente"}</small></span><b>{checked ? "✓" : missed ? "✕" : skipped ? "—" : ""}</b></button>;
            })}</div>; })}
            {!habits.length && <p className="today-empty">No tienes hábitos previstos para este día.</p>}
          </div>
          {!!weeklyHabits.length && <><div className="today-section-title secondary"><h3>Esta semana</h3><span>{weeklyHabits.length}</span></div><div className="today-list compact grouped">{weeklyHabitGroups.map(({ category, habits: groupedHabits }) => { const collapsed = isCollapsed("today-weekly", category.id); return <div className={`today-block ${collapsed ? "is-collapsed" : ""}`} key={category.id}><button type="button" className="today-block-title" style={{ color: category.color }} onClick={() => onToggleCategory("today-weekly", category.id)} aria-expanded={!collapsed}><span>{category.icon}</span><strong>{category.label}{category.priority ? " ★" : ""}</strong><small>{groupedHabits.length}</small><i aria-hidden="true">⌄</i></button>{!collapsed && groupedHabits.map((habit) => {
            const weekDays = daysForMonthWeek(date.getFullYear(), date.getMonth(), weekIndex);
            const count = (habit.history?.[monthKey] ?? []).filter((day) => weekDays.includes(day)).length;
            const doneOnDay = (habit.history?.[monthKey] ?? []).includes(date.getDate());
            const missed = !doneOnDay && (habit.misses?.[monthKey] ?? []).includes(date.getDate());
            const skipped = !doneOnDay && (habit.skips?.[monthKey] ?? []).includes(date.getDate());
            return <button key={habit.id} className={`today-item ${doneOnDay ? "done" : missed ? "missed" : skipped ? "skipped" : ""}`} {...toggleProps(() => onToggleWeeklyHabit(habit.id), () => onCycleException("weekly", habit.id, date))} aria-pressed={doneOnDay} title="Pulsación larga: no completado → omitido → pendiente"><i style={{ background: habit.color }} /><span><strong>{habit.name}</strong><small>{count}/{Math.min(habit.goal, weekDays.length)} esta semana{doneOnDay ? " · hecho este día" : missed ? " · no completado" : skipped ? " · omitido" : ""}</small></span><b>{doneOnDay ? "✓" : missed ? "✕" : skipped ? "—" : "+"}</b></button>;
          })}</div>; })}</div></>}
        </article>
        <article className="today-column-card">
          <div className="today-section-title"><h3>Objetivos en foco</h3><span>{goals.length}</span></div>
          <div className="today-goals">
            {goals.map((goal) => {
              const category = categories.find((item) => item.id === goal.category) ?? categories[0];
              const progress = Math.min(100, Math.round(goal.currentValue / Math.max(1, goal.targetValue) * 100));
              const completed = goal.status === "completed" || goal.currentValue >= goal.targetValue;
              const missed = goal.status === "discarded";
              return <div className="today-goal" key={goal.id} style={{ "--goal-color": category?.color ?? "#39c6a4" } as CSSProperties}><div><span>{category?.icon} {goal.period === "daily" ? "Hoy" : goal.period === "weekly" ? "Semana" : goal.period === "monthly" ? "Mes" : "Año"}</span><strong>{goal.title}</strong><small>{progress}% · vence {new Date(`${goal.dueDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small></div><span className="today-goal-status">{goal.measurement !== "complete" && <b>{goal.currentValue}/{goal.targetValue}{goal.unit ? ` ${goal.unit}` : ""}</b>}<button className={completed ? "done" : missed ? "missed" : "pending"} {...toggleProps(() => onUpdateGoal(goal, completed || missed ? 0 : goal.targetValue), () => onMarkGoalNotCompleted(goal))} aria-label={completed || missed ? `Dejar ${goal.title} pendiente` : `Marcar ${goal.title} como completado`} title="Pulsa para completar · mantén pulsado para marcar como no completado">{completed ? "✓" : missed ? "✕" : ""}</button></span></div>;
            })}
            {!goals.length && <p className="today-empty">No hay objetivos que requieran atención este día.</p>}
          </div>
        </article>
      </div>
    </section>
  </>;
}
