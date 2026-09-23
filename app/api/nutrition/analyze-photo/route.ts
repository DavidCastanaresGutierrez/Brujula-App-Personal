import { parseNutrition, type Meal } from "../../../../lib/domain/nutrition";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumPhotoBytes = 4 * 1024 * 1024;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

const nutritionPrompt = `Analiza esta foto de comida para una aplicación personal de nutrición. Devuelve exclusivamente JSON válido con esta forma:
{"meals":[{"name":"...","type":"breakfast|mid_morning|lunch|snack|dinner|other","quantity":1,"unit":"serving","calories":0,"protein":0,"carbs":0,"fat":0}]}

Separa los componentes principales solo cuando sea útil para que la persona pueda corregirlos. Cada objeto es una ración completa: usa quantity 1 y unit "serving"; las calorías y macronutrientes son el total estimado de esa ración. Usa números no negativos, sin texto adicional. Si no hay comida identificable, devuelve {"meals":[]}. No inventes ingredientes que no sean visibles.`;

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
    if (!acceptedImageTypes.has(photo.type))
      return error("Usa una imagen JPG, PNG o WEBP.", 400);
    if (!photo.size || photo.size > maximumPhotoBytes)
      return error("La foto debe pesar como máximo 4 MB.", 400);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return error("El análisis de fotos aún no está configurado.", 503);

    const imageData = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: photo.type, data: imageData } },
                { text: nutritionPrompt },
              ],
            },
          ],
          generationConfig: { response_mime_type: "application/json" },
        }),
      },
    );
    if (!response.ok) {
      if (response.status === 429)
        return error("Has alcanzado el límite de análisis. Prueba de nuevo más tarde.", 429);
      return error("No se ha podido analizar la foto. Inténtalo de nuevo.", 502);
    }

    const result = (await response.json()) as GeminiResponse;
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");
    if (!text) return error("No se ha podido interpretar la foto.", 422);

    const parsed = JSON.parse(text) as { meals?: unknown };
    const valid = parseNutrition(
      JSON.stringify({ schema_version: 1, date: "2026-01-01", meals: parsed.meals }),
    );
    return Response.json({ meals: valid.meals as Meal[] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof SyntaxError)
      return error("No se ha podido interpretar la respuesta de la foto.", 422);
    if (cause instanceof Error && cause.message === "Usuario no autenticado")
      return error("Sesión no válida", 401);
    return error("No se ha podido analizar la foto. Inténtalo de nuevo.", 500);
  }
}
