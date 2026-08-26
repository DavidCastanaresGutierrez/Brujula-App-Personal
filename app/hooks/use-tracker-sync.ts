"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import { belongsToActiveUser, decideRemoteRevision, shouldPullNotifiedRevision, shouldRetryPendingSave } from "../../lib/domain/sync";
import { parseStoredTrackerState, readStoredValue, writeStoredValue } from "../../lib/domain/storage";
import { trackerStatesEqual as statesEqual, type Category, type Goal, type Habit, type TrackerState, type WeeklyHabit } from "../../lib/domain/tracker-state";
import type { WeeklyReview } from "../../lib/domain/weekly-review";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { fetchRemoteTrackerState, saveRemoteTrackerState, subscribeToTrackerRevisions, TrackerSyncError } from "../../lib/supabase/tracker-sync";
import type { SyncStatusValue } from "../components/sync-status";

type NormalizedTrackerState = Required<TrackerState>;

const REMOTE_PULL_COOLDOWN_MS = 15_000;

type UseTrackerSyncOptions = {
  initialState: NormalizedTrackerState;
  fallbackMotivations: string[];
  normalizeState: (state: TrackerState) => NormalizedTrackerState;
};

export type TrackerSyncController = {
  daily: Habit[];
  setDaily: Dispatch<SetStateAction<Habit[]>>;
  weekly: WeeklyHabit[];
  setWeekly: Dispatch<SetStateAction<WeeklyHabit[]>>;
  habitCategories: Category[];
  setHabitCategories: Dispatch<SetStateAction<Category[]>>;
  motivations: string[];
  setMotivations: Dispatch<SetStateAction<string[]>>;
  goals: Goal[];
  setGoals: Dispatch<SetStateAction<Goal[]>>;
  weeklyReviews: WeeklyReview[];
  setWeeklyReviews: Dispatch<SetStateAction<WeeklyReview[]>>;
  hydrated: boolean;
  syncStatus: SyncStatusValue;
  session: Session | null;
  authReady: boolean;
  passwordRecovery: boolean;
  completePasswordRecovery: () => void;
  resolveConflictWithRemote: () => void;
  resolveConflictWithLocal: () => void;
};

