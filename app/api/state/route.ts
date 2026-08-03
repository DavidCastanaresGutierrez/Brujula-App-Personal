import { getSupabaseServerClient } from "../../../lib/supabase/server";

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
  every_day: boolean;
  weekdays_only: boolean;
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
  metadata: Record<string, unknown> | null;
};

function validState(value: unknown): value is {
  daily: unknown[];
  weekly: unknown[];
  categories: unknown[];
} {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return Array.isArray(state.daily)
    && Array.isArray(state.weekly)
    && Array.isArray(state.categories);
}

type TrackerState = {
  daily: Record<string, unknown>[];
  weekly: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  motivations?: string[];
  goals?: Record<string, unknown>[];
};

function habitsOf(state: TrackerState): Array<Record<string, unknown> & { kind: "daily" | "weekly" }> {
  return [
    ...state.daily.map((habit) => ({ ...habit, kind: "daily" as const })),
    ...state.weekly.map((habit) => ({ ...habit, kind: "weekly" as const })),
  ];
}

function changedRecords<T extends Record<string, unknown>>(before: T[], after: T[], key: keyof T) {
  const previous = new Map(before.map((item) => [String(item[key]), item]));
  return after.filter((item) => JSON.stringify(previous.get(String(item[key]))) !== JSON.stringify(item));
}

