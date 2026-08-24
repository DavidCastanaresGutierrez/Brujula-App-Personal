export type CompletionRow = {
  habit_id: number;
  period_key: string;
  value: number;
};

export type AggregatedCompletionRow = {
  habit_id: number;
  history: Record<string, number[]> | null;
};

export function mapCompletionRows(rows: CompletionRow[]) {
  const historyByHabit = new Map<number, Record<string, number[]>>();

  rows.forEach((completion) => {
    const habitId = Number(completion.habit_id);
    const history = historyByHabit.get(habitId) ?? {};
    history[completion.period_key] = [...(history[completion.period_key] ?? []), Number(completion.value)]
      .sort((a, b) => a - b);
    historyByHabit.set(habitId, history);
  });

  return historyByHabit;
}

export function mapAggregatedCompletionRows(rows: AggregatedCompletionRow[]) {
  return new Map(rows.map((row) => [Number(row.habit_id), row.history ?? {}]));
}

export function isMissingCompletionHistoryRpc(error: { code?: string } | null) {
  return error?.code === "42883" || error?.code === "PGRST202";
}
