"use client";

import { useCallback, useEffect, useState } from "react";
import type { Entry, FrequentMeal } from "../../lib/domain/nutrition";
import type { NutritionGoals } from "../../lib/domain/nutrition-analysis";
import type { BodyComposition } from "../../lib/supabase/nutrition";
import { loadNutritionData, NutritionRepositoryError } from "../../lib/supabase/nutrition-repository";

// Loads the last year of nutrition data for a user and keeps the editable copies.
export function useNutritionData(userId: string, today: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [frequent, setFrequent] = useState<FrequentMeal[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [bodyEntries, setBodyEntries] = useState<BodyComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    loadNutritionData(userId, today)
      .then((data) => {
        if (!active) return;
        setEntries(data.entries);
        setGoals(data.goals);
        setFrequent(data.frequent);
        setBodyEntries(data.bodyEntries);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadError(
          cause instanceof NutritionRepositoryError
            ? `No se han podido cargar los datos nutricionales: ${cause.message}`
            : "No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.",
        );
      });
    return () => {
      active = false;
    };
  }, [userId, today, revision]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError("");
    setRevision((current) => current + 1);
  }, []);

  return { entries, setEntries, frequent, setFrequent, goals, setGoals, bodyEntries, setBodyEntries, loading, loadError, reload };
}
