"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { goalPeriodDetails, isoDate, localDateKey, scheduledDaysInMonth } from "../../lib/domain/tracking";
import type { BookEntry, BookFormat, Goal, Habit } from "../../lib/domain/tracker-state";
import type { FitnessEntry, FitnessMetric } from "../components/charts";

type UseGoalTemplatesOptions = {
  goals: Goal[];
  setGoals: Dispatch<SetStateAction<Goal[]>>;
  daily: Habit[];
  today: Date;
  setGoalFilter: Dispatch<SetStateAction<"weekly" | "monthly" | "yearly">>;
};

const emptyFitnessDraft = { weight: "", muscle: "", fatMass: "", bodyWater: "", bodyFat: "", bmi: "", basalMetabolicRate: "" };

export function useGoalTemplates({ goals, setGoals, daily, today, setGoalFilter }: UseGoalTemplatesOptions) {
  const [templateModal, setTemplateModal] = useState<null | "fitness" | "reading">(null);
  const [templateHabitIds, setTemplateHabitIds] = useState<number[]>([]);
  const [readingTarget, setReadingTarget] = useState(12);
  const [bookGoal, setBookGoal] = useState<Goal | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookFormat, setBookFormat] = useState<BookFormat>("paper");
  const [bookStatus, setBookStatus] = useState<"reading" | "completed">("reading");
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [fitnessGoal, setFitnessGoal] = useState<Goal | null>(null);
  const [fitnessDraft, setFitnessDraft] = useState(emptyFitnessDraft);
  const [fitnessMetric, setFitnessMetric] = useState<FitnessMetric>("weight");
  const [fitnessPeriod, setFitnessPeriod] = useState<30 | 90 | 365>(90);
  const [fitnessImporting, setFitnessImporting] = useState(false);
  const [fitnessImportMessage, setFitnessImportMessage] = useState("");

  function createTemplateGoal() {
    if (!templateModal) return;
    const period = goalPeriodDetails("yearly");
    const id = Math.max(0, ...goals.map((goal) => goal.id)) + 1;
    const isReading = templateModal === "reading";
    const goal: Goal = {
      id,
      title: isReading ? "Lectura anual" : "Forma física",
      category: isReading ? "growth" : "health",
      period: "yearly", periodKey: period.key, dueDate: period.due,
      measurement: "quantity", targetValue: isReading ? Math.max(1, readingTarget) : 100,
      currentValue: 0, unit: isReading ? "libros" : "%", status: "active",
      linkedHabitId: isReading ? templateHabitIds[0] : undefined,
      linkedHabitIds: templateHabitIds,
      trackingStart: isoDate(today.getFullYear(), today.getMonth(), today.getDate()),
      template: templateModal,
      books: isReading ? [] : undefined,
      fitnessEntries: isReading ? undefined : [],
    };
    setGoals((items) => [...items, goal]);
    setTemplateModal(null);
    setTemplateHabitIds([]);
    setGoalFilter("yearly");
  }

  const isBookCompleted = (book: BookEntry) => book.status === "completed" || (book.status === undefined && Boolean(book.completedAt));

  function withReadingProgress(goal: Goal, books: BookEntry[]) {
    const completed = books.filter(isBookCompleted).length;
    return { ...goal, books, currentValue: Math.min(goal.targetValue, completed), status: completed >= goal.targetValue ? "completed" as const : "active" as const };
  }

  function openBookEditor(goal: Goal, book?: BookEntry, status: "reading" | "completed" = "reading") {
    setBookGoal(goal);
    setEditingBookId(book?.id ?? null);
    setBookTitle(book?.title ?? "");
    setBookAuthor(book?.author ?? "");
    setBookFormat(book?.format ?? "paper");
    setBookStatus(book ? (isBookCompleted(book) ? "completed" : "reading") : status);
  }

  function closeBookEditor() {
    setBookGoal(null);
    setEditingBookId(null);
    setBookTitle("");
    setBookAuthor("");
    setBookFormat("paper");
    setBookStatus("reading");
  }

  function saveBook() {
    if (!bookGoal || !bookTitle.trim()) return;
    const now = new Date();
    const todayKey = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
    const previous = bookGoal.books?.find((book) => book.id === editingBookId);
    const entry: BookEntry = { id: editingBookId ?? Date.now(), title: bookTitle.trim(), author: bookAuthor.trim() || undefined, format: bookFormat, status: bookStatus, startedAt: previous?.startedAt ?? todayKey, completedAt: bookStatus === "completed" ? previous?.completedAt ?? todayKey : undefined };
    setGoals((items) => items.map((goal) => goal.id === bookGoal.id
      ? withReadingProgress(goal, editingBookId === null ? [...(goal.books ?? []), entry] : (goal.books ?? []).map((book) => book.id === editingBookId ? entry : book))
      : goal));
    closeBookEditor();
  }

  function completeBook(goalId: number, bookId: number) {
    const now = new Date();
    const todayKey = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
    setGoals((items) => items.map((goal) => goal.id === goalId ? withReadingProgress(goal, (goal.books ?? []).map((book) => book.id === bookId ? { ...book, status: "completed", completedAt: todayKey } : book)) : goal));
  }

  function removeBook(goalId: number, bookId: number) {
    setGoals((items) => items.map((goal) => goal.id === goalId ? withReadingProgress(goal, (goal.books ?? []).filter((book) => book.id !== bookId)) : goal));
  }

  function saveFitnessEntry() {
    if (!fitnessGoal) return;
    const parse = (value: string) => value.trim() ? Number(value.replace(",", ".")) : undefined;
    const values = Object.fromEntries(Object.entries(fitnessDraft).map(([key, value]) => [key, parse(value)])) as Record<FitnessMetric, number | undefined>;
    if (Object.values(values).some((value) => value === undefined || Number.isNaN(value) || value < 0)) return;
    const entry: FitnessEntry = { id: Date.now(), recordedAt: localDateKey(), ...(values as Record<FitnessMetric, number>) };
    setGoals((items) => items.map((goal) => goal.id === fitnessGoal.id ? { ...goal, fitnessEntries: [...(goal.fitnessEntries ?? []), entry] } : goal));
    setFitnessGoal(null);
    setFitnessDraft(emptyFitnessDraft);
    setFitnessImportMessage("");
  }

  async function importSamsungHealth(file?: File) {
    if (!file) return;
    setFitnessImporting(true);
    setFitnessImportMessage("Leyendo la captura…");
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "spa+eng");
      const text = result.data.text.replace(/,/g, ".");
      const numberAfter = (labels: string[]) => {
        for (const label of labels) {
          const match = text.match(new RegExp(`${label}[^0-9]{0,30}([0-9]{1,4}(?:\\.[0-9]{1,2})?)`, "i"));
          if (match) return match[1];
        }
        return "";
      };
      const weight = numberAfter(["peso", "weight"]);
      const bodyFat = numberAfter(["grasa corporal", "body fat"]);
      const muscle = numberAfter(["músculo esquelético", "musculo esqueletico", "skeletal muscle", "masa muscular"]);
      const fatMass = numberAfter(["masa grasa", "fat mass"]);
      const bodyWater = numberAfter(["agua corporal", "body water"]);
      const bmi = numberAfter(["imc", "bmi"]);
      const basalMetabolicRate = numberAfter(["tasa metabólica basal", "tasa metabolica basal", "basal metabolic rate", "bmr"]);
      setFitnessDraft({ weight, muscle, fatMass, bodyWater, bodyFat, bmi, basalMetabolicRate });
      const detected = [weight, muscle, fatMass, bodyWater, bodyFat, bmi, basalMetabolicRate].filter(Boolean).length;
      setFitnessImportMessage(detected ? `${detected} de 7 valores detectados. Revísalos y completa los restantes.` : "No he podido identificar los valores. Puedes introducirlos manualmente.");
    } catch {
      setFitnessImportMessage("No se pudo leer la captura. Introduce los valores manualmente.");
    } finally {
      setFitnessImporting(false);
    }
  }

  function yearlyHabitPercent(habitId?: number) {
    const habit = daily.find((item) => item.id === habitId);
    if (!habit) return 0;
    let completed = 0;
    let expected = 0;
    for (let index = 0; index <= today.getMonth(); index += 1) {
      const key = `${today.getFullYear()}-${String(index + 1).padStart(2, "0")}`;
      const monthDays = new Date(today.getFullYear(), index + 1, 0).getDate();
      const through = index === today.getMonth() ? today.getDate() : monthDays;
      completed += (habit.history?.[key] ?? []).filter((day) => day <= through).length;
      expected += habit.schedule?.mode || habit.everyDay || habit.weekdaysOnly ? scheduledDaysInMonth(habit, today.getFullYear(), index, through) : Math.min(habit.goal, through);
    }
    return Math.min(100, Math.round(completed / Math.max(1, expected) * 100));
  }

  function closeFitnessEditor() {
    setFitnessGoal(null);
    setFitnessImportMessage("");
  }

  return {
    templateModal, setTemplateModal, templateHabitIds, setTemplateHabitIds, readingTarget, setReadingTarget,
    bookGoal, bookTitle, setBookTitle, bookAuthor, setBookAuthor, bookFormat, setBookFormat,
    bookStatus, setBookStatus, editingBookId, fitnessGoal, setFitnessGoal, fitnessDraft, setFitnessDraft,
    fitnessMetric, setFitnessMetric, fitnessPeriod, setFitnessPeriod, fitnessImporting, fitnessImportMessage,
    createTemplateGoal, isBookCompleted, openBookEditor, closeBookEditor, saveBook, completeBook, removeBook,
    saveFitnessEntry, importSamsungHealth, yearlyHabitPercent, closeFitnessEditor,
  };
}
