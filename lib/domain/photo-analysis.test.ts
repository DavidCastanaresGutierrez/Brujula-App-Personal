import { describe, expect, it } from "vitest";
import { buildVisionRequest, completionText, extractJsonObject, foodPhotoPrompt, parsePhotoMeals, resolveVisionProvider } from "./photo-analysis";

describe("vision provider resolution", () => {
  it("returns null without any key", () => expect(resolveVisionProvider({})).toBeNull());
  it("defaults to Groq with a free vision model", () => {
    const provider = resolveVisionProvider({ VISION_API_KEY: "k" });
    expect(provider).toMatchObject({ baseUrl: "https://api.groq.com/openai/v1", model: "meta-llama/llama-4-scout-17b-16e-instruct", apiKey: "k" });
  });
  it("accepts any OpenAI-compatible base URL and trims trailing slashes", () => {
    const provider = resolveVisionProvider({ VISION_API_KEY: "k", VISION_BASE_URL: "https://api.mistral.ai/v1/", VISION_MODEL: "mistral-small-latest" });
    expect(provider).toMatchObject({ name: "api.mistral.ai", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" });
  });
  it("keeps the previous Gemini configuration working", () => {
    expect(resolveVisionProvider({ GEMINI_API_KEY: "g" })).toMatchObject({ baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash" });
    expect(resolveVisionProvider({ GEMINI_API_KEY: "g", GEMINI_MODEL: "x" })?.model).toBe("x");
  });
  it("prefers the generic configuration over Gemini", () => {
    expect(resolveVisionProvider({ VISION_API_KEY: "k", GEMINI_API_KEY: "g" })?.name).toBe("api.groq.com");
  });
});

describe("vision request", () => {
  it("sends the photo inline with JSON mode and the meal type hint", () => {
    const provider = resolveVisionProvider({ VISION_API_KEY: "k" })!;
    const request = buildVisionRequest(provider, "image/jpeg", "QUJD", "dinner");
    expect(request.response_format).toEqual({ type: "json_object" });
    const content = request.messages[0].content;
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } });
    expect(content[0].text).toContain('"dinner"');
    expect(foodPhotoPrompt(null)).toContain("Elige type");
  });
});

describe("completion parsing", () => {
  it("reads string and multipart content", () => {
    expect(completionText({ choices: [{ message: { content: "hola" } }] })).toBe("hola");
    expect(completionText({ choices: [{ message: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] } }] })).toBe("ab");
    expect(completionText({})).toBe("");
  });
  it("extracts JSON wrapped in fences or prose", () => {
    expect(extractJsonObject('Aquí tienes:\n```json\n{"meals":[]}\n```')).toBe('{"meals":[]}');
    expect(() => extractJsonObject("sin json")).toThrow(SyntaxError);
  });
  it("normalises a model estimate into valid meals", () => {
    const meals = parsePhotoMeals('{"meals":[{"name":"Paella","type":"lunch","calories":"650.26","protein":22,"carbs":80,"fat":18.5,"fiber":3,"sugars":-2,"quantity":3,"unit":"g"}]}', null);
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ name: "Paella", type: "lunch", quantity: 1, unit: "serving", calories: 650.3, sugars: 0, salt: 0 });
  });
  it("forces the requested meal type and falls back to other", () => {
    expect(parsePhotoMeals('{"meals":[{"name":"Café","type":"lunch","calories":5,"protein":0,"carbs":1,"fat":0}]}', "breakfast")[0].type).toBe("breakfast");
    expect(parsePhotoMeals('{"meals":[{"name":"Café","type":"Desayuno","calories":5,"protein":0,"carbs":1,"fat":0}]}', null)[0].type).toBe("other");
  });
  it("explains empty or broken answers", () => {
    expect(() => parsePhotoMeals('{"meals":[]}', null)).toThrow("No se ha detectado comida");
    expect(() => parsePhotoMeals("no es json", null)).toThrow("interpretar");
    expect(() => parsePhotoMeals('{"meals":[{"type":"lunch","calories":5,"protein":0,"carbs":1,"fat":0}]}', null)).toThrow("name");
  });
});
