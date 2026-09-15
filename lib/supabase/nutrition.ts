import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, FrequentMeal, Macros } from "../domain/nutrition";
import { getSupabaseBrowserClient } from "./client";

type Owned = { user_id: string; created_at: string; updated_at: string };
type EntryRow = Entry & Owned & { import_key: string | null };
type FrequentRow = FrequentMeal & Owned;
type GoalRow = Macros & Owned & { goal_mode: "fat_loss" | "maintenance" | "muscle_gain" | null };
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };
export type NutritionDatabase = { public: { Tables: {
  nutrition_entries: Table<EntryRow, Omit<EntryRow,"id" | "created_at" | "updated_at" | "import_key"> & Partial<Pick<EntryRow,"id" | "import_key">>>;
  frequent_meals: Table<FrequentRow, Omit<FrequentRow,"id" | "created_at" | "updated_at">>;
  nutrition_goals: Table<GoalRow, Macros & { user_id: string; goal_mode?: GoalRow["goal_mode"] }>;
}; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };

// Reuse the existing authenticated singleton; no second auth client or polling.
export function nutritionClient() {
  return getSupabaseBrowserClient() as unknown as SupabaseClient<NutritionDatabase>;
}
