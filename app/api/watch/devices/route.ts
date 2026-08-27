import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { getWatchAdminClient } from "../../../../lib/watch/auth";

export const dynamic = "force-dynamic";

async function authenticatedUser(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return Response.json({ error: "Sesión no válida" }, { status: 401 });

  const { data, error } = await getWatchAdminClient()
    .from("watch_devices")
    .select("id,name,created_at,last_seen_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "No se han podido cargar los relojes" }, { status: 500 });
  return Response.json({ devices: data ?? [] });
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return Response.json({ error: "Sesión no válida" }, { status: 401 });

  const body = await request.json().catch(() => null) as { deviceId?: unknown } | null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(deviceId)) {
    return Response.json({ error: "Dispositivo no válido" }, { status: 400 });
  }

  const { data, error } = await getWatchAdminClient()
    .from("watch_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return Response.json({ error: "No se ha podido desvincular el reloj" }, { status: 500 });
  if (!data) return Response.json({ error: "Reloj no encontrado" }, { status: 404 });
  return Response.json({ success: true });
}
