import type { BodyComposition, Entry, FrequentMeal, NutritionImport } from "./nutrition";
import type { NutritionGoals } from "./nutrition-analysis";

export type NutritionData = {
  entries: Entry[];
  goals: NutritionGoals | null;
  frequent: FrequentMeal[];
  bodyEntries: BodyComposition[];
};

// Every operation is idempotent on the server (upsert by id, delete by id, upsert
// by user) so a replay after a lost response never duplicates data.
export type NutritionOperation =
  | { kind: "entry.save"; entry: Entry }
  | { kind: "entry.delete"; id: string }
  | { kind: "entries.import"; preview: NutritionImport }
  | { kind: "frequent.save"; food: FrequentMeal }
  | { kind: "frequent.delete"; id: string }
  | { kind: "goals.save"; goals: NutritionGoals }
  | { kind: "body.save"; entries: BodyComposition[] };

export type OutboxItem = { id: string; createdAt: string; operation: NutritionOperation };

export const emptyNutritionData = (): NutritionData => ({ entries: [], goals: null, frequent: [], bodyEntries: [] });

export function parseOutbox(raw: string | null): OutboxItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OutboxItem =>
        !!item && typeof item === "object" && typeof (item as OutboxItem).id === "string" && typeof (item as OutboxItem).operation?.kind === "string",
    );
  } catch {
    return [];
  }
}

// Keeps the queue minimal: a later save of the same row replaces the earlier one
// and a delete drops the pending saves of that row. Deleting a row that never
// reached the server is harmless, so the delete itself is always kept.
export function appendOperation(items: OutboxItem[], operation: NutritionOperation, now = new Date()): OutboxItem[] {
  const kept = items.filter(({ operation: previous }) => {
    if (operation.kind === "entry.save" || operation.kind === "entry.delete") {
      const id = operation.kind === "entry.save" ? operation.entry.id : operation.id;
      return !(previous.kind === "entry.save" && previous.entry.id === id);
    }
    if (operation.kind === "frequent.save" || operation.kind === "frequent.delete") {
      const id = operation.kind === "frequent.save" ? operation.food.id : operation.id;
      return !(previous.kind === "frequent.save" && previous.food.id === id);
    }
    if (operation.kind === "goals.save") return previous.kind !== "goals.save";
    return true;
  });
  return [...kept, { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now.toISOString(), operation }];
}

export function applyOperation(data: NutritionData, operation: NutritionOperation): NutritionData {
  switch (operation.kind) {
    case "entry.save":
      return {
        ...data,
        entries: data.entries.some((entry) => entry.id === operation.entry.id)
          ? data.entries.map((entry) => (entry.id === operation.entry.id ? operation.entry : entry))
          : [...data.entries, operation.entry],
      };
    case "entry.delete":
      return { ...data, entries: data.entries.filter((entry) => entry.id !== operation.id) };
    case "entries.import": {
      const stamp = `local-${operation.preview.date}-${JSON.stringify(operation.preview.meals).length}`;
      const imported = operation.preview.meals.map((meal, index) => ({ ...meal, id: `${stamp}-${index}`, date: operation.preview.date }));
      return { ...data, entries: [...data.entries.filter((entry) => !entry.id.startsWith(`${stamp}-`)), ...imported] };
    }
    case "frequent.save":
      return {
        ...data,
        frequent: [...data.frequent.filter((food) => food.id !== operation.food.id), operation.food].sort((a, b) => a.name.localeCompare(b.name, "es")),
      };
    case "frequent.delete":
      return { ...data, frequent: data.frequent.filter((food) => food.id !== operation.id) };
    case "goals.save":
      return { ...data, goals: operation.goals };
    case "body.save": {
      const ids = new Set(operation.entries.map((entry) => entry.id));
      return {
        ...data,
        bodyEntries: [...data.bodyEntries.filter((entry) => !ids.has(entry.id)), ...operation.entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
      };
    }
  }
}

export function applyOutbox(data: NutritionData, items: OutboxItem[]): NutritionData {
  return items.reduce((current, item) => applyOperation(current, item.operation), data);
}

// PostgREST reports a failed fetch with an empty code and the error name as prefix.
export function isNetworkFailureMessage(message: string, code = "") {
  return (code === "" && /^(TypeError|FetchError|AbortError):/.test(message)) || /Failed to fetch|NetworkError|Load failed|network/i.test(message);
}
