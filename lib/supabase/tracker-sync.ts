import type { RealtimeChannel } from "@supabase/supabase-js";
import type { TrackerState } from "../domain/tracker-state";
import { getSupabaseBrowserClient } from "./client";

export type RemoteTrackerState = { state: TrackerState | null; revision: number };
export type RealtimeSyncStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

export class TrackerSyncError extends Error {
  constructor(message: string, readonly conflict = false) {
    super(message);
    this.name = "TrackerSyncError";
  }
}

export async function fetchRemoteTrackerState(accessToken: string): Promise<RemoteTrackerState> {
  const response = await fetch(`/api/state?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${accessToken}`, "cache-control": "no-cache" },
  });
  if (!response.ok) throw new TrackerSyncError("No se pudo cargar la base de datos");
  return response.json() as Promise<RemoteTrackerState>;
}

export async function saveRemoteTrackerState(accessToken: string, base: TrackerState | null, state: TrackerState, expectedRevision: number) {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ base, state, expectedRevision }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    throw new TrackerSyncError(payload?.error ?? "No se pudo guardar", response.status === 409 && payload?.code === "STATE_CONFLICT");
  }
  return response.json() as Promise<{ revision: number }>;
}

export function subscribeToTrackerRevisions(
  userId: string,
  onRevision: (revision: number | null) => void,
  onStatus: (status: RealtimeSyncStatus) => void,
) {
  const supabase = getSupabaseBrowserClient();
  let disposed = false;
  const channel: RealtimeChannel = supabase
    .channel(`brujula-sync:${userId}`, { config: { private: true } })
    .on("broadcast", { event: "revision" }, (event) => {
      const payload = event.payload as {
        record?: { revision?: unknown };
        new?: { revision?: unknown };
      };
      const revision = Number(payload.record?.revision ?? payload.new?.revision);
      onRevision(Number.isSafeInteger(revision) ? revision : null);
    });

  void supabase.realtime.setAuth()
    .then(() => {
      if (!disposed) channel.subscribe((status) => onStatus(status as RealtimeSyncStatus));
    })
    .catch(() => {
      if (!disposed) onStatus("CHANNEL_ERROR");
    });

  return () => {
    disposed = true;
    void supabase.removeChannel(channel);
  };
}
