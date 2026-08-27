import { watchUserFromRequest } from "../../../../lib/watch/auth";

export async function POST(request: Request) {
  const auth = await watchUserFromRequest(request);
  if (!auth) return Response.json({ error: "Reloj no autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { habitId?: unknown; goalId?: unknown; date?: unknown; status?: unknown } | null;
  const status = typeof body?.status === "string" ? body.status : "";
  const goalId = Number(body?.goalId);
  if (Number.isSafeInteger(goalId)) {
    if (!['active', 'completed', 'discarded'].includes(status)) return Response.json({ error: "Datos no válidos" }, { status: 400 });
    const { data, error } = await auth.admin.rpc("set_watch_weekly_goal_status", {
      target_user_id: auth.userId, target_goal_id: goalId, target_status: status,
    });
    if (error || data !== true) return Response.json({ error: "No se ha podido actualizar el objetivo" }, { status: error ? 500 : 404 });
    return Response.json({ status });
  }
  const habitId = Number(body?.habitId);
  const date = typeof body?.date === "string" ? body.date : "";
  if (!Number.isSafeInteger(habitId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['pending', 'completed', 'missed', 'skipped'].includes(status)) {
    return Response.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const { data, error } = await auth.admin.rpc("set_watch_habit_status", {
    target_user_id: auth.userId, target_habit_id: habitId, target_date: date, target_status: status,
  });
  if (error || data !== true) return Response.json({ error: "No se ha podido actualizar el hábito" }, { status: error ? 500 : 404 });
  return Response.json({ status });
}
