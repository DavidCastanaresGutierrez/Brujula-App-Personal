"use client";

import { useCallback, useEffect, useState } from "react";
import {
  calculateDailyScore,
  calculateProportionalGoalBonus,
  calculateWeeklyGoalBonus,
  goalPeriodDetails,
  isoDate,
} from "../../lib/domain/tracking";
import { parseStoredStringSet, readStoredValue, writeStoredValue } from "../../lib/domain/storage";
import type { Category, Goal, Habit, WeeklyHabit } from "../../lib/domain/tracker-state";
import type { ClosureNotice } from "../components/app-shell";

type UseClosureNoticesOptions = {
  enabled: boolean;
  hydrated: boolean;
  userId?: string;
  today: Date;
  daily: Habit[];
  weekly: WeeklyHabit[];
  categories: Category[];
  goals: Goal[];
};

export function useClosureNotices({
  enabled, hydrated, userId, today, daily, weekly, categories, goals,
}: UseClosureNoticesOptions) {
  const [closureNotice, setClosureNotice] = useState<ClosureNotice | null>(null);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  useEffect(() => {
    if (!enabled || !hydrated || !userId || closureNotice) return;
    const deliveredKey = `brujula-closure-notices-v1:${userId}`;
    const delivered = parseStoredStringSet(readStoredValue(localStorage, deliveredKey));
    const now = new Date(todayYear, todayMonth, todayDate);
    const yesterday = new Date(todayYear, todayMonth, todayDate - 1);
    const yesterdayKey = `daily:${isoDate(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())}`;
    const previousMonth = new Date(todayYear, todayMonth, 0);
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthlyKey = `monthly:${previousMonthKey}`;
    const previousYear = todayYear - 1;
    const yearlyKey = `yearly:${previousYear}`;
    let nextNotice: ClosureNotice | null = null;

    const averageScore = (start: Date, end: Date) => {
      let total = 0;
      let count = 0;
      const cursor = new Date(start);
      while (cursor <= end) {
        total += calculateDailyScore(cursor, daily, weekly, categories).finalScore;
        count += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
      return count ? total / count : 0;
    };

    if (!delivered.has(yearlyKey)) {
      const yearGoals = goals.filter((goal) => goal.period === "yearly" && goal.periodKey === String(previousYear) && goal.status !== "discarded");
      const baseScore = averageScore(new Date(previousYear, 0, 1), new Date(previousYear, 11, 31));
      const result = calculateProportionalGoalBonus(baseScore, yearGoals);
      nextNotice = {
        key: yearlyKey,
        kind: "yearly",
        eyebrow: "CIERRE DEL AÑO",
        title: "Tu resumen anual",
        detail: yearGoals.length ? `${result.completed} de ${result.total} objetivos anuales completados · ${Math.round(result.completionRate * 100)}% de cumplimiento.` : "No había objetivos anuales definidos para este año.",
        baseScore,
        bonus: result.bonus,
        finalScore: result.finalScore,
      };
    }

    if (!nextNotice && !delivered.has(monthlyKey)) {
      const monthGoals = goals.filter((goal) => goal.period === "monthly" && goal.periodKey === previousMonthKey && goal.status !== "discarded");
      const baseScore = averageScore(new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1), previousMonth);
      const result = calculateProportionalGoalBonus(baseScore, monthGoals);
      nextNotice = {
        key: monthlyKey,
        kind: "monthly",
        eyebrow: "CIERRE DEL MES",
        title: "Tu resumen mensual",
        detail: monthGoals.length ? `${result.completed} de ${result.total} objetivos mensuales completados · ${Math.round(result.completionRate * 100)}% de cumplimiento.` : "No había objetivos mensuales definidos para este mes.",
        baseScore,
        bonus: result.bonus,
        finalScore: result.finalScore,
      };
    }

    if (!nextNotice && now.getDay() === 1) {
      const sunday = new Date(todayYear, todayMonth, todayDate - 1);
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() - 6);
      const weeklyKey = `weekly:${isoDate(monday.getFullYear(), monday.getMonth(), monday.getDate())}`;
      if (!delivered.has(weeklyKey)) {
        const closedWeekDates = Array.from({ length: 7 }, (_, index) => {
          const item = new Date(monday);
          item.setDate(monday.getDate() + index);
          return item;
        });
        const baseScore = closedWeekDates.reduce((sum, item) => sum + calculateDailyScore(item, daily, weekly, categories).finalScore, 0) / 7;
        const period = goalPeriodDetails("weekly", monday);
        const weekGoals = goals.filter((goal) => goal.period === "weekly" && goal.periodKey === period.key && goal.status !== "discarded");
        const completed = weekGoals.filter((goal) => goal.status === "completed" || goal.currentValue >= goal.targetValue).length;
        const result = calculateWeeklyGoalBonus(baseScore, weekGoals);
        nextNotice = {
          key: weeklyKey,
          kind: "weekly",
          eyebrow: "CIERRE DE SEMANA",
          title: result.earned ? "Semana cerrada con bonus" : "Tu resumen semanal",
          detail: weekGoals.length ? `${completed} de ${weekGoals.length} objetivos semanales completados${result.earned ? ". Bonus de cierre conseguido." : "."}` : "No había objetivos semanales definidos para esta semana.",
          baseScore,
          bonus: result.bonus,
          finalScore: result.finalScore,
        };
      }
    }

    if (!nextNotice && !delivered.has(yesterdayKey)) {
      const result = calculateDailyScore(yesterday, daily, weekly, categories);
      nextNotice = {
        key: yesterdayKey,
        kind: "daily",
        eyebrow: "CIERRE DEL DÍA",
        title: result.bonus > 0 ? "Tu constancia sumó un bonus" : "Así terminó tu día",
        detail: `${result.completed} de ${result.scheduled} hábitos diarios · ${result.eligibleWeeklyDoneToday} aportaciones semanales con bonus.`,
        baseScore: result.baseScore,
        bonus: result.bonus,
        finalScore: result.finalScore,
      };
    }

    if (nextNotice) queueMicrotask(() => setClosureNotice(nextNotice));
  }, [
    categories, closureNotice, daily, enabled, goals, hydrated, todayDate, todayMonth, todayYear, userId, weekly,
  ]);

  const dismissClosureNotice = useCallback(() => {
    if (!closureNotice || !userId) return;
    const deliveredKey = `brujula-closure-notices-v1:${userId}`;
    const delivered = parseStoredStringSet(readStoredValue(localStorage, deliveredKey));
    delivered.add(closureNotice.key);
    writeStoredValue(localStorage, deliveredKey, JSON.stringify([...delivered].slice(-120)));
    setClosureNotice(null);
  }, [closureNotice, userId]);

  return {
    closureNotice,
    dismissClosureNotice,
    clearClosureNotice: () => setClosureNotice(null),
  };
}
