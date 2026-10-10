"use client";

import { useEffect, useRef, useState } from "react";
import {
  addBodyEntries,
  addBodyEntry,
  addFrequent,
  currentAccessToken,
  deleteFrequent,
  importEntries,
  removeEntry,
  saveEntry,
  updateFrequent,
  upsertGoals,
} from "../../lib/supabase/nutrition-repository";
import { useNutritionData } from "../hooks/use-nutrition-data";
import {
  detailMetricKeys,
  mealTypes,
  metricKeys,
  nutritionWeek,
  parseNutrition,
  shiftDate,
  type Entry,
  type FrequentMeal,
  type Meal,
  type NutritionImport,
} from "../../lib/domain/nutrition";
import { prepareFoodPhoto, suggestedMealType } from "../../lib/browser/photo";
import {
  blankMeal,
  BodyDraft,
  BodyImport,
  emptyBodyDraft,
  emptyGoals,
  localToday,
  mealTypeOrder,
  normalizedMealName,
  NutritionGoals,
  suggestedGoalsFromBody,
} from "../../lib/domain/nutrition-analysis";
import { BodyCompositionPanel } from "./nutrition/body-composition-panel";
import { BodyDraftForm } from "./nutrition/body-draft-form";
import { BodyImportPanel } from "./nutrition/body-import-panel";
import { DailySummary } from "./nutrition/daily-summary";
import { DeleteConfirm } from "./nutrition/delete-confirm";
import { FavoriteEditorForm } from "./nutrition/favorite-editor-form";
import { FavoriteEntryForm, type FavoriteEntryDraft } from "./nutrition/favorite-entry-form";
import { GoalsForm } from "./nutrition/goals-form";
import { ImportPanel } from "./nutrition/import-panel";
import { MealEditor } from "./nutrition/meal-editor";
import { MealsOfDay } from "./nutrition/meals-of-day";
import { NutritionHistory } from "./nutrition/nutrition-history";
import { PhotoPanel } from "./nutrition/photo-panel";
import { SavedFoods } from "./nutrition/saved-foods";
import { WeeklyBalance } from "./nutrition/weekly-balance";
import "./nutrition.css";

