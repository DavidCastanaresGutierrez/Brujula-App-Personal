import { getSupabaseServerClient } from "../../../lib/supabase/server";

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
  celebrated_streak_30: string | null;
};

type CompletionRow = {
  habit_id: number;
  period_key: string;
  value: number;
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

    const [categoriesResult, habitsResult, completionsResult] = await Promise.all([
      supabase.from("categories").select("id,label,icon,color,position").order("position"),
      supabase.from("habits").select("id,category_id,kind,name,goal,color,position,archived,every_day,celebrated_streak_30").order("position"),
      supabase.from("habit_completions").select("habit_id,period_key,value"),
    ]);

    const databaseError = categoriesResult.error ?? habitsResult.error ?? completionsResult.error;
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
      history: historyByHabit.get(Number(habit.id)) ?? {},
      category: habit.category_id,
      celebratedStreak30: habit.celebrated_streak_30 ?? undefined,
    });

    const habits = habitsResult.data as HabitRow[];
    const state = habits.length || categories.length
      ? {
          daily: habits.filter((habit) => habit.kind === "daily").map(mapHabit),
          weekly: habits.filter((habit) => habit.kind === "weekly").map(mapHabit),
          categories,
        }
      : null;

    return Response.json({ state });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabaseServerClient(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Usuario no autenticado");
    const state = await request.json();
    if (!validState(state)) {
      return Response.json({ error: "Estado de hábitos no válido" }, { status: 400 });
    }
    if (JSON.stringify(state).length > 1_000_000) {
      return Response.json({ error: "Los datos superan el tamaño permitido" }, { status: 413 });
    }

    const { error } = await supabase.rpc("replace_tracker_state", { payload: state });
    if (error) throw error;
    return Response.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
