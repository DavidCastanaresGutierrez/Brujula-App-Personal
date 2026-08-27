import { createWatchToken, getWatchAdminClient, hashWatchSecret } from "../../../../lib/watch/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: unknown; name?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!/^\d{6}$/.test(code)) return Response.json({ error: "Código no válido" }, { status: 400 });
  const admin = getWatchAdminClient();
  const { data: pairing } = await admin.from("watch_pairings").select("id,user_id,expires_at,used_at")
    .eq("code_hash", hashWatchSecret(code)).maybeSingle();
  if (!pairing || pairing.used_at || new Date(pairing.expires_at).getTime() <= Date.now()) {
    return Response.json({ error: "Código caducado o no válido" }, { status: 401 });
  }
  const { data: claimed } = await admin.from("watch_pairings")
    .update({ used_at: new Date().toISOString() }).eq("id", pairing.id).is("used_at", null).select("id").maybeSingle();
  if (!claimed) return Response.json({ error: "Código ya utilizado" }, { status: 401 });
  const token = createWatchToken();
  const { error } = await admin.from("watch_devices").insert({
    user_id: pairing.user_id, token_hash: hashWatchSecret(token),
    name: typeof body?.name === "string" ? body.name.slice(0, 80) : "Galaxy Watch",
  });
  if (error) return Response.json({ error: "No se ha podido vincular el reloj" }, { status: 500 });
  return Response.json({ token });
}
