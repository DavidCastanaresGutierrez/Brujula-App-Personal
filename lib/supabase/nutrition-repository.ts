import { shiftDate, type Entry, type FrequentMeal, type NutritionImport } from "../domain/nutrition";
import type { NutritionGoals } from "../domain/nutrition-analysis";
import { isNetworkFailureMessage, type NutritionData, type NutritionOperation } from "../domain/nutrition-outbox";
import { getSupabaseBrowserClient } from "./client";
import { nutritionClient, type BodyComposition } from "./nutrition";

export type { NutritionData } from "../domain/nutrition-outbox";

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

// The request never reached Supabase: no connection, DNS or a dropped socket.
export class NutritionNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NutritionNetworkError";
  }
}

export function isNetworkError(cause: unknown) {
  return cause instanceof NutritionNetworkError || cause instanceof TypeError;
}

function unwrap<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    if (isNetworkFailureMessage(result.error.message, result.error.code ?? "")) throw new NutritionNetworkError(result.error.message);
    throw new NutritionRepositoryError(result.error.message);
  }
  return result.data;
}

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

// Every write is an idempotent upsert or delete keyed by a client-generated id, so
// the same operation can be replayed from the offline queue without duplicates.
export async function executeOperation(userId: string, operation: NutritionOperation): Promise<void> {
  const db = nutritionClient();
  switch (operation.kind) {
    case "entry.save":
      unwrap(await db.from("nutrition_entries").upsert({ ...operation.entry, user_id: userId }, { onConflict: "id" }));
      return;
    case "entry.delete":
      unwrap(await db.from("nutrition_entries").delete().eq("user_id", userId).eq("id", operation.id));
      return;
    case "entries.import":
      await importEntries(userId, operation.preview);
      return;
    case "frequent.save":
      unwrap(await db.from("frequent_meals").upsert({ ...operation.food, user_id: userId }, { onConflict: "id" }));
      return;
    case "frequent.delete":
      unwrap(await db.from("frequent_meals").delete().eq("user_id", userId).eq("id", operation.id));
      return;
    case "goals.save":
      unwrap(await db.from("nutrition_goals").upsert({ user_id: userId, ...operation.goals }, { onConflict: "user_id" }));
      return;
    case "body.save":
      unwrap(
        await db
          .from("body_composition_entries")
          .upsert(operation.entries.map((entry) => ({ ...entry, user_id: userId })), { onConflict: "id" }),
      );
      return;
  }
}
