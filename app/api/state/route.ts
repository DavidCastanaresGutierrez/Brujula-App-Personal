import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { habitStates } from "../../../db/schema";

function userEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
}

function validState(value: unknown): value is { daily: unknown[]; weekly: unknown[] } {
  if (!value || typeof value !== "object") return false;
  const state = value as { daily?: unknown; weekly?: unknown };
  return Array.isArray(state.daily) && Array.isArray(state.weekly);
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error de base de datos";
  if (message.includes("no such table")) {
    return "La tabla de hábitos todavía no está disponible.";
  }
  return message;
}

export async function GET(request: Request) {
  const email = userEmail(request);
  if (!email) return Response.json({ error: "Usuario no autenticado" }, { status: 401 });

  try {
    const db = await getDb();
    const row = await db.query.habitStates.findFirst({
      where: eq(habitStates.userEmail, email),
    });
    return Response.json({
      state: row ? JSON.parse(row.stateJson) : null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (error) {
    return Response.json({ error: databaseError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const email = userEmail(request);
  if (!email) return Response.json({ error: "Usuario no autenticado" }, { status: 401 });

  try {
    const state = await request.json();
    if (!validState(state)) {
      return Response.json({ error: "Estado de hábitos no válido" }, { status: 400 });
    }

    const stateJson = JSON.stringify(state);
    if (stateJson.length > 1_000_000) {
      return Response.json({ error: "Los datos superan el tamaño permitido" }, { status: 413 });
    }

    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db
      .insert(habitStates)
      .values({ userEmail: email, stateJson, updatedAt })
      .onConflictDoUpdate({
        target: habitStates.userEmail,
        set: { stateJson, updatedAt },
      });

    return Response.json({ ok: true, updatedAt });
  } catch (error) {
    return Response.json({ error: databaseError(error) }, { status: 500 });
  }
}