async function applyStateChanges(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  next: TrackerState,
  base?: TrackerState,
) {
  const nextHabits = habitsOf(next);
  const baseHabits = base ? habitsOf(base) : [];
  const nextHabitIds = new Set(nextHabits.map((habit) => Number(habit.id)));
  const nextCategoryIds = new Set(next.categories.map((category) => String(category.id)));
  const deletedHabitIds = baseHabits.filter((habit) => !nextHabitIds.has(Number(habit.id))).map((habit) => Number(habit.id));
  const deletedCategoryIds = (base?.categories ?? []).filter((category) => !nextCategoryIds.has(String(category.id))).map((category) => String(category.id));

  // Deletions are only accepted when the client proves the record existed in its
  // last synchronized baseline. A stale/empty device can therefore never wipe a user.
  if (deletedHabitIds.length) {
    const { error } = await supabase.from("habits").delete().eq("user_id", userId).in("id", deletedHabitIds);
    if (error) throw error;
  }

  const categories = changedRecords(base?.categories ?? [], next.categories, "id").map((category, position) => ({
    user_id: userId,
    id: String(category.id),
    label: String(category.label),
    icon: String(category.icon ?? "●"),
    color: String(category.color),
    position: next.categories.findIndex((item) => item.id === category.id) ?? position,
  }));
  if (categories.length) {
    const { error } = await supabase.from("categories").upsert(categories, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  const changedHabitIds = new Set(changedRecords(baseHabits, nextHabits, "id").map((habit) => String(habit.id)));
  nextHabits.forEach((habit, position) => {
    if (baseHabits.findIndex((item) => String(item.id) === String(habit.id)) !== position) {
      changedHabitIds.add(String(habit.id));
    }
  });
  const habits = nextHabits.filter((habit) => changedHabitIds.has(String(habit.id))).map((habit) => ({
    user_id: userId,
    id: Number(habit.id),
    category_id: String(habit.category),
    kind: habit.kind,
    name: String(habit.name),
    goal: Number(habit.goal),
    color: String(habit.color),
    position: nextHabits.findIndex((item) => String(item.id) === String(habit.id)),
    archived: Boolean(habit.archived),
    every_day: habit.kind === "daily" && Boolean(habit.everyDay),
    weekdays_only: habit.kind === "daily" && Boolean(habit.weekdaysOnly),
    celebrated_streak_30: habit.celebratedStreak30 ? String(habit.celebratedStreak30) : null,
  }));
  if (habits.length) {
    const { error } = await supabase.from("habits").upsert(habits, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  const completionKeys = (state: TrackerState) => new Set(habitsOf(state).flatMap((habit) =>
    Object.entries((habit.history ?? {}) as Record<string, number[]>).flatMap(([periodKey, values]) =>
      values.map((value) => `${habit.id}|${periodKey}|${value}`),
    ),
  ));
  const beforeCompletions = base ? completionKeys(base) : new Set<string>();
  const afterCompletions = completionKeys(next);
  const addedCompletions = [...afterCompletions].filter((key) => !beforeCompletions.has(key)).map((key) => {
    const [habitId, periodKey, value] = key.split("|");
    return { user_id: userId, habit_id: Number(habitId), period_key: periodKey, value: Number(value) };
  });
  const removedCompletions = [...beforeCompletions].filter((key) => !afterCompletions.has(key));
  if (addedCompletions.length) {
    const { error } = await supabase.from("habit_completions").upsert(addedCompletions, { onConflict: "user_id,habit_id,period_key,value" });
    if (error) throw error;
  }
  for (const key of removedCompletions) {
    const [habitId, periodKey, value] = key.split("|");
    const { error } = await supabase.from("habit_completions").delete()
      .eq("user_id", userId).eq("habit_id", Number(habitId)).eq("period_key", periodKey).eq("value", Number(value));
    if (error) throw error;
  }

  if (deletedCategoryIds.length) {
    const { error } = await supabase.from("categories").delete().eq("user_id", userId).in("id", deletedCategoryIds);
    if (error) throw error;
  }

  if (JSON.stringify(base?.motivations ?? []) !== JSON.stringify(next.motivations ?? [])) {
    const { error: deleteError } = await supabase.from("motivational_quotes").delete().eq("user_id", userId);
    if (deleteError) throw deleteError;
    const quotes = (next.motivations ?? []).map((text, position) => ({ user_id: userId, text, position }));
    if (quotes.length) {
      const { error: insertError } = await supabase.from("motivational_quotes").insert(quotes);
      if (insertError) throw insertError;
    }
  }

  const nextGoals = next.goals ?? [];
  const baseGoals = base?.goals ?? [];
  const nextGoalIds = new Set(nextGoals.map((goal) => Number(goal.id)));
  const deletedGoalIds = baseGoals.filter((goal) => !nextGoalIds.has(Number(goal.id))).map((goal) => Number(goal.id));
  if (deletedGoalIds.length) {
    const { error } = await supabase.from("goals").delete().eq("user_id", userId).in("id", deletedGoalIds);
    if (error) throw error;
  }
  const changedGoalIds = new Set(changedRecords(baseGoals, nextGoals, "id").map((goal) => String(goal.id)));
  nextGoals.forEach((goal, position) => {
    if (baseGoals.findIndex((item) => String(item.id) === String(goal.id)) !== position) changedGoalIds.add(String(goal.id));
  });
  const goals = nextGoals.filter((goal) => changedGoalIds.has(String(goal.id))).map((goal, position) => ({
    user_id: userId,
    id: Number(goal.id),
    title: String(goal.title),
    category_id: String(goal.category),
    period: String(goal.period),
    period_key: String(goal.periodKey),
    measurement: String(goal.measurement),
    target_value: Number(goal.targetValue ?? 1),
    current_value: Number(goal.currentValue ?? 0),
    unit: String(goal.unit ?? "") || null,
    status: String(goal.status ?? "active"),
    due_date: String(goal.dueDate),
    position: nextGoals.findIndex((item) => String(item.id) === String(goal.id)) ?? position,
    linked_habit_id: goal.linkedHabitId ? Number(goal.linkedHabitId) : null,
    metadata: {
      template: goal.template ?? null,
      linkedHabitIds: goal.linkedHabitIds ?? [],
      books: goal.books ?? [],
      fitnessEntries: goal.fitnessEntries ?? [],
    },
  }));
  if (goals.length) {
    const { error } = await supabase.from("goals").upsert(goals, { onConflict: "user_id,id" });
    if (error) throw error;
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Error de base de datos";
  const status = message.includes("autenticado") ? 401 : 500;
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Usuario no autenticado");

    const [categoriesResult, habitsResult, completionsResult, motivationsResult, goalsResult] = await Promise.all([
      supabase.from("categories").select("id,label,icon,color,position").order("position"),
      supabase.from("habits").select("id,category_id,kind,name,goal,color,position,archived,every_day,weekdays_only,celebrated_streak_30").order("position"),
      supabase.from("habit_completions").select("habit_id,period_key,value"),
      supabase.from("motivational_quotes").select("text,position").order("position"),
      supabase.from("goals").select("id,title,category_id,period,period_key,measurement,target_value,current_value,unit,status,due_date,position,linked_habit_id,metadata").order("position"),
    ]);

    // La tabla de frases se incorpora de forma progresiva. Los hábitos deben seguir
    // cargando aunque el despliegue llegue antes que la migración de Supabase.
    const databaseError = categoriesResult.error ?? habitsResult.error ?? completionsResult.error ?? goalsResult.error;
    if (databaseError) throw databaseError;

    const categories = (categoriesResult.data as CategoryRow[]).map((category) => ({
      id: category.id,
      label: category.label,
      icon: category.icon,
      color: category.color,
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
      everyDay: habit.kind === "daily" ? habit.every_day : undefined,
      weekdaysOnly: habit.kind === "daily" ? habit.weekdays_only : undefined,
      history: historyByHabit.get(Number(habit.id)) ?? {},
      category: habit.category_id,
      celebratedStreak30: habit.celebrated_streak_30 ?? undefined,
    });

    const habits = habitsResult.data as HabitRow[];
    const goals = ((goalsResult.data ?? []) as GoalRow[]).map((goal) => ({
      id: Number(goal.id), title: goal.title, category: goal.category_id, period: goal.period,
      periodKey: goal.period_key, measurement: goal.measurement, targetValue: goal.target_value,
      currentValue: goal.current_value, unit: goal.unit ?? "", status: goal.status, dueDate: goal.due_date,
      linkedHabitId: goal.linked_habit_id ?? undefined,
      template: goal.metadata?.template ?? undefined,
      linkedHabitIds: goal.metadata?.linkedHabitIds ?? [],
      books: goal.metadata?.books ?? [],
      fitnessEntries: goal.metadata?.fitnessEntries ?? [],
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

    return Response.json({ state }, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Usuario no autenticado");
    const body = await request.json();
    const state = (body?.state ?? body) as TrackerState;
    const base = validState(body?.base) ? body.base as TrackerState : undefined;
    if (!validState(state)) {
      return Response.json({ error: "Estado de hábitos no válido" }, { status: 400 });
    }
    if (JSON.stringify(state).length > 1_000_000) {
      return Response.json({ error: "Los datos superan el tamaño permitido" }, { status: 413 });
    }

    await applyStateChanges(supabase, authData.user.id, state, base);
    return Response.json(
      { ok: true, updatedAt: new Date().toISOString() },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