export function NutritionView({ userId }: { userId: string }) {
  const [date, setDate] = useState(localToday);
  const today = localToday();
  const {
    entries, setEntries, frequent, setFrequent, goals, setGoals,
    bodyEntries, setBodyEntries, loading, loadError, reload,
  } = useNutritionData(userId, today);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState("");
  const error = actionError || loadError;
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<Meal | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [favoriteEntry, setFavoriteEntry] = useState<FavoriteEntryDraft | null>(null);
  const [favoriteEditor, setFavoriteEditor] = useState<FrequentMeal | null>(
    null,
  );
  const [goalDraft, setGoalDraft] = useState<NutritionGoals | null>(null);
  const [bodyDraft, setBodyDraft] = useState<BodyDraft | null>(null);
  const [bodyImportOpen, setBodyImportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoMealType, setPhotoMealType] = useState<Meal["type"]>(suggestedMealType);
  const [preview, setPreview] = useState<NutritionImport | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importText, setImportText] = useState("");
  const [importReading, setImportReading] = useState(false);
  const [importError, setImportError] = useState("");
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const operation = useRef(false);
  const editorKind = editor
    ? "meal"
    : favoriteEntry
      ? "favorite"
      : favoriteEditor
        ? "favorite-editor"
        : goalDraft
          ? "goals"
          : bodyDraft
            ? "body"
            : importOpen
              ? "import"
              : deleting
                ? "delete"
                : "";
  useEffect(() => {
    if (editorKind)
      document
        .querySelector(".nutrition-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editorKind]);
  useEffect(() => {
    if (error)
      document
        .querySelector(".nutrition-error")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);
  const days = nutritionWeek(date);

  const changeDate = (next: string) => {
    if (!next) return;
    setError("");
    setEditor(null);
    setEditingId(null);
    setDate(next);
    reload();
  };
  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar. Vuelve a intentarlo.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function saveMeal() {
    if (!editor) return;
    const meal = parseNutrition(
      JSON.stringify({ schema_version: 1, date, meals: [editor] }),
    ).meals[0];
    const saved = await saveEntry(userId, { ...meal, date }, editingId);
    setEntries((current) => [
      ...current.filter((entry) => entry.id !== saved.id),
      saved,
    ]);
    setEditor(null);
    setEditingId(null);
    setMessage("Comida guardada.");
  }
  async function saveFavoriteEntry() {
    if (!favoriteEntry) return;
    const { food, type, quantity } = favoriteEntry;
    const meal = parseNutrition(
      JSON.stringify({
        schema_version: 1,
        date,
        meals: [{ ...food, type, quantity }],
      }),
    ).meals[0];
    const saved = await saveEntry(userId, { ...meal, date }, null);
    setEntries((current) => [...current, saved]);
    setFavoriteEntry(null);
    setMessage("Comida añadida.");
  }
  async function saveFavorite() {
    if (!favoriteEditor) return;
    const duplicate = frequent.some(
      (food) =>
        food.id !== favoriteEditor.id &&
        normalizedMealName(food.name) ===
          normalizedMealName(favoriteEditor.name),
    );
    if (duplicate)
      throw new Error("Ya existe una comida frecuente con ese nombre.");
    const { id, ...definition } = favoriteEditor;
    const valid = parseNutrition(
      JSON.stringify({
        schema_version: 1,
        date,
        meals: [{ ...definition, quantity: 1 }],
      }),
    ).meals[0];
    const { quantity: _quantity, ...row } = valid;
    void _quantity;
    const saved = await updateFrequent(userId, id, row);
    setFrequent((current) =>
      current
        .map((food) => (food.id === saved.id ? saved : food))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    );
    setFavoriteEditor(null);
    setMessage("Comida frecuente actualizada.");
  }
  async function saveGoals() {
    if (!goalDraft) return;
    for (const key of metricKeys)
      if (
        !Number.isFinite(goalDraft[key]) ||
        goalDraft[key] <= 0 ||
        goalDraft[key] > 100000
      )
        throw new Error(
          "Introduce objetivos mayores que cero y menores o iguales a 100.000.",
        );
    for (const key of detailMetricKeys)
      if (
        !Number.isFinite(goalDraft[key]) ||
        goalDraft[key] < 0 ||
        goalDraft[key] > 100000
      )
        throw new Error("Revisa los objetivos de micronutrientes.");
    await upsertGoals(userId, goalDraft);
    setGoals(goalDraft);
    setGoalDraft(null);
    setMessage("Objetivos guardados.");
  }
  async function saveBodyComposition() {
    const skeletalMuscleMass =
      bodyDraft?.skeletal_muscle_mass ?? bodyDraft?.muscle;
    if (
      !bodyDraft ||
      !Number.isFinite(bodyDraft.weight) ||
      bodyDraft.weight <= 0 ||
      !Number.isFinite(bodyDraft.body_fat) ||
      !Number.isFinite(skeletalMuscleMass) ||
      !skeletalMuscleMass ||
      skeletalMuscleMass <= 0
    )
      throw new Error(
        "Introduce peso, porcentaje de grasa y masa músculo-esquelética válidos.",
      );
    const calculatedLeanMass =
      bodyDraft.lean_mass ?? bodyDraft.weight * (1 - bodyDraft.body_fat / 100);
    const saved = await addBodyEntry(userId, {
      ...bodyDraft,
      muscle: skeletalMuscleMass,
      skeletal_muscle_mass: skeletalMuscleMass,
      lean_mass: calculatedLeanMass,
    });
    setBodyEntries((items) =>
      [...items, saved].sort((a, b) =>
        a.recorded_at.localeCompare(b.recorded_at),
      ),
    );
    const suggested = suggestedGoalsFromBody(saved);
    setBodyDraft(null);
    setGoalDraft(suggested);
    setMessage(
      "Composición guardada. Revisa y confirma los objetivos propuestos.",
    );
  }
  async function importBodyComposition(bodyImportPreview: BodyImport) {
    const saved = await addBodyEntries(userId, bodyImportPreview.measurements);
    setBodyEntries((items) =>
      [...items, ...saved].sort((a, b) =>
        a.recorded_at.localeCompare(b.recorded_at),
      ),
    );
    setBodyImportOpen(false);
    setMessage(
      `${saved.length} medición${saved.length === 1 ? "" : "es"} importada${saved.length === 1 ? "" : "s"}.`,
    );
  }
  async function importMeals() {
    if (!preview) return;
    const imported = await importEntries(userId, preview);
    setMessage(
      imported
        ? `${imported} comidas importadas.`
        : "Este JSON ya estaba importado. No se han duplicado comidas.",
    );
    setImportOpen(false);
    setPreview(null);
    setImportFileName("");
    setImportText("");
    setImportError("");
    changeDate(preview.date);
  }
  const daily = entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => mealTypeOrder[a.type] - mealTypeOrder[b.type]);
  const dailyGroups = (Object.keys(mealTypes) as Meal["type"][])
    .map((type) => ({
      type,
      entries: daily.filter((entry) => entry.type === type),
    }))
    .filter((group) => group.entries.length > 0);
  function openMeal(meal: Meal = blankMeal(), id: string | null = null) {
    setFavoriteEntry(null);
    setFavoriteEditor(null);
    setGoalDraft(null);
    setBodyDraft(null);
    setImportOpen(false);
    setPhotoOpen(false);
    setDeleting(null);
    setEditor({ ...meal });
    setEditingId(id);
    setError("");
  }
  function openFavorite(food: FrequentMeal) {
    setEditor(null);
    setEditingId(null);
    setFavoriteEditor(null);
    setGoalDraft(null);
    setImportOpen(false);
    setPhotoOpen(false);
    setDeleting(null);
    setFavoriteEntry({ food, type: food.type, quantity: 1 });
    setError("");
  }
  function editFavorite(food: FrequentMeal) {
    setEditor(null);
    setEditingId(null);
    setFavoriteEntry(null);
    setGoalDraft(null);
    setImportOpen(false);
    setPhotoOpen(false);
    setDeleting(null);
    setFavoriteEditor({ ...food });
    setError("");
  }
  function inspectNutritionText(content: string, source: string) {
    setImportFileName(source);
    try {
      setPreview(parseNutrition(content));
      setImportError("");
    } catch (cause) {
      setPreview(null);
      setImportError(
        cause instanceof Error
          ? cause.message
          : "No se ha podido leer el JSON.",
      );
    }
  }
  function closeImport() {
    setImportOpen(false);
    setPreview(null);
    setImportFileName("");
    setImportText("");
    setImportReading(false);
    setImportError("");
  }
  function closePhoto() {
    setPhotoOpen(false);
    setPhotoFile(null);
  }
  async function analyzePhoto() {
    if (!photoFile) throw new Error("Selecciona una foto de comida.");
    const accessToken = await currentAccessToken();
    if (!accessToken) throw new Error("Tu sesión ha caducado. Inicia sesión de nuevo.");
    const prepared = await prepareFoodPhoto(photoFile);
    const form = new FormData();
    form.append("photo", prepared);
    form.append("mealType", photoMealType);
    const response = await fetch("/api/nutrition/analyze-photo", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const result = (await response.json().catch(() => null)) as
      | { meals?: Meal[]; error?: string }
      | null;
    if (!response.ok || !result?.meals)
      throw new Error(result?.error ?? "No se ha podido analizar la foto.");
    inspectNutritionText(
      JSON.stringify({ schema_version: 1, date, meals: result.meals }),
      `Foto: ${photoFile.name || "comida"}`,
    );
    closePhoto();
    setImportOpen(true);
    setMessage("Revisa la estimación de la foto antes de guardarla.");
  }
  function loadNutritionFile(file: File | undefined) {
    if (!file) return;
    setImportText("");
    setImportFileName(file.name);
    setImportReading(true);
    setImportError("");
    setPreview(null);
    if (file.size > 100000) {
      setImportReading(false);
      setImportError("El JSON supera el tamaño máximo (100 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setImportReading(false);
      inspectNutritionText(content, file.name);
    };
    reader.onerror = () => {
      setImportReading(false);
      setPreview(null);
      setImportError(
        "No se ha podido leer el archivo. Descárgalo de nuevo e inténtalo otra vez.",
      );
    };
    reader.readAsText(file, "utf-8");
  }

  async function saveEntryAsFrequent(entry: Entry) {
    if (
      frequent.some(
        (meal) =>
          normalizedMealName(meal.name) === normalizedMealName(entry.name),
      )
    )
      throw new Error("Esta comida ya está guardada en frecuentes.");
    const { name, type, unit, calories, protein, carbs, fat, fiber, sugars, saturated_fat, salt } = entry;
    const saved = await addFrequent(userId, { name, type, unit, calories, protein, carbs, fat, fiber, sugars, saturated_fat, salt });
    setFrequent((current) => [...current, saved]);
    setMessage("Guardada como frecuente por unidad.");
  }
  async function removeFrequent(food: FrequentMeal) {
    await deleteFrequent(userId, food.id);
    setFrequent((current) => current.filter((m) => m.id !== food.id));
  }
  async function deleteEntry(entry: Entry) {
    await removeEntry(userId, entry.id);
    setEntries((current) => current.filter((e) => e.id !== entry.id));
    setDeleting(null);
  }
  function requestDelete(entry: Entry) {
    setEditor(null);
    setFavoriteEntry(null);
    setFavoriteEditor(null);
    setGoalDraft(null);
    setImportOpen(false);
    setDeleting(entry);
  }

  return (
    <section className="nutrition">
      <section className="view-intro nutrition-intro">
        <p className="eyebrow">SALUD Y ENERGÍA</p>
        <h1>Nutrición</h1>
        <p>
          Registra tus comidas y contrasta lo que consumes con tus objetivos.
        </p>
        <div className="nutrition-actions nutrition-intro-actions">
          <button
            className="reset-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setImportOpen(false);
              setDeleting(null);
              setBodyDraft(null);
              setGoalDraft(goals ?? emptyGoals());
            }}
          >
            Configurar objetivos
          </button>
          <button
            className="reset-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setGoalDraft(null);
              setImportOpen(false);
              setDeleting(null);
              setBodyDraft(emptyBodyDraft());
            }}
          >
            Añadir composición
          </button>
          <button
            className="add-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setGoalDraft(null);
              setBodyDraft(null);
              setDeleting(null);
              setImportOpen(true);
              setError("");
            }}
          >
            Importar desde ChatGPT
          </button>
          <button
            className="add-button"
            disabled={busy || loading}
            onClick={() => {
              setEditor(null);
              setFavoriteEntry(null);
              setGoalDraft(null);
              setBodyDraft(null);
              setImportOpen(false);
              setDeleting(null);
              setPhotoOpen(true);
              setError("");
            }}
          >
            Analizar foto
          </button>
        </div>
      </section>
      <div className="nutrition-actions nutrition-date">
        <button
          disabled={busy}
          aria-label="Día anterior"
          onClick={() => changeDate(shiftDate(date, -1))}
        >
          ←
        </button>
        <input
          aria-label="Fecha nutricional"
          type="date"
          min="1900-01-01"
          max="9999-12-31"
          value={date}
          disabled={busy}
          onChange={(e) => changeDate(e.target.value)}
        />
        <button disabled={busy} onClick={() => changeDate(today)}>
          Hoy
        </button>
        <button
          disabled={busy}
          aria-label="Día siguiente"
          onClick={() => changeDate(shiftDate(date, 1))}
        >
          →
        </button>
      </div>
      {error && (
        <div role="alert" className="nutrition-error">
          {error}
          {loadError && (
            <button onClick={reload}>
              Reintentar
            </button>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Cargando nutrición…</p>
      ) : (
        <>
          <DailySummary daily={daily} goals={goals} />
          <MealsOfDay
            groups={dailyGroups}
            frequent={frequent}
            busy={busy}
            onAdd={() => openMeal()}
            onEdit={(entry) => openMeal(entry, entry.id)}
            onSaveFrequent={(entry) => void run(() => saveEntryAsFrequent(entry))}
            onDelete={requestDelete}
          />
          <BodyCompositionPanel
            bodyEntries={bodyEntries}
            busy={busy}
            onImport={() => setBodyImportOpen(true)}
            onAdd={() => setBodyDraft(emptyBodyDraft())}
          />
          <SavedFoods
            frequent={frequent}
            busy={busy}
            onEdit={editFavorite}
            onRemove={(food) => void run(() => removeFrequent(food))}
            onAdd={openFavorite}
          />
          <WeeklyBalance entries={entries} days={days} today={today} goals={goals} />
          <NutritionHistory entries={entries} goals={goals} today={today} />
        </>
      )}
      {editor && (
        <MealEditor
          value={editor}
          editing={editingId !== null}
          busy={busy}
          onChange={setEditor}
          onSubmit={() => void run(saveMeal)}
          onCancel={() => setEditor(null)}
        />
      )}
      {favoriteEntry && (
        <FavoriteEntryForm
          value={favoriteEntry}
          busy={busy}
          onChange={setFavoriteEntry}
          onSubmit={() => void run(saveFavoriteEntry)}
          onCancel={() => setFavoriteEntry(null)}
        />
      )}
      {favoriteEditor && (
        <FavoriteEditorForm
          value={favoriteEditor}
          busy={busy}
          onChange={setFavoriteEditor}
          onSubmit={() => void run(saveFavorite)}
          onCancel={() => setFavoriteEditor(null)}
        />
      )}
      {goalDraft && (
        <GoalsForm
          value={goalDraft}
          busy={busy}
          onChange={setGoalDraft}
          onSubmit={() => void run(saveGoals)}
          onCancel={() => setGoalDraft(null)}
        />
      )}
      {bodyImportOpen && (
        <BodyImportPanel
          busy={busy}
          onImport={(preview) => void run(() => importBodyComposition(preview))}
          onClose={() => setBodyImportOpen(false)}
        />
      )}
      {bodyDraft && (
        <BodyDraftForm
          value={bodyDraft}
          busy={busy}
          onChange={setBodyDraft}
          onSubmit={() => void run(saveBodyComposition)}
          onCancel={() => setBodyDraft(null)}
        />
      )}
      {importOpen && (
        <ImportPanel
          busy={busy}
          reading={importReading}
          fileName={importFileName}
          text={importText}
          error={importError}
          preview={preview}
          onFile={loadNutritionFile}
          onTextChange={(text) => {
            setImportText(text);
            setPreview(null);
            setImportFileName("");
            setImportError("");
          }}
          onPreview={() => inspectNutritionText(importText, "JSON pegado")}
          onCancel={closeImport}
          onConfirm={() => void run(importMeals)}
        />
      )}
      {photoOpen && (
        <PhotoPanel
          busy={busy}
          file={photoFile}
          mealType={photoMealType}
          onFileChange={setPhotoFile}
          onMealTypeChange={setPhotoMealType}
          onAnalyze={() => void run(analyzePhoto)}
          onCancel={closePhoto}
        />
      )}
      {deleting && (
        <DeleteConfirm
          entry={deleting}
          busy={busy}
          onConfirm={() => void run(() => deleteEntry(deleting))}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

