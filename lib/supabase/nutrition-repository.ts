import { shiftDate, type Entry, type FrequentMeal, type Meal, type NutritionImport } from "../domain/nutrition";
import type { BodyDraft, NutritionGoals } from "../domain/nutrition-analysis";
import { getSupabaseBrowserClient } from "./client";
import { nutritionClient, type BodyComposition } from "./nutrition";

const nutrientColumns =
  "calories,protein,carbs,fat,fiber,sugars,saturated_fat,trans_fat,cholesterol,sodium,potassium,vitamin_a,vitamin_c,calcium,iron,salt";
const entryColumns = `id,date,type,name,quantity,unit,${nutrientColumns}`;
const frequentColumns = `id,type,name,unit,${nutrientColumns}`;
const bodyColumns =
  "id,recorded_at,weight,body_fat,muscle,fat_mass,lean_mass,body_water,bmi,basal_metabolic_rate,height_cm,imme,skeletal_muscle_mass";
// PostgREST returns at most 1000 rows per request; a year of meals exceeds it.
const pageSize = 1000;

// A rejected query from Supabase, as opposed to a network failure.
export class NutritionRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NutritionRepositoryError";
  }
}

function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new NutritionRepositoryError(result.error.message);
  return result.data;
}

export type NutritionData = {
  entries: Entry[];
  goals: NutritionGoals | null;
  frequent: FrequentMeal[];
  bodyEntries: BodyComposition[];
};

async function loadEntries(userId: string, today: string) {
  const rows: Entry[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = unwrap(
      await nutritionClient()
        .from("nutrition_entries")
        .select(entryColumns)
        .eq("user_id", userId)
        .gte("date", shiftDate(today, -365))
        .lte("date", today)
        .order("created_at")
        .order("id")
        .range(offset, offset + pageSize - 1),
    ) as unknown as Entry[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function loadNutritionData(userId: string, today: string): Promise<NutritionData> {
  const db = nutritionClient();
  const [entries, goals, frequent, bodyEntries] = await Promise.all([
    loadEntries(userId, today),
    db.from("nutrition_goals").select(nutrientColumns).eq("user_id", userId).maybeSingle().then(unwrap),
    db.from("frequent_meals").select(frequentColumns).eq("user_id", userId).order("name").then(unwrap),
    db.from("body_composition_entries").select(bodyColumns).eq("user_id", userId).order("recorded_at").then(unwrap),
  ]);
  return {
    entries,
    goals: goals as unknown as NutritionGoals | null,
    frequent: frequent as unknown as FrequentMeal[],
    bodyEntries: bodyEntries as unknown as BodyComposition[],
  };
}

export async function currentAccessToken() {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function saveEntry(userId: string, meal: Meal & { date: string }, editingId: string | null): Promise<Entry> {
  const db = nutritionClient();
  const row = { ...meal, user_id: userId };
  const result = editingId
    ? await db.from("nutrition_entries").update(row).eq("user_id", userId).eq("id", editingId).select().single()
    : await db.from("nutrition_entries").insert(row).select().single();
  return unwrap(result) as unknown as Entry;
}

export async function removeEntry(userId: string, id: string) {
  unwrap(await nutritionClient().from("nutrition_entries").delete().eq("user_id", userId).eq("id", id));
}

// Stable content keys make retries (including a lost response) idempotent, and a
// single PostgreSQL upsert is atomic: all rows or none. Returns the rows added.
export async function importEntries(userId: string, preview: NutritionImport) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(preview)));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const rows = preview.meals.map((meal, index) => ({
    ...meal,
    date: preview.date,
    user_id: userId,
    import_key: `${hash}:${index}`,
  }));
  const inserted = unwrap(
    await nutritionClient()
      .from("nutrition_entries")
      .upsert(rows, { onConflict: "user_id,import_key", ignoreDuplicates: true })
      .select("id"),
  );
  return inserted?.length ?? 0;
}

export type FrequentInsert = Pick<FrequentMeal, "name" | "type" | "unit" | "calories" | "protein" | "carbs" | "fat"> &
  Partial<Pick<FrequentMeal, "fiber" | "sugars" | "saturated_fat" | "salt">>;

export async function addFrequent(userId: string, food: FrequentInsert): Promise<FrequentMeal> {
  const result = await nutritionClient().from("frequent_meals").insert({ user_id: userId, ...food }).select().single();
  return unwrap(result) as unknown as FrequentMeal;
}

export async function updateFrequent(userId: string, id: string, food: Omit<FrequentMeal, "id">): Promise<FrequentMeal> {
  const result = await nutritionClient()
    .from("frequent_meals")
    .update(food)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single();
  return unwrap(result) as unknown as FrequentMeal;
}

export async function deleteFrequent(userId: string, id: string) {
  unwrap(await nutritionClient().from("frequent_meals").delete().eq("user_id", userId).eq("id", id));
}

export async function upsertGoals(userId: string, goals: NutritionGoals) {
  unwrap(await nutritionClient().from("nutrition_goals").upsert({ user_id: userId, ...goals }, { onConflict: "user_id" }));
}

export async function addBodyEntry(userId: string, draft: BodyDraft): Promise<BodyComposition> {
  const result = await nutritionClient()
    .from("body_composition_entries")
    .insert({ ...draft, user_id: userId })
    .select()
    .single();
  return unwrap(result) as unknown as BodyComposition;
}

export async function addBodyEntries(userId: string, drafts: BodyDraft[]): Promise<BodyComposition[]> {
  const result = await nutritionClient()
    .from("body_composition_entries")
    .insert(drafts.map((draft) => ({ ...draft, user_id: userId })))
    .select();
  return unwrap(result) as unknown as BodyComposition[];
}
