import { validateTrackerState, type ValidTrackerState } from "./state-validation";

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export type TrackerBackup = {
  application: "brujula";
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  state: ValidTrackerState;
};

export type BackupPreview = {
  backup: TrackerBackup;
  daily: number;
  weekly: number;
  goals: number;
  categories: number;
  motivations: number;
};

export function createTrackerBackup(state: ValidTrackerState, now = new Date()): TrackerBackup {
  return { application: "brujula", version: BACKUP_VERSION, exportedAt: now.toISOString(), state };
}

export function parseTrackerBackup(text: string): { success: true; preview: BackupPreview } | { success: false; error: string } {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) return { success: false, error: "La copia supera el límite de 10 MB" };
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { success: false, error: "El archivo no contiene JSON válido" }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { success: false, error: "El archivo no es una copia de Brújula" };
  const candidate = value as Partial<TrackerBackup>;
  if (candidate.application !== "brujula" || candidate.version !== BACKUP_VERSION || typeof candidate.exportedAt !== "string" || Number.isNaN(Date.parse(candidate.exportedAt))) {
    return { success: false, error: "El formato o la versión de la copia no son compatibles" };
  }
  const validated = validateTrackerState(candidate.state);
  if (!validated.success) return { success: false, error: validated.error };
  const backup = { ...candidate, state: validated.data } as TrackerBackup;
  return { success: true, preview: { backup, daily: backup.state.daily.length, weekly: backup.state.weekly.length, goals: backup.state.goals?.length ?? 0, categories: backup.state.categories.length, motivations: backup.state.motivations?.length ?? 0 } };
}
