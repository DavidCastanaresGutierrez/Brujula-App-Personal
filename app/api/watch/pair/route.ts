import { createPairingCode, getWatchAdminClient, hashWatchSecret } from "../../../../lib/watch/auth";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient(request);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return Response.json({ error: "Sesión no válida" }, { status: 401 });
  const admin = getWatchAdminClient();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createPairingCode();
    const result = await admin.from("watch_pairings").insert({
      code_hash: hashWatchSecret(code), user_id: data.user.id,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (!result.error) return Response.json({ code, expiresInSeconds: 600 });
  }
  return Response.json({ error: "No se ha podido generar el código" }, { status: 500 });
}
