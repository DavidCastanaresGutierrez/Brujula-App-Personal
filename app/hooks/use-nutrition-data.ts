"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readNutritionCache, readNutritionOutbox, writeNutritionCache, writeNutritionOutbox } from "../../lib/browser/nutrition-offline";
import { appendOperation, applyOperation, applyOutbox, emptyNutritionData, type NutritionData, type NutritionOperation } from "../../lib/domain/nutrition-outbox";
import { executeOperation, isNetworkError, loadNutritionData, NutritionRepositoryError } from "../../lib/supabase/nutrition-repository";

export type CommitResult = "synced" | "queued";

// Loads the last year of nutrition data and keeps it usable without network: the
// last server snapshot is cached on the device and writes that cannot reach
// Supabase wait in an idempotent queue that is replayed when the connection returns.
export function useNutritionData(userId: string, today: string) {
  const [data, setData] = useState<NutritionData>(emptyNutritionData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const flushing = useRef(false);

  const setQueue = useCallback((items: ReturnType<typeof readNutritionOutbox>) => {
    writeNutritionOutbox(userId, items);
    setPendingCount(items.length);
  }, [userId]);

  const flush = useCallback(async () => {
    if (flushing.current || (typeof navigator !== "undefined" && !navigator.onLine)) return false;
    flushing.current = true;
    let sent = 0;
    try {
      let items = readNutritionOutbox(userId);
      while (items.length) {
        try {
          await executeOperation(userId, items[0].operation);
        } catch (cause) {
          if (isNetworkError(cause)) break;
          // The server rejected the change for good: dropping it beats blocking the queue.
          console.error("Nutrition change rejected while syncing", cause);
        }
        items = items.slice(1);
        sent += 1;
        setQueue(items);
      }
    } finally {
      flushing.current = false;
    }
    return sent > 0;
  }, [setQueue, userId]);

  useEffect(() => {
    let active = true;
    const queued = readNutritionOutbox(userId);
    const cached = readNutritionCache(userId);
    const restoreFromCache = () => {
      if (!cached) return false;
      setData(applyOutbox(cached, queued));
      setOffline(true);
      setLoading(false);
      return true;
    };
    queueMicrotask(() => {
      if (!active) return;
      setPendingCount(queued.length);
      if (!navigator.onLine && restoreFromCache()) return;
      flush()
        .then(() => loadNutritionData(userId, today))
        .then((fresh) => {
          if (!active) return;
          writeNutritionCache(userId, fresh);
          setData(applyOutbox(fresh, readNutritionOutbox(userId)));
          setOffline(false);
          setLoadError("");
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          if (isNetworkError(cause) && restoreFromCache()) return;
          setLoadError(
            cause instanceof NutritionRepositoryError
              ? `No se han podido cargar los datos nutricionales: ${cause.message}`
              : "No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.",
          );
        });
    });
    return () => {
      active = false;
    };
  }, [flush, userId, today, revision]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError("");
    setRevision((current) => current + 1);
  }, []);

  // Replays the queue as soon as the connection returns, then refreshes from the server.
  useEffect(() => {
    const sync = () => {
      if (!readNutritionOutbox(userId).length) return;
      void flush().then((sent) => sent && reload());
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [flush, reload, userId]);

  const commit = useCallback(async (operation: NutritionOperation): Promise<CommitResult> => {
    let result: CommitResult = "synced";
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      await executeOperation(userId, operation);
    } catch (cause) {
      if (!isNetworkError(cause)) throw cause;
      setQueue(appendOperation(readNutritionOutbox(userId), operation));
      result = "queued";
    }
    setData((current) => applyOperation(current, operation));
    return result;
  }, [setQueue, userId]);

  return { ...data, loading, loadError, offline, pendingCount, reload, commit, flush };
}
