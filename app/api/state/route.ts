import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { isValidStateRevision, validateTrackerState, type ValidTrackerState } from "../../../lib/domain/state-validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

type CategoryRow = {
  id: string;
  label: string;
  icon: string;
  color: string;
  position: number;
  priority: boolean;
};

type HabitRow = {
  id: number;
  category_id: string;
  kind: "daily" | "weekly";
  name: string;
  goal: number;
  color: string;
  position: number;
  archived: boolean;
  archived_at: string | null;
  misses: Record<string, number[]> | null;
  skips: Record<string, number[]> | null;
  every_day: boolean;
  weekdays_only: boolean;
  schedule: Record<string, unknown> | null;
  celebrated_streak_30: string | null;
};

type CompletionRow = {
  habit_id: number;
  period_key: string;
  value: number;
};

type MotivationRow = { text: string; position: number };

type GoalRow = {
  id: number;
  title: string;
  category_id: string;
  period: "daily" | "weekly" | "monthly" | "yearly";
  period_key: string;
  measurement: "complete" | "quantity";
  target_value: number;
  current_value: number;
  unit: string | null;
  status: "active" | "completed" | "discarded";
  due_date: string;
  position: number;
  linked_habit_id: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type TrackerState = ValidTrackerState;

async function applyStateChanges(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  next: TrackerState,
  base: TrackerState | undefined,
  expectedRevision: number,
) {
  const { data, error } = await supabase.rpc("apply_tracker_state_changes", {
    payload: next,
    baseline: base ?? null,
    expected_revision: expectedRevision,
  });
  if (error) throw error;
  return Number(data);
}

function errorResponse(error: unknown) {
  console.error("State API operation failed", error);
  return Response.json({ error: "No se ha podido completar la operación" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return Response.json({ error: "Sesión no válida" }, { status: 401 });

    let snapshot: Awaited<ReturnType<typeof readStateSnapshot>> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = await readStateSnapshot(supabase);
      if (candidate.revisionBefore === candidate.revisionAfter) {
        snapshot = candidate;
        break;
      }
    }
    if (!snapshot) throw new Error("El estado cambió durante la lectura");

    const { categoriesResult, habitsResult, completionsResult, motivationsResult, goalsResult, versionResult } = snapshot;

    // La tabla de frases se incorpora de forma progresiva. Los hábitos deben seguir
    // cargando aunque el despliegue llegue antes que la migración de Supabase.
    const databaseError = categoriesResult.error ?? habitsResult.error ?? completionsResult.error ?? goalsResult.error ?? versionResult.error;
    if (databaseError) throw databaseError;

    const categories = (categoriesResult.data as CategoryRow[]).map((category) => ({
      id: category.id,
      label: category.label,
      icon: category.icon,
      color: category.color,
      priority: category.priority || undefined,
    }));
    const completions = completionsResult.data as CompletionRow[];
    const historyByHabit = new Map<number, Record<string, number[]>>();

    completions.forEach((completion) => {
      const history = historyByHabit.get(completion.habit_id) ?? {};
      history[completion.period_key] = [...(history[completion.period_key] ?? []), completion.value]
        .sort((a, b) => a - b);
      historyByHabit.set(completion.habit_id, history);
    });

    const mapHabit = (habit: HabitRow) => ({
      id: Number(habit.id),
      name: habit.name,
      goal: habit.goal,
      color: habit.color,
      checks: [],
      archived: habit.archived || undefined,
      archivedAt: habit.archived_at ?? undefined,
      misses: habit.misses ?? undefined,
      skips: habit.skips ?? undefined,
      everyDay: habit.kind === "daily" ? habit.every_day : undefined,
      weekdaysOnly: habit.kind === "daily" ? habit.weekdays_only : undefined,
      schedule: habit.kind === "daily" ? habit.schedule ?? undefined : undefined,
      history: historyByHabit.get(Number(habit.id)) ?? {},
      category: habit.category_id,
      celebratedStreak30: habit.celebrated_streak_30 ?? undefined,
    });

    const habits = habitsResult.data as HabitRow[];
    const goals = ((goalsResult.data ?? []) as GoalRow[]).map((goal) => ({
      id: Number(goal.id), title: goal.title, category: goal.category_id, period: goal.period,
      periodKey: goal.period_key, measurement: goal.measurement, targetValue: goal.target_value,
      currentValue: goal.current_value, unit: goal.unit ?? "", status: goal.status, dueDate: goal.due_date,
      linkedHabitId: undefined,
      template: goal.metadata?.template ?? undefined,
      linkedHabitIds: Array.isArray(goal.metadata?.linkedHabitIds)
        ? goal.metadata.linkedHabitIds.map(Number)
        : goal.linked_habit_id ? [Number(goal.linked_habit_id)] : [],
      trackingStart: typeof goal.metadata?.trackingStart === "string" ? goal.metadata.trackingStart : goal.created_at.slice(0, 10),
      books: goal.metadata?.books ?? [],
      fitnessEntries: goal.metadata?.fitnessEntries ?? [],
      parentAnnualGoalId: goal.metadata?.parentAnnualGoalId ? Number(goal.metadata.parentAnnualGoalId) : undefined,
      archived: Boolean(goal.metadata?.archived),
    }));
    const state = habits.length || categories.length || goals.length
      ? {
          daily: habits.filter((habit) => habit.kind === "daily").map(mapHabit),
          weekly: habits.filter((habit) => habit.kind === "weekly").map(mapHabit),
          categories,
          motivations: ((motivationsResult.data ?? []) as MotivationRow[]).map((item) => item.text),
          goals,
        }
      : ((motivationsResult.data ?? []) as MotivationRow[]).length
        ? { daily: [], weekly: [], categories: [], motivations: ((motivationsResult.data ?? []) as MotivationRow[]).map((item) => item.text), goals }
        : null;

    return Response.json({ state, revision: Number(versionResult.data?.revision ?? 0) }, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

async function readStateSnapshot(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const versionBeforeResult = await supabase.from("tracker_state_versions").select("revision").maybeSingle();
  if (versionBeforeResult.error) throw versionBeforeResult.error;

  const [categoriesResult, habitsResult, completionsResult, motivationsResult, goalsResult] = await Promise.all([
    supabase.from("categories").select("id,label,icon,color,position,priority").order("position"),
    supabase.from("habits").select("id,category_id,kind,name,goal,color,position,archived,archived_at,misses,skips,every_day,weekdays_only,schedule,celebrated_streak_30").order("position"),
    supabase.from("habit_completions").select("habit_id,period_key,value"),
    supabase.from("motivational_quotes").select("text,position").order("position"),
    supabase.from("goals").select("id,title,category_id,period,period_key,measurement,target_value,current_value,unit,status,due_date,position,linked_habit_id,metadata,created_at").order("position"),
  ]);

  const versionResult = await supabase.from("tracker_state_versions").select("revision").maybeSingle();
  if (versionResult.error) throw versionResult.error;

  return {
    categoriesResult,
    habitsResult,
    completionsResult,
    motivationsResult,
    goalsResult,
    versionResult,
    revisionBefore: Number(versionBeforeResult.data?.revision ?? 0),
    revisionAfter: Number(versionResult.data?.revision ?? 0),
  };
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return Response.json({ error: "Sesión no válida" }, { status: 401 });
    const rawBody = await request.text();
    if (rawBody.length > 1_000_000) {
      return Response.json({ error: "Los datos superan el tamaño permitido" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "El contenido enviado no es JSON válido" }, { status: 400 });
    }
    const envelope = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const stateResult = validateTrackerState(envelope.state ?? body);
    if (!stateResult.success) return Response.json({ error: stateResult.error }, { status: 400 });
    const baseResult = envelope.base === undefined ? undefined : validateTrackerState(envelope.base);
    if (baseResult && !baseResult.success) return Response.json({ error: `Estado base no válido: ${baseResult.error}` }, { status: 400 });
    const expectedRevision = envelope.expectedRevision;
    if (!isValidStateRevision(expectedRevision)) {
      return Response.json({ error: "La revisión del estado no es válida" }, { status: 400 });
    }

    const revision = await applyStateChanges(supabase, stateResult.data, baseResult?.data, Number(expectedRevision));
    return Response.json(
      { ok: true, revision, updatedAt: new Date().toISOString() },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "40001") {
      return Response.json(
        { error: "Hay cambios más recientes en otro dispositivo", code: "STATE_CONFLICT" },
        { status: 409, headers: noStoreHeaders },
      );
    }
    return errorResponse(error);
  }
}