export function useTrackerSync({ initialState, fallbackMotivations, normalizeState }: UseTrackerSyncOptions): TrackerSyncController {
  const [daily, setDaily] = useState(initialState.daily);
  const [weekly, setWeekly] = useState(initialState.weekly);
  const [habitCategories, setHabitCategories] = useState(initialState.categories);
  const [motivations, setMotivations] = useState(initialState.motivations);
  const [goals, setGoals] = useState(initialState.goals);
  const [weeklyReviews, setWeeklyReviews] = useState(initialState.weeklyReviews);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusValue>("loading");
  const [remoteConflict, setRemoteConflict] = useState<{ state: TrackerState; revision: number } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineRef = useRef<TrackerState | null>(null);
  const revisionRef = useRef(0);
  const conflictRef = useRef(false);
  const pendingRemoteRevisionRef = useRef<number | null>(null);
  const pullLatestRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const stateRef = useRef<TrackerState>(initialState);
  const syncInFlight = useRef(false);
  const pendingLocalSaveRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const syncGenerationRef = useRef(0);
  const lastRemotePullAtRef = useRef(0);

  const applyState = useCallback((state: TrackerState) => {
    const normalized = normalizeState(state);
    setDaily(normalized.daily);
    setWeekly(normalized.weekly);
    setHabitCategories(normalized.categories);
    setMotivations(normalized.motivations.length ? normalized.motivations : fallbackMotivations);
    setGoals(normalized.goals);
    setWeeklyReviews(normalized.weeklyReviews);
    return normalized;
  }, [fallbackMotivations, normalizeState]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      activeUserIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      activeUserIdRef.current = nextSession?.user.id ?? null;
      syncGenerationRef.current += 1;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      syncInFlight.current = false;
      pendingLocalSaveRef.current = false;
      setHydrated(false);
      setSyncStatus("loading");
      revisionRef.current = 0;
      conflictRef.current = false;
      pendingRemoteRevisionRef.current = null;
      setRemoteConflict(null);
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    stateRef.current = { daily, weekly, categories: habitCategories, motivations, goals, weeklyReviews };
  }, [daily, weekly, habitCategories, motivations, goals, weeklyReviews]);

  useEffect(() => {
    if (!authReady || !session) return;
    const accessToken = session.access_token;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    let cancelled = false;
    const localState = parseStoredTrackerState(readStoredValue(localStorage, storageKey)) as TrackerState | null;
    const localBaseline = parseStoredTrackerState(readStoredValue(localStorage, baselineKey)) as TrackerState | null;
    const storedRevision = Number(readStoredValue(localStorage, revisionKey));

    async function loadState() {
      try {
        const payload = await fetchRemoteTrackerState(accessToken);
        lastRemotePullAtRef.current = Date.now();
        const hasPendingLocalChanges = Boolean(localState && (!localBaseline || !statesEqual(localState, localBaseline)));
        const remoteChangedSinceLocalBaseline = !Number.isSafeInteger(storedRevision) || payload.revision > storedRevision;
        const hasStartupConflict = Boolean(payload.state && localState && hasPendingLocalChanges && remoteChangedSinceLocalBaseline);
        const state = hasPendingLocalChanges && localState ? localState : (payload.state ?? localState);
        if (cancelled) return;
        if (state) {
          applyState(state);
          const savedMotivations = (state.motivations?.length ? state.motivations : localState?.motivations)?.filter((item) => item.trim()) ?? [];
          setMotivations(savedMotivations.length ? savedMotivations : fallbackMotivations);
        }
        baselineRef.current = payload.state ? normalizeState(payload.state) : null;
        revisionRef.current = payload.revision;
        writeStoredValue(localStorage, baselineKey, JSON.stringify(baselineRef.current));
        writeStoredValue(localStorage, revisionKey, String(payload.revision));
        if (hasStartupConflict && payload.state) {
          conflictRef.current = true;
          setRemoteConflict({ state: normalizeState(payload.state), revision: payload.revision });
          setSyncStatus("conflict");
        } else {
          conflictRef.current = false;
          setRemoteConflict(null);
          setSyncStatus("synced");
        }
      } catch {
        if (!cancelled && localState) applyState(localState);
        if (!cancelled) setSyncStatus(navigator.onLine ? "error" : "offline");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    void loadState();
    return () => { cancelled = true; };
  }, [applyState, authReady, fallbackMotivations, normalizeState, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const savingUserId = session.user.id;
    const storageKey = `brujula-state-v1:${savingUserId}`;
    const baselineKey = `brujula-baseline-v2:${savingUserId}`;
    const revisionKey = `brujula-revision-v1:${savingUserId}`;
    const state = { daily, weekly, categories: habitCategories, motivations, goals, weeklyReviews };
    writeStoredValue(localStorage, storageKey, JSON.stringify(state));
    if (statesEqual(state, baselineRef.current) || conflictRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (syncInFlight.current) {
        pendingLocalSaveRef.current = true;
        return;
      }
      syncInFlight.current = true;
      const syncGeneration = syncGenerationRef.current;
      setSyncStatus("saving");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw sessionError ?? new Error("La sesión ha caducado");
        if (!belongsToActiveUser(savingUserId, data.session.user.id) || !belongsToActiveUser(savingUserId, activeUserIdRef.current)) return;
        const snapshot = stateRef.current;
        const payload = await saveRemoteTrackerState(data.session.access_token, baselineRef.current, snapshot, revisionRef.current);
        if (!belongsToActiveUser(savingUserId, activeUserIdRef.current)) return;
        baselineRef.current = snapshot;
        revisionRef.current = payload.revision;
        writeStoredValue(localStorage, baselineKey, JSON.stringify(snapshot));
        writeStoredValue(localStorage, revisionKey, String(payload.revision));
        setSyncStatus("synced");
      } catch (error) {
        if (belongsToActiveUser(savingUserId, activeUserIdRef.current)) {
          if (error instanceof TrackerSyncError && error.conflict) {
            conflictRef.current = true;
            setSyncStatus("conflict");
          } else setSyncStatus(navigator.onLine ? "error" : "offline");
        }
      } finally {
        if (syncGeneration !== syncGenerationRef.current) return;
        syncInFlight.current = false;
        if (!belongsToActiveUser(savingUserId, activeUserIdRef.current)) return;
        const shouldRetry = shouldRetryPendingSave(pendingLocalSaveRef.current, !statesEqual(stateRef.current, baselineRef.current), conflictRef.current);
        pendingLocalSaveRef.current = false;
        if (shouldRetry) setDaily((items) => [...items]);
        if (pendingRemoteRevisionRef.current !== null) {
          pendingRemoteRevisionRef.current = null;
          void pullLatestRef.current?.(true);
        }
      }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [daily, weekly, habitCategories, motivations, goals, weeklyReviews, hydrated, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const retry = () => {
      if (document.visibilityState === "visible" || navigator.onLine) setDaily((items) => [...items]);
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [hydrated, session]);

  useEffect(() => {
    if (!hydrated || !session) return;
    let cancelled = false;
    let pulling = false;
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;

    const pullLatest = async (force = false) => {
      if (pulling || !navigator.onLine) return;
      if (!force && Date.now() - lastRemotePullAtRef.current < REMOTE_PULL_COOLDOWN_MS) return;
      if (syncInFlight.current) {
        pendingRemoteRevisionRef.current = Math.max(pendingRemoteRevisionRef.current ?? 0, revisionRef.current + 1);
        return;
      }
      pulling = true;
      lastRemotePullAtRef.current = Date.now();
      pendingRemoteRevisionRef.current = null;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const payload = await fetchRemoteTrackerState(data.session.access_token).catch(() => null);
        if (!payload || cancelled || !payload.state) return;
        const serverState = normalizeState(payload.state);
        const localState = stateRef.current;
        const hasPendingLocalChanges = !statesEqual(localState, baselineRef.current);
        const action = decideRemoteRevision(revisionRef.current, payload.revision, hasPendingLocalChanges);
        if (action === "ignore") {
          if (!hasPendingLocalChanges && !conflictRef.current) setSyncStatus("synced");
          return;
        }
        if (action === "conflict") {
          conflictRef.current = true;
          setRemoteConflict({ state: serverState, revision: payload.revision });
          setSyncStatus("conflict");
          return;
        }
        baselineRef.current = serverState;
        revisionRef.current = payload.revision;
        writeStoredValue(localStorage, baselineKey, JSON.stringify(serverState));
        writeStoredValue(localStorage, revisionKey, String(payload.revision));
        writeStoredValue(localStorage, storageKey, JSON.stringify(serverState));
        applyState(serverState);
        conflictRef.current = false;
        setRemoteConflict(null);
        setSyncStatus("synced");
      } finally {
        pulling = false;
      }
    };
    pullLatestRef.current = pullLatest;
    const onFocus = () => { if (document.visibilityState === "visible") void pullLatest(); };
    const onPageShow = () => void pullLatest();
    const unsubscribeRealtime = subscribeToTrackerRevisions(session.user.id, (notifiedRevision) => {
      if (!shouldPullNotifiedRevision(revisionRef.current, notifiedRevision)) return;
      if (notifiedRevision !== null) pendingRemoteRevisionRef.current = Math.max(pendingRemoteRevisionRef.current ?? 0, notifiedRevision);
      if (!syncInFlight.current) void pullLatest(true);
    }, (status) => {
      if (cancelled) return;
      if (status === "SUBSCRIBED") {
        setSyncStatus((current) => current === "conflict" || current === "saving" ? current : "synced");
        void pullLatest();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncStatus((current) => current === "conflict" || current === "saving" ? current : navigator.onLine ? "error" : "offline");
      }
    });
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onPageShow);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onPageShow);
      document.removeEventListener("visibilitychange", onFocus);
      pullLatestRef.current = null;
      unsubscribeRealtime();
    };
  }, [applyState, hydrated, normalizeState, session]);

  const resolveConflictWithRemote = () => {
    if (!session || !remoteConflict) return;
    const nextState = normalizeState(remoteConflict.state);
    const storageKey = `brujula-state-v1:${session.user.id}`;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    baselineRef.current = nextState;
    revisionRef.current = remoteConflict.revision;
    conflictRef.current = false;
    pendingRemoteRevisionRef.current = null;
    writeStoredValue(localStorage, storageKey, JSON.stringify(nextState));
    writeStoredValue(localStorage, baselineKey, JSON.stringify(nextState));
    writeStoredValue(localStorage, revisionKey, String(remoteConflict.revision));
    applyState(nextState);
    setRemoteConflict(null);
    setSyncStatus("synced");
  };

  const resolveConflictWithLocal = () => {
    if (!session || !remoteConflict) return;
    const baselineKey = `brujula-baseline-v2:${session.user.id}`;
    const revisionKey = `brujula-revision-v1:${session.user.id}`;
    baselineRef.current = normalizeState(remoteConflict.state);
    revisionRef.current = remoteConflict.revision;
    conflictRef.current = false;
    writeStoredValue(localStorage, baselineKey, JSON.stringify(baselineRef.current));
    writeStoredValue(localStorage, revisionKey, String(remoteConflict.revision));
    setRemoteConflict(null);
    setSyncStatus("saving");
    setDaily((items) => [...items]);
  };

  return {
    daily, setDaily, weekly, setWeekly, habitCategories, setHabitCategories, motivations, setMotivations,
    goals, setGoals, weeklyReviews, setWeeklyReviews, hydrated, syncStatus, session, authReady,
    passwordRecovery, completePasswordRecovery: () => setPasswordRecovery(false),
    resolveConflictWithRemote, resolveConflictWithLocal,
  };
}
