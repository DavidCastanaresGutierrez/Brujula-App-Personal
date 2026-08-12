import type { CSSProperties } from "react";
import { availableDaysForMonthWeek, daysForMonthWeek, isCalendarDayInFuture } from "../../lib/domain/tracking";

type Category = { id: string; label: string; icon: string; color: string };
type WeeklyHabit = { id: number; name: string; goal: number; color: string; checks: number[]; category?: string };

type Props = {
  year: number;
  month: number;
  monthName: string;
  today: Date;
  isPastMonth: boolean;
  monthWeeks: number[][];
  currentMonthWeek: number;
  categories: Category[];
  habits: WeeklyHabit[];
  draggingHabitId?: number;
  isCollapsed: (categoryId: string) => boolean;
  onToggleCategory: (categoryId: string) => void;
  checksFor: (habit: WeeklyHabit) => number[];
  onChangeCount: (habitId: number, week: number, delta: 1 | -1) => void;
  onManageHabit: (habit: WeeklyHabit) => void;
  onDragStart: (habitId: number) => void;
  onDragEnd: () => void;
  onReorder: (sourceId: number, targetId: number) => void;
};

export function WeeklyHabitTracker({ year, month, monthName, today, isPastMonth, monthWeeks, currentMonthWeek, categories, habits, draggingHabitId, isCollapsed, onToggleCategory, checksFor, onChangeCount, onManageHabit, onDragStart, onDragEnd, onReorder }: Props) {
  return <div className="weekly-list">
    <div className="weekly-period-guide">
      <div><span>REGISTRO SEMANAL</span><strong>{monthName} {year}</strong></div>
      <p>{currentMonthWeek
        ? <>Estás en la <b>semana {currentMonthWeek}</b>, del {monthWeeks[currentMonthWeek - 1][0]} al {monthWeeks[currentMonthWeek - 1].at(-1)} de {monthName.toLowerCase()}.</>
        : isPastMonth ? "Este mes ya ha finalizado. Puedes consultar o corregir sus registros." : "Este mes todavía no ha comenzado."}</p>
      <small>Usa − y + para indicar cuántas veces completaste cada hábito durante la semana.</small>
    </div>
    {categories.map((category) => {
      const categoryHabits = habits.filter((habit) => habit.category === category.id);
      if (!categoryHabits.length) return null;
      const collapsed = isCollapsed(category.id);
      return <div className="weekly-category" key={category.id}>
        <button type="button" className="category-band" style={{ "--category-color": category.color } as CSSProperties} onClick={() => onToggleCategory(category.id)} aria-expanded={!collapsed}>
          <span className="category-band-label"><span>{category.icon}</span><strong>{category.label}</strong></span>
          <small>{categoryHabits.length}</small><i aria-hidden="true">⌄</i>
        </button>
        {!collapsed && categoryHabits.map((habit) => {
          const currentChecks = checksFor(habit);
          const availableWeeks = monthWeeks.map((_, index) => index + 1);
          const monthlyTarget = availableWeeks.reduce((sum, week) => sum + Math.min(habit.goal, daysForMonthWeek(year, month, week).length), 0);
          const validChecks = currentChecks.filter((day) => !isCalendarDayInFuture(year, month, day, today));
          const progress = Math.min(100, Math.round(validChecks.length / Math.max(1, monthlyTarget) * 100));
          return <div className={`weekly-row ${draggingHabitId === habit.id ? "is-dragging" : ""}`} key={habit.id} onDragOver={(event) => event.preventDefault()} onDrop={() => draggingHabitId && onReorder(draggingHabitId, habit.id)}>
            <div className="habit-name"><span className="drag-handle" draggable onDragStart={() => onDragStart(habit.id)} onDragEnd={onDragEnd} title="Arrastrar para reordenar" aria-label={`Arrastrar ${habit.name}`}>⠿</span><i style={{ background: habit.color }} /><span>{habit.name}</span><div className="habit-menu"><button className="menu-trigger" aria-label={`Gestionar ${habit.name}`} onClick={() => onManageHabit(habit)}>⋯</button></div></div>
            <div className="week-checks" style={{ "--week-columns": monthWeeks.length } as CSSProperties}>{availableWeeks.map((week) => {
              const weekDays = daysForMonthWeek(year, month, week);
              const weekTarget = Math.min(habit.goal, weekDays.length);
              const eligibleDays = availableDaysForMonthWeek(year, month, week, today);
              const count = currentChecks.filter((day) => weekDays.includes(day)).length;
              const eligibleCount = currentChecks.filter((day) => eligibleDays.includes(day)).length;
              const canAdd = eligibleDays.some((day) => !currentChecks.includes(day));
              const isCurrentWeek = week === currentMonthWeek;
              return <div className={`week-counter ${eligibleCount >= weekTarget ? "checked" : ""} ${eligibleDays.length === 0 ? "future-week" : ""} ${isCurrentWeek ? "current-week" : ""}`} key={week} aria-label={`Semana ${week}, del ${weekDays[0]} al ${weekDays.at(-1)} de ${monthName}`}>
                <span><b>{isCurrentWeek ? "ACTUAL" : `S${week}`}</b><small>{weekDays[0]}–{weekDays.at(-1)} {monthName.slice(0, 3).toLowerCase()}</small></span>
                <button onClick={() => onChangeCount(habit.id, week, -1)} disabled={count === 0} aria-label={`Restar una realización de ${habit.name} en la semana ${week}`}>−</button>
                <strong>{eligibleCount}/{weekTarget}</strong>
                <button onClick={() => onChangeCount(habit.id, week, 1)} disabled={!canAdd} aria-label={`Sumar una realización de ${habit.name} en la semana ${week}`}>+</button>
              </div>;
            })}</div>
            <div className="weekly-result"><strong>{progress}%</strong><span>{validChecks.length}/{monthlyTarget}</span></div>
          </div>;
        })}
      </div>;
    })}
  </div>;
}
