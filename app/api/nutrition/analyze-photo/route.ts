import {
  buildVisionRequest,
  completionText,
  isMealType,
  parsePhotoMeals,
  PhotoAnalysisError,
  resolveVisionProvider,
} from "../../../../lib/domain/photo-analysis";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vision models on free tiers can take well over the 10 s default.
export const maxDuration = 60;

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumPhotoBytes = 4 * 1024 * 1024;
const providerTimeoutMs = 50_000;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) return error("Sesión no válida", 401);

    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return error("Selecciona una foto de comida.", 400);
    if (!acceptedImageTypes.has(photo.type)) return error("Usa una imagen JPG, PNG o WEBP.", 400);
    if (!photo.size || photo.size > maximumPhotoBytes) return error("La foto debe pesar como máximo 4 MB.", 400);
    const requestedType = form.get("mealType");
    const mealType = isMealType(requestedType) ? requestedType : null;

    const provider = resolveVisionProvider(process.env);
    if (!provider) return error("El análisis de fotos aún no está configurado.", 503);

    const imageData = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify(buildVisionRequest(provider, photo.type, imageData, mealType)),
      signal: AbortSignal.timeout(providerTimeoutMs),
    });
    if (!response.ok) {
      console.error("Vision provider error", provider.name, provider.model, response.status, (await response.text()).slice(0, 500));
      if (response.status === 401 || response.status === 403) return error("El servicio de análisis rechaza la clave configurada.", 503);
      if (response.status === 404) return error(`El modelo ${provider.model} no existe en ${provider.name}.`, 503);
      if (response.status === 413) return error("El servicio de análisis rechaza la foto por tamaño.", 413);
      if (response.status === 429) return error("Has alcanzado el límite gratuito de análisis. Prueba de nuevo más tarde.", 429);
      return error("No se ha podido analizar la foto. Inténtalo de nuevo.", 502);
    }

    const text = completionText(await response.json());
    if (!text) return error("No se ha podido interpretar la foto.", 422);
    const meals = parsePhotoMeals(text, mealType);
    return Response.json({ meals, provider: provider.name, model: provider.model }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof PhotoAnalysisError) return error(cause.message, cause.status);
    if (cause instanceof Error && cause.name === "TimeoutError") return error("El análisis ha tardado demasiado. Inténtalo de nuevo.", 504);
    if (cause instanceof Error && cause.message === "Usuario no autenticado") return error("Sesión no válida", 401);
    console.error("Photo analysis failed", cause);
    return error("No se ha podido analizar la foto. Inténtalo de nuevo.", 500);
  }
}
