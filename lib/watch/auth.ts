import { createHash, randomBytes, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const WATCH_TOKEN_BYTES = 32;

export function hashWatchSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createWatchToken() {
  return randomBytes(WATCH_TOKEN_BYTES).toString("base64url");
}

export function createPairingCode() {
  return String(randomInt(100_000, 1_000_000));
}

export function getWatchAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("La integración del reloj no está configurada.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function watchUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  const admin = getWatchAdminClient();
  const { data, error } = await admin
    .from("watch_devices")
    .select("id,user_id,revoked_at")
    .eq("token_hash", hashWatchSecret(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  await admin.from("watch_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return { admin, deviceId: data.id as string, userId: data.user_id as string };
}
