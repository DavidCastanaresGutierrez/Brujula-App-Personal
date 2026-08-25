import { useState, type Dispatch, type SetStateAction } from "react";
import { removeHabitFromGoals } from "../../lib/domain/relationships";
import { isoDate, scheduledDaysInMonth, type HabitSchedule } from "../../lib/domain/tracking";
import type { Goal, Habit, HabitCategory, WeeklyHabit } from "../../lib/domain/tracker-state";
import type { HabitScheduleMode } from "../components/habit-editor-dialog";

type HabitType = "daily" | "weekly";
type HabitAction = { type: HabitType; habit: Habit };
type DeletingHabit = { type: HabitType; id: number; name: string };

type Options = {
  daily: Habit[];
  weekly: WeeklyHabit[];
  setDaily: Dispatch<SetStateAction<Habit[]>>;
  setWeekly: Dispatch<SetStateAction<WeeklyHabit[]>>;
  setGoals: Dispatch<SetStateAction<Goal[]>>;
  today: Date;
  year: number;
  month: number;
  palette: string[];
  resolveCategory: (habit: Habit) => HabitCategory;
};

export function useHabitManager({ daily, weekly, setDaily, setWeekly, setGoals, today, year, month, palette, resolveCategory }: Options) {
  const [modal, setModal] = useState<HabitType | null>(null);
  const [editing, setEditing] = useState<{ type: HabitType; id: number } | null>(null);
  const [deleting, setDeleting] = useState<DeletingHabit | null>(null);
  const [actionHabit, setActionHabit] = useState<HabitAction | null>(null);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState(12);
  const [scheduleMode, setScheduleMode] = useState<HabitScheduleMode>("monthly");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState(2);
  const [scheduleStart, setScheduleStart] = useState(() => isoDate(today.getFullYear(), today.getMonth(), today.getDate()));
  const [activeFrom, setActiveFrom] = useState("");
  const [activeUntil, setActiveUntil] = useState("");
  const [pausedFrom, setPausedFrom] = useState("");
  const [pausedUntil, setPausedUntil] = useState("");
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>("health");

  function buildSchedule(): HabitSchedule | undefined {
    const customMode = scheduleMode === "selectedWeekdays" || scheduleMode === "interval";
    if (!customMode && !activeFrom && !activeUntil && !(pausedFrom && pausedUntil)) return undefined;
    return {
      ...(customMode ? { mode: scheduleMode } : {}),
      ...(scheduleMode === "selectedWeekdays" ? { weekdays: [...selectedWeekdays].sort((a, b) => a - b) } : scheduleMode === "interval" ? { intervalDays, startDate: scheduleStart } : {}),
      ...(activeFrom ? { activeFrom } : {}),
      ...(activeUntil ? { activeUntil } : {}),
      ...(pausedFrom && pausedUntil ? { pausedFrom, pausedUntil } : {}),
    };
  }

  function resetScheduleDraft() {
    setScheduleMode("monthly");
    setSelectedWeekdays([1, 3, 5]);
    setIntervalDays(2);
    setScheduleStart(isoDate(today.getFullYear(), today.getMonth(), today.getDate()));
    setActiveFrom("");
    setActiveUntil("");
    setPausedFrom("");
    setPausedUntil("");
  }

  function addHabit() {
    if (!newName.trim() || !modal) return;
    const color = palette[(daily.length + weekly.length) % palette.length];
    if (modal === "daily") {
      const schedule = buildSchedule();
      setDaily((items) => {
        const draft = { id: Date.now(), name: newName.trim(), goal: newGoal, everyDay: scheduleMode === "daily", weekdaysOnly: scheduleMode === "weekdays", schedule, color, checks: [], category: selectedCategory };
        return [...items, { ...draft, goal: schedule?.mode || draft.everyDay || draft.weekdaysOnly ? scheduledDaysInMonth(draft, year, month) : newGoal }];
      });
    } else {
      setWeekly((items) => [...items, { id: Date.now(), name: newName.trim(), goal: Math.min(7, Math.max(1, newGoal)), color, checks: [], category: selectedCategory }]);
    }
    setNewName("");
    setNewGoal(12);
    resetScheduleDraft();
    setSelectedCategory("health");
    setModal(null);
  }

  function startEdit(type: HabitType, habit: Habit) {
    setEditing({ type, id: habit.id });
    setNewName(habit.name);
    setNewGoal(habit.goal);
    setScheduleMode(type === "weekly" ? "monthly" : habit.schedule?.mode ?? (habit.everyDay ? "daily" : habit.weekdaysOnly ? "weekdays" : "monthly"));
    setSelectedWeekdays(habit.schedule?.weekdays ?? [1, 3, 5]);
    setIntervalDays(habit.schedule?.intervalDays ?? 2);
    setScheduleStart(habit.schedule?.startDate ?? isoDate(today.getFullYear(), today.getMonth(), today.getDate()));
    setActiveFrom(habit.schedule?.activeFrom ?? "");
    setActiveUntil(habit.schedule?.activeUntil ?? "");
    setPausedFrom(habit.schedule?.pausedFrom ?? "");
    setPausedUntil(habit.schedule?.pausedUntil ?? "");
    setSelectedColor(habit.color);
    setSelectedCategory(resolveCategory(habit));
    setActionHabit(null);
  }

  function saveEdit() {
    if (!editing || !newName.trim()) return;
    const update = (habit: Habit) => {
      if (habit.id !== editing.id) return habit;
      const schedule = editing.type === "daily" ? buildSchedule() : undefined;
      const next = { ...habit, name: newName.trim(), goal: editing.type === "weekly" ? Math.min(7, Math.max(1, newGoal)) : newGoal, everyDay: editing.type === "daily" && scheduleMode === "daily", weekdaysOnly: editing.type === "daily" && scheduleMode === "weekdays", schedule, color: selectedColor, category: selectedCategory };
      return { ...next, goal: editing.type === "daily" && (schedule?.mode || next.everyDay || next.weekdaysOnly) ? scheduledDaysInMonth(next, year, month) : next.goal };
    };
    if (editing.type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
    setEditing(null);
    setNewName("");
    resetScheduleDraft();
    setSelectedColor(palette[0]);
    setSelectedCategory("health");
  }

  function archiveHabit(type: HabitType, id: number) {
    const update = (habit: Habit) => habit.id === id ? { ...habit, archived: true, archivedAt: isoDate(today.getFullYear(), today.getMonth(), today.getDate()) } : habit;
    if (type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
    setActionHabit(null);
  }

  function restoreHabit(type: HabitType, id: number) {
    const update = (habit: Habit) => habit.id === id ? { ...habit, archived: false, archivedAt: undefined } : habit;
    if (type === "daily") setDaily((items) => items.map(update));
    else setWeekly((items) => items.map(update));
  }

  function deleteHabit() {
    if (!deleting) return;
    if (deleting.type === "daily") setDaily((items) => items.filter((habit) => habit.id !== deleting.id));
    else setWeekly((items) => items.filter((habit) => habit.id !== deleting.id));
    setGoals((items) => removeHabitFromGoals(items, deleting.id));
    setDeleting(null);
  }

  return {
    modal, setModal, editing, setEditing, deleting, setDeleting, actionHabit, setActionHabit,
    newName, setNewName, newGoal, setNewGoal, scheduleMode, setScheduleMode,
    selectedWeekdays, setSelectedWeekdays, intervalDays, setIntervalDays, scheduleStart, setScheduleStart,
    activeFrom, setActiveFrom, activeUntil, setActiveUntil, pausedFrom, setPausedFrom, pausedUntil, setPausedUntil,
    selectedColor, setSelectedColor, selectedCategory, setSelectedCategory,
    resetScheduleDraft, addHabit, startEdit, saveEdit, archiveHabit, restoreHabit, deleteHabit,
  };
}
