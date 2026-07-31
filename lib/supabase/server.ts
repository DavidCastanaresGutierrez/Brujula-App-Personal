import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !anonKey) throw new Error("Supabase no está configurado en este entorno.");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Usuario no autenticado");

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
