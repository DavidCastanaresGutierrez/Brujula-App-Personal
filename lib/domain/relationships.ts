type Categorized = { category?: string };

type GoalRelationships = Categorized & {
  id: number;
  linkedHabitId?: number;
  linkedHabitIds?: number[];
  parentAnnualGoalId?: number;
};

export function removeHabitFromGoals<T extends GoalRelationships>(goals: T[], habitId: number): T[] {
  return goals.map((goal) => {
    const linkedHabitIds = (goal.linkedHabitIds ?? []).filter((id) => id !== habitId);
    const linkedHabitId = goal.linkedHabitId === habitId ? undefined : goal.linkedHabitId;
    return { ...goal, linkedHabitId, linkedHabitIds };
  });
}

export function removeGoalAndChildReferences<T extends GoalRelationships>(goals: T[], goalId: number): T[] {
  return goals
    .filter((goal) => goal.id !== goalId)
    .map((goal) => goal.parentAnnualGoalId === goalId ? { ...goal, parentAnnualGoalId: undefined } : goal);
}

export function replaceCategory<T extends Categorized>(items: T[], source: string, replacement: string): T[] {
  return items.map((item) => item.category === source ? { ...item, category: replacement } : item);
}
