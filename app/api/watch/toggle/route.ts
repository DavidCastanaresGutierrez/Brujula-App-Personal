import { watchUserFromRequest } from "../../../../lib/watch/auth";

export async function POST(request: Request) {
  const auth = await watchUserFromRequest(request);
  if (!auth) return Response.json({ error: "Reloj no autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { habitId?: unknown; date?: unknown; completed?: unknown } | null;
  const habitId = Number(body?.habitId);
  const date = typeof body?.date === "string" ? body.date : "";
  if (!Number.isSafeInteger(habitId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof body?.completed !== "boolean") {
    return Response.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const { data, error } = await auth.admin.rpc("set_watch_habit_completion", {
    target_user_id: auth.userId, target_habit_id: habitId, target_date: date, is_completed: body.completed,
  });
  if (error || data !== true) return Response.json({ error: "No se ha podido actualizar el hábito" }, { status: error ? 500 : 404 });
  return Response.json({ completed: body.completed });
}
