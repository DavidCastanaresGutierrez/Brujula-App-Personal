import { validateTrackerState, type ValidTrackerState } from "./state-validation";

export function parseStoredTrackerState(value: string | null): ValidTrackerState | null {
  if (!value) return null;
  try {
    const result = validateTrackerState(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseStoredStringSet(value: string | null): Set<string> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}
