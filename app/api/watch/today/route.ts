import { calendarWeekForDate, calculateDailyScore, calculateWeeklyGoalBonus, habitAppliesOnDate, habitScheduledOnDate } from "../../../../lib/domain/tracking";
import type { Habit, WeeklyHabit } from "../../../../lib/domain/tracker-state";
import { watchUserFromRequest } from "../../../../lib/watch/auth";

export const dynamic = "force-dynamic";
type HabitRow = { id: number; kind: "daily" | "weekly"; name: string; category_id: string; goal: number; color: string; archived: boolean; archived_at: string | null; every_day: boolean; weekdays_only: boolean; schedule: Habit["schedule"] | null; misses: Record<string, number[]>; skips: Record<string, number[]> };
function dateFromKey(key: string) { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day, 12); }
function datesBetween(start: string, end: string) { const dates: string[] = []; const cursor = new Date(`${start}T00:00:00Z`); const limit = new Date(`${end}T00:00:00Z`); while (cursor <= limit) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); } return dates; }

export async function GET(request: Request) {
  const auth = await watchUserFromRequest(request);
  if (!auth) return Response.json({ error: "Reloj no autorizado" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Fecha no válida" }, { status: 400 });
  const week = calendarWeekForDate(dateFromKey(date));
  const weekDates = datesBetween(week.start, date < week.end ? date : week.end);
  const periodKeys = [...new Set(weekDates.map((item) => item.slice(0, 7)))];
  const [{ data: rows, error }, { data: completions }, { data: categories }, { data: goals }] = await Promise.all([
    auth.admin.from("habits").select("id,kind,name,category_id,goal,color,archived,archived_at,every_day,weekdays_only,schedule,misses,skips,position").eq("user_id", auth.userId).order("position"),
    auth.admin.from("habit_completions").select("habit_id,period_key,value").eq("user_id", auth.userId).in("period_key", periodKeys),
    auth.admin.from("categories").select("id,priority").eq("user_id", auth.userId),
    auth.admin.from("goals").select("id,title,status,current_value,target_value,period_key,due_date,metadata,position").eq("user_id", auth.userId).eq("period", "weekly").lte("period_key", date).gte("due_date", date).order("position"),
  ]);
  if (error) return Response.json({ error: "No se han podido cargar los hábitos" }, { status: 500 });
  const historyByHabit = new Map<number, Record<string, number[]>>();
  for (const completion of completions ?? []) { const habitId = Number(completion.habit_id); const history = historyByHabit.get(habitId) ?? {}; history[completion.period_key] = [...(history[completion.period_key] ?? []), Number(completion.value)]; historyByHabit.set(habitId, history); }
  const mapped = ((rows ?? []) as HabitRow[]).map((row) => ({ id: Number(row.id), name: row.name, goal: row.goal, color: row.color, checks: [], category: row.category_id, archived: row.archived, archivedAt: row.archived_at ?? undefined, everyDay: row.every_day, weekdaysOnly: row.weekdays_only, schedule: row.schedule ?? undefined, misses: row.misses, skips: row.skips, history: historyByHabit.get(Number(row.id)) ?? {}, kind: row.kind }));
  const daily = mapped.filter((habit) => habit.kind === "daily") as (Habit & { kind: "daily" })[];
  const weekly = mapped.filter((habit) => habit.kind === "weekly") as (WeeklyHabit & { kind: "weekly" })[];
  const periodKey = date.slice(0, 7); const day = Number(date.slice(8, 10));
  const statusFor = (habit: Habit | WeeklyHabit) => (habit.history?.[periodKey] ?? []).includes(day) ? "completed" : (habit.misses?.[periodKey] ?? []).includes(day) ? "missed" : (habit.skips?.[periodKey] ?? []).includes(day) ? "skipped" : "pending";
  const habits = [...daily.filter((habit) => habitScheduledOnDate(habit, date)), ...weekly.filter((habit) => habitAppliesOnDate(habit, date))].map((habit) => ({ id: habit.id, name: habit.name, color: habit.color, kind: habit.kind, status: statusFor(habit) }));
  const scoreCategories = (categories ?? []).map((category) => ({ id: category.id, priority: category.priority }));
  const dayScore = calculateDailyScore(dateFromKey(date), daily, weekly, scoreCategories).finalScore;
  const evaluatedScores = weekDates.map((item) => calculateDailyScore(dateFromKey(item), daily, weekly, scoreCategories)).filter((score) => score.scheduled > 0);
  const weekBase = evaluatedScores.length ? evaluatedScores.reduce((sum, score) => sum + score.finalScore, 0) / evaluatedScores.length : 0;
  const weeklyGoals = (goals ?? []).filter((goal) => !Boolean((goal.metadata as { archived?: boolean } | null)?.archived));
  const weekScore = calculateWeeklyGoalBonus(weekBase, weeklyGoals.filter((goal) => goal.status !== "discarded").map((goal) => ({ status: goal.status, currentValue: Number(goal.current_value), targetValue: Number(goal.target_value) }))).finalScore;
  return Response.json({ date, scores: { day: dayScore, week: weekScore }, habits, goals: weeklyGoals.map((goal) => ({ id: Number(goal.id), title: goal.title, status: goal.status })) }, { headers: { "Cache-Control": "private, no-store" } });
}
