import type { FitnessEntry } from "../../app/components/charts";
import type { GoalPeriod, HabitSchedule } from "./tracking";
import type { WeeklyReview } from "./weekly-review";

export type HabitCategory = string;
export type Category = { id: HabitCategory; label: string; icon: string; color: string; priority?: boolean };

export type Habit = {
  id: number; name: string; goal: number; color: string; checks: number[];
  archived?: boolean; archivedAt?: string; everyDay?: boolean; weekdaysOnly?: boolean;
  schedule?: HabitSchedule; history?: Record<string, number[]>; misses?: Record<string, number[]>;
  skips?: Record<string, number[]>; category?: HabitCategory; celebratedStreak30?: string;
};

export type WeeklyHabit = {
  id: number; name: string; goal: number; color: string; checks: number[];
  archived?: boolean; archivedAt?: string; history?: Record<string, number[]>;
  misses?: Record<string, number[]>; skips?: Record<string, number[]>; category?: HabitCategory;
};

export type BookFormat = "audio" | "digital" | "paper";
export type BookEntry = { id: number; title: string; author?: string; format: BookFormat; status?: "reading" | "completed"; startedAt?: string; completedAt?: string };
export type GoalStep = { id: number; kind: "milestone" | "action"; title: string; dueDate: string; completed: boolean };
export type Goal = {
  id: number; title: string; category: HabitCategory; period: GoalPeriod; periodKey: string;
  measurement: "complete" | "quantity"; targetValue: number; currentValue: number;
  unit?: string; status: "active" | "completed" | "discarded"; dueDate: string;
  linkedHabitId?: number; linkedHabitIds?: number[]; trackingStart?: string;
  template?: "fitness" | "reading"; books?: BookEntry[]; fitnessEntries?: FitnessEntry[];
  parentAnnualGoalId?: number; steps?: GoalStep[]; archived?: boolean;
};

export type TrackerState = {
  daily: Habit[];
  weekly: WeeklyHabit[];
  categories?: Category[];
  motivations?: string[];
  goals?: Goal[];
  weeklyReviews?: WeeklyReview[];
};

export function trackerStatesEqual(a: TrackerState | null, b: TrackerState | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}
