import { habitScheduledOnDate } from "../../../../lib/domain/tracking";
import type { Habit } from "../../../../lib/domain/tracker-state";
import { watchUserFromRequest } from "../../../../lib/watch/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await watchUserFromRequest(request);
  if (!auth) return Response.json({ error: "Reloj no autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Fecha no válida" }, { status: 400 });
  const periodKey = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  const [{ data: rows, error }, { data: completions }] = await Promise.all([
    auth.admin.from("habits").select("id,name,category_id,goal,color,archived,archived_at,every_day,weekdays_only,schedule,position")
      .eq("user_id", auth.userId).eq("kind", "daily").order("position"),
    auth.admin.from("habit_completions").select("habit_id").eq("user_id", auth.userId).eq("period_key", periodKey).eq("value", day),
  ]);
  if (error) return Response.json({ error: "No se han podido cargar los hábitos" }, { status: 500 });
  const completed = new Set((completions ?? []).map((item) => Number(item.habit_id)));
  const habits = (rows ?? []).filter((row) => {
    const habit = { ...row, category: row.category_id, everyDay: row.every_day, weekdaysOnly: row.weekdays_only } as unknown as Habit;
    return !row.archived && habitScheduledOnDate(habit, date);
  }).map((row) => ({ id: Number(row.id), name: row.name, color: row.color, category: row.category_id, completed: completed.has(Number(row.id)) }));
  return Response.json({ date, habits }, { headers: { "Cache-Control": "private, no-store" } });
}
