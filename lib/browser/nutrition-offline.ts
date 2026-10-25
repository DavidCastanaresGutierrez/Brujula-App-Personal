import { readStoredValue, writeStoredValue } from "../domain/storage";
import { parseOutbox, type NutritionData, type OutboxItem } from "../domain/nutrition-outbox";

const cacheKey = (userId: string) => `brujula-nutrition-cache-v1:${userId}`;
const outboxKey = (userId: string) => `brujula-nutrition-outbox-v1:${userId}`;

export function readNutritionCache(userId: string): NutritionData | null {
  const raw = readStoredValue(localStorage, cacheKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NutritionData>;
    if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.frequent) || !Array.isArray(parsed.bodyEntries)) return null;
    return { entries: parsed.entries, frequent: parsed.frequent, bodyEntries: parsed.bodyEntries, goals: parsed.goals ?? null };
  } catch {
    return null;
  }
}

export function writeNutritionCache(userId: string, data: NutritionData) {
  writeStoredValue(localStorage, cacheKey(userId), JSON.stringify(data));
}

export function readNutritionOutbox(userId: string): OutboxItem[] {
  return parseOutbox(readStoredValue(localStorage, outboxKey(userId)));
}

export function writeNutritionOutbox(userId: string, items: OutboxItem[]) {
  writeStoredValue(localStorage, outboxKey(userId), JSON.stringify(items));
}
