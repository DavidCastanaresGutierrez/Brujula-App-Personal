import { mealTypes, parseNutrition, type Meal } from "./nutrition";

export type VisionProvider = { name: string; baseUrl: string; apiKey: string; model: string };

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

// Any service that speaks the OpenAI chat-completions format works: Groq, Mistral,
// OpenRouter, Gemini or a local server. The free tiers of Groq, Mistral and OpenRouter
// cover a personal app; Gemini keeps working through its OpenAI-compatible endpoint.
export function resolveVisionProvider(env: Record<string, string | undefined>): VisionProvider | null {
  const apiKey = env.VISION_API_KEY?.trim();
  if (apiKey) {
    const baseUrl = (env.VISION_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
    return { name: new URL(baseUrl).hostname, baseUrl, apiKey, model: env.VISION_MODEL?.trim() || DEFAULT_MODEL };
  }
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return { name: "generativelanguage.googleapis.com", baseUrl: GEMINI_BASE_URL, apiKey: geminiKey, model: env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL };
  }
  return null;
}

export type MealType = keyof typeof mealTypes;
export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && Object.hasOwn(mealTypes, value);
}

export function foodPhotoPrompt(mealType: MealType | null) {
  const typeRule = mealType
    ? `Usa siempre "${mealType}" como type.`
    : `Elige type entre breakfast, mid_morning, lunch, snack, dinner u other según el plato.`;
  return `Eres un nutricionista. Analiza esta foto de comida para un registro personal y devuelve exclusivamente un objeto JSON con esta forma:
{"meals":[{"name":"...","type":"lunch","quantity":1,"unit":"serving","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugars":0,"saturated_fat":0,"salt":0}]}

Reglas:
- Nombres cortos en español.
- Separa en varias comidas solo los componentes claramente distintos (por ejemplo plato principal y postre); si no, devuelve una sola.
- Cada objeto es la ración completa que se ve en la foto: quantity 1 y unit "serving". Calorías en kcal y el resto en gramos, como totales estimados de esa ración.
- ${typeRule}
- Solo números no negativos. Si un dato no se puede estimar, usa 0.
- Si la imagen no contiene comida, devuelve {"meals":[]}.
Sin texto fuera del JSON.`;
}

export function buildVisionRequest(provider: VisionProvider, mimeType: string, base64: string, mealType: MealType | null) {
  return {
    model: provider.model,
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: foodPhotoPrompt(mealType) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  };
}

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> | null } }>;
};

export function completionText(payload: unknown): string {
  const content = (payload as ChatCompletion)?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part?.text ?? "").join("");
  return "";
}

// Models sometimes wrap the JSON in Markdown fences or add a sentence around it.
export function extractJsonObject(text: string) {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("No JSON object in model output");
  return unfenced.slice(start, end + 1);
}

export class PhotoAnalysisError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PhotoAnalysisError";
  }
}

export function parsePhotoMeals(text: string, mealType: MealType | null): Meal[] {
  let parsed: { meals?: unknown };
  try {
    parsed = JSON.parse(extractJsonObject(text)) as { meals?: unknown };
  } catch {
    throw new PhotoAnalysisError("No se ha podido interpretar la respuesta del análisis. Inténtalo de nuevo.", 422);
  }
  if (!Array.isArray(parsed.meals) || !parsed.meals.length) {
    throw new PhotoAnalysisError("No se ha detectado comida en la foto.", 422);
  }
  const meals = parsed.meals.slice(0, 20).map((item) => {
    const meal = item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : {};
    if (mealType) meal.type = mealType;
    else if (!isMealType(meal.type)) meal.type = "other";
    meal.quantity = 1;
    meal.unit = "serving";
    for (const key of ["calories", "protein", "carbs", "fat", "fiber", "sugars", "saturated_fat", "salt"]) {
      const value = Number(meal[key]);
      meal[key] = Number.isFinite(value) && value >= 0 ? Math.round(value * 10) / 10 : 0;
    }
    return meal;
  });
  try {
    return parseNutrition(JSON.stringify({ schema_version: 1, date: "2026-01-01", meals })).meals;
  } catch (cause) {
    throw new PhotoAnalysisError(
      `La estimación recibida no es válida: ${cause instanceof Error ? cause.message : "formato desconocido"}`,
      422,
    );
  }
}
