import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, FrequentMeal, Macros, NutritionDetails } from "../domain/nutrition";
import { getSupabaseBrowserClient } from "./client";

type Owned = { user_id: string; created_at: string; updated_at: string };
type EntryRow = Entry & Owned & { import_key: string | null };
type FrequentRow = FrequentMeal & Owned;
type FrequentInsert = Omit<FrequentRow, "id" | "created_at" | "updated_at" | keyof NutritionDetails> & Partial<NutritionDetails>;
type GoalRow = Macros & NutritionDetails & Owned & { goal_mode: "fat_loss" | "maintenance" | "muscle_gain" | null };
export type BodyComposition = { id: string; recorded_at: string; weight: number; body_fat: number; muscle: number; fat_mass: number | null; body_water: number | null; bmi: number | null; basal_metabolic_rate: number | null };
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };
export type NutritionDatabase = { public: { Tables: {
  nutrition_entries: Table<EntryRow, Omit<EntryRow,"id" | "created_at" | "updated_at" | "import_key"> & Partial<Pick<EntryRow,"id" | "import_key">>>;
  frequent_meals: Table<FrequentRow, FrequentInsert>;
  nutrition_goals: Table<GoalRow, Macros & NutritionDetails & { user_id: string; goal_mode?: GoalRow["goal_mode"] }>;
  body_composition_entries: Table<BodyComposition & Owned & { user_id: string }, Omit<BodyComposition & { user_id: string }, "id">>;
}; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };

// Reuse the existing authenticated singleton; no second auth client or polling.
export function nutritionClient() {
  return getSupabaseBrowserClient() as unknown as SupabaseClient<NutritionDatabase>;
}
