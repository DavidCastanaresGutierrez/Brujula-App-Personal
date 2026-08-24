import type { ButtonHTMLAttributes, CSSProperties, RefObject } from "react";
import type { Category, Habit } from "../../lib/domain/tracker-state";
import { habitScheduledOnDate, isoDate, isCalendarDayInFuture, monthlyHabitProgressThrough } from "../../lib/domain/tracking";

type CalendarDay = { day: number; weekEnd: boolean; weekShaded: boolean; label: string };

type Props = {
  year: number; month: number; days: number; today: Date; todayNumber: number | null; evaluatedThrough: number;
  calendar: CalendarDay[]; categories: Category[]; habits: Habit[]; draggingHabitId?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  isCollapsed: (categoryId: string) => boolean;
  onToggleCategory: (categoryId: string) => void;
  goalFor: (habit: Habit) => number;
  checksFor: (habit: Habit) => number[];
  missesFor: (habit: Habit) => number[];
  skipsFor: (habit: Habit) => number[];
  toggleProps: (onShort: () => void, onLong: () => void) => ButtonHTMLAttributes<HTMLButtonElement>;
  onToggleDay: (habitId: number, day: number) => void;
  onCycleException: (habitId: number, date: Date) => void;
  onManageHabit: (habit: Habit) => void;
  onDragStart: (habitId: number) => void;
  onDragEnd: () => void;
  onReorder: (sourceId: number, targetId: number) => void;
};

const weekLabels = ["D", "L", "M", "X", "J", "V", "S"];

export function DailyHabitTracker({ year, month, days, today, todayNumber, evaluatedThrough, calendar, categories, habits, draggingHabitId, scrollRef, isCollapsed, onToggleCategory, goalFor, checksFor, missesFor, skipsFor, toggleProps, onToggleDay, onCycleException, onManageHabit, onDragStart, onDragEnd, onReorder }: Props) {
  return <div className="table-scroll" ref={scrollRef}>
    <div className="habit-table" style={{ minWidth: `${410 + days * 38}px` }}>
      <div className="habit-row header-row">
        <div className="habit-name">HÁBITO</div><div className="goal-cell">META</div>
        <div className="day-grid" style={{ gridTemplateColumns: `repeat(${days}, 34px)` }}>
          {calendar.map((item) => <div className={`${item.weekShaded ? "week-shaded" : ""} ${item.weekEnd ? "week-end" : ""} ${item.day === todayNumber ? "today-column today-header" : ""}`.trim()} key={item.day}><span>{item.day === todayNumber ? "HOY" : item.label}</span><b>{item.day}</b></div>)}
        </div>
        <div className="result-cell">PROGRESO</div>
      </div>
      {categories.map((category) => {
        const categoryHabits = habits.filter((habit) => habit.category === category.id);
        if (!categoryHabits.length) return null;
        const collapsed = isCollapsed(category.id);
        return <div className="category-group" key={category.id}>
          <button type="button" className="category-band" style={{ "--category-color": category.color } as CSSProperties} onClick={() => onToggleCategory(category.id)} aria-expanded={!collapsed}>
            <span className="category-band-label"><span>{category.icon}</span><strong>{category.label}</strong></span><small>{categoryHabits.length}</small><i aria-hidden="true">⌄</i>
          </button>
          {!collapsed && categoryHabits.map((habit) => {
            const effectiveGoal = goalFor(habit);
            const currentChecks = checksFor(habit);
            const { completed, eligible, percent } = monthlyHabitProgressThrough(habit, year, month, evaluatedThrough);
            const progress = Math.round(percent);
            return <div className={`habit-row ${draggingHabitId === habit.id ? "is-dragging" : ""}`} key={habit.id} onDragOver={(event) => event.preventDefault()} onDrop={() => draggingHabitId && onReorder(draggingHabitId, habit.id)}>
              <div className="habit-name"><span className="drag-handle" draggable onDragStart={() => onDragStart(habit.id)} onDragEnd={onDragEnd} title="Arrastrar para reordenar" aria-label={`Arrastrar ${habit.name}`}>⠿</span><i style={{ background: habit.color }} /><span>{habit.name}</span><div className="habit-menu"><button className="menu-trigger" aria-label={`Gestionar ${habit.name}`} onClick={() => onManageHabit(habit)}>⋯</button></div></div>
              <div className="goal-cell">{habit.schedule?.mode === "selectedWeekdays" ? <span className="daily-goal">{habit.schedule.weekdays?.map((day) => weekLabels[day]).join(" · ")} · {effectiveGoal}</span> : habit.schedule?.mode === "interval" ? <span className="daily-goal">Cada {habit.schedule.intervalDays} días · {effectiveGoal}</span> : habit.everyDay ? <span className="daily-goal">Diario · {days}</span> : habit.weekdaysOnly ? <span className="daily-goal">Laborables · {effectiveGoal}</span> : habit.goal}</div>
              <div className="day-grid" style={{ gridTemplateColumns: `repeat(${days}, 34px)` }}>
                {calendar.map((item) => {
                  const future = isCalendarDayInFuture(year, month, item.day, today);
                  const checked = currentChecks.includes(item.day);
                  const missed = !checked && missesFor(habit).includes(item.day);
                  const skipped = !checked && skipsFor(habit).includes(item.day);
                  const unscheduled = !habitScheduledOnDate(habit, isoDate(year, month, item.day));
                  const disabled = unscheduled || (future && !checked);
                  return <button key={item.day} disabled={disabled} className={`${checked ? "checked" : missed ? "missed" : skipped ? "skipped" : ""} ${item.weekShaded ? "week-shaded" : ""} ${item.weekEnd ? "week-end" : ""} ${item.day === todayNumber ? "today-column" : ""} ${unscheduled ? "non-working-day" : ""} ${future ? "future-day" : ""}`.trim()} {...(!disabled ? toggleProps(() => onToggleDay(habit.id, item.day), () => onCycleException(habit.id, new Date(year, month, item.day))) : {})} aria-label={`${habit.name}, día ${item.day}${item.day === todayNumber ? ", hoy" : ""}${missed ? ", no completado" : skipped ? ", omitido; no afecta a la puntuación" : ""}${unscheduled ? ", no programado" : future ? checked ? ", registro futuro; se puede desmarcar" : ", todavía no disponible" : ""}`} title={unscheduled ? "Día no programado" : "Pulsación larga: no completado → omitido → pendiente"}>{checked ? "✓" : missed ? "✕" : skipped ? "—" : ""}</button>;
                })}
              </div>
              <div className="result-cell"><strong>{progress}%</strong><span>{completed}/{eligible}</span></div>
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>;
}
