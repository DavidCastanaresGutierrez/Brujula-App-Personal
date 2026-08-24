"use client";

import { useState, type Dispatch, type PointerEvent, type SetStateAction } from "react";
import { removeGoalAndChildReferences } from "../../lib/domain/relationships";
import { goalPeriodDetails, type GoalPeriod } from "../../lib/domain/tracking";
import type { Goal, GoalStep, HabitCategory } from "../../lib/domain/tracker-state";

type GoalStepDraft = { kind: GoalStep["kind"]; title: string; dueDate: string };

type UseGoalManagerOptions = {
  setGoals: Dispatch<SetStateAction<Goal[]>>;
  today: Date;
};

export function useGoalManager({ setGoals, today }: UseGoalManagerOptions) {
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("monthly");
  const [goalMeasurement, setGoalMeasurement] = useState<"complete" | "quantity">("complete");
  const [goalTarget, setGoalTarget] = useState(1);
  const [goalUnit, setGoalUnit] = useState("");
  const [goalCategory, setGoalCategory] = useState<HabitCategory>("health");
  const [goalLinkedHabitIds, setGoalLinkedHabitIds] = useState<number[]>([]);
  const [goalParentAnnualId, setGoalParentAnnualId] = useState<number | "">("");
  const [goalFilter, setGoalFilter] = useState<"weekly" | "monthly" | "yearly">("yearly");
  const [goalCategoryFilter, setGoalCategoryFilter] = useState<HabitCategory | "all">("all");
  const [draggingGoalId, setDraggingGoalId] = useState<number | null>(null);
  const [goalProgressDrafts, setGoalProgressDrafts] = useState<Record<number, string>>({});
  const [planningGoalId, setPlanningGoalId] = useState<number | null>(null);
  const [goalStepDraft, setGoalStepDraft] = useState<GoalStepDraft>({ kind: "action", title: "", dueDate: "" });
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);

  function resetGoalDraft() {
    setGoalTitle("");
    setGoalMeasurement("complete");
    setGoalTarget(1);
    setGoalUnit("");
    setGoalLinkedHabitIds([]);
    setGoalParentAnnualId("");
  }

  function openNewGoal() {
    setEditingGoalId(null);
    resetGoalDraft();
    setGoalPeriod("monthly");
    setGoalModalOpen(true);
  }

  function closeGoalModal() {
    setGoalModalOpen(false);
    setEditingGoalId(null);
  }

  function createGoal() {
    const title = goalTitle.trim();
    if (!title) return;
    const period = goalPeriodDetails(goalPeriod);
    const nextGoal: Goal = {
      id: editingGoalId ?? Date.now(), title, category: goalCategory, period: goalPeriod, periodKey: period.key,
      measurement: goalMeasurement, targetValue: goalMeasurement === "complete" ? 1 : Math.max(1, goalTarget),
      currentValue: 0, unit: goalMeasurement === "quantity" ? goalUnit.trim() : "",
      status: "active", dueDate: period.due,
      linkedHabitId: undefined,
      linkedHabitIds: goalMeasurement === "quantity" ? goalLinkedHabitIds : [],
      parentAnnualGoalId: (goalPeriod === "weekly" || goalPeriod === "monthly") && goalParentAnnualId ? Number(goalParentAnnualId) : undefined,
    };
    setGoals((items) => editingGoalId
      ? items.map((item) => item.id === editingGoalId ? { ...item, ...nextGoal, currentValue: item.currentValue, status: item.status, archived: item.archived, template: item.template, books: item.books, fitnessEntries: item.fitnessEntries, trackingStart: item.trackingStart } : item)
      : [...items, nextGoal]);
    resetGoalDraft();
    closeGoalModal();
    if (goalPeriod !== "daily") setGoalFilter(goalPeriod);
  }

  function startGoalEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalTitle(goal.title);
    setGoalPeriod(goal.period);
    setGoalMeasurement(goal.measurement);
    setGoalTarget(goal.targetValue);
    setGoalUnit(goal.unit ?? "");
    setGoalCategory(goal.category);
    setGoalLinkedHabitIds([...new Set([...(goal.linkedHabitIds ?? []), ...(goal.linkedHabitId ? [goal.linkedHabitId] : [])])]);
    setGoalParentAnnualId(goal.parentAnnualGoalId ?? "");
    setGoalModalOpen(true);
  }

  function updateGoalProgress(goal: Goal, value: number) {
    const currentValue = Math.max(0, Math.min(value, goal.targetValue));
    setGoals((items) => items.map((item) => item.id === goal.id
      ? { ...item, currentValue, status: currentValue >= item.targetValue ? "completed" : "active" }
      : item));
  }

  function markGoalNotCompleted(goal: Goal) {
    setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, status: "discarded" } : item));
  }

  function addGoalProgress(goal: Goal) {
    const amount = Number(goalProgressDrafts[goal.id] ?? "");
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateGoalProgress(goal, goal.currentValue + amount);
    setGoalProgressDrafts((drafts) => ({ ...drafts, [goal.id]: "" }));
  }

  function beginGoalPlanning(goal: Goal) {
    setPlanningGoalId(goal.id);
    setGoalStepDraft({ kind: "action", title: "", dueDate: goal.dueDate });
  }

  function cancelGoalPlanning() {
    setPlanningGoalId(null);
  }

  function addGoalStep(goal: Goal) {
    const title = goalStepDraft.title.trim();
    if (!title || !goalStepDraft.dueDate) return;
    const step: GoalStep = { id: Date.now(), kind: goalStepDraft.kind, title, dueDate: goalStepDraft.dueDate, completed: false };
    setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, steps: [...(item.steps ?? []), step] } : item));
    setGoalStepDraft({ kind: "action", title: "", dueDate: "" });
    setPlanningGoalId(null);
  }

  function toggleGoalStep(goalId: number, stepId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId
      ? { ...goal, steps: (goal.steps ?? []).map((step) => step.id === stepId ? { ...step, completed: !step.completed } : step) }
      : goal));
  }

  function removeGoalStep(goalId: number, stepId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId
      ? { ...goal, steps: (goal.steps ?? []).filter((step) => step.id !== stepId) }
      : goal));
  }

  function deleteGoal(id: number) {
    setGoals((items) => removeGoalAndChildReferences(items, id));
    setDeletingGoal(null);
  }

  function archiveGoal(id: number) {
    setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, archived: true } : goal));
  }

  function restoreGoal(id: number) {
    setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, archived: false } : goal));
  }

  function moveWeeklyGoalToCurrentWeek(id: number) {
    const period = goalPeriodDetails("weekly", today);
    setGoals((items) => items.map((goal) => goal.id === id
      ? { ...goal, periodKey: period.key, dueDate: period.due, currentValue: 0, status: "active" }
      : goal));
  }

  function reorderGoal(sourceId: number, targetId: number) {
    if (sourceId === targetId || goalCategoryFilter !== "all") return;
    setGoals((items) => {
      const sourceIndex = items.findIndex((goal) => goal.id === sourceId);
      const targetIndex = items.findIndex((goal) => goal.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return items;
      const next = [...items];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggingGoalId(null);
  }

  function startGoalPointerDrag(event: PointerEvent<HTMLButtonElement>, goalId: number) {
    if (goalCategoryFilter !== "all") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dropTargetId = String(goalId);
    setDraggingGoalId(goalId);
  }

  function moveGoalPointerDrag(event: PointerEvent<HTMLButtonElement>) {
    if (draggingGoalId === null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-goal-id]");
    if (target?.dataset.goalId) event.currentTarget.dataset.dropTargetId = target.dataset.goalId;
  }

  function finishGoalPointerDrag(event: PointerEvent<HTMLButtonElement>, sourceId: number) {
    const targetId = Number(event.currentTarget.dataset.dropTargetId);
    delete event.currentTarget.dataset.dropTargetId;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (Number.isFinite(targetId)) reorderGoal(sourceId, targetId);
    else setDraggingGoalId(null);
  }

  function cancelGoalPointerDrag() {
    setDraggingGoalId(null);
  }

  return {
    goalModalOpen, goalTitle, setGoalTitle, goalPeriod, setGoalPeriod, goalMeasurement, setGoalMeasurement,
    goalTarget, setGoalTarget, goalUnit, setGoalUnit, goalCategory, setGoalCategory,
    goalLinkedHabitIds, setGoalLinkedHabitIds, goalParentAnnualId, setGoalParentAnnualId,
    goalFilter, setGoalFilter, goalCategoryFilter, setGoalCategoryFilter, draggingGoalId,
    goalProgressDrafts, setGoalProgressDrafts, planningGoalId, goalStepDraft, setGoalStepDraft,
    editingGoalId, deletingGoal, setDeletingGoal, openNewGoal, closeGoalModal, createGoal, startGoalEdit,
    updateGoalProgress, markGoalNotCompleted, addGoalProgress, beginGoalPlanning, cancelGoalPlanning,
    addGoalStep, toggleGoalStep, removeGoalStep, deleteGoal, archiveGoal, restoreGoal,
    moveWeeklyGoalToCurrentWeek, startGoalPointerDrag, moveGoalPointerDrag, finishGoalPointerDrag, cancelGoalPointerDrag,
  };
}
