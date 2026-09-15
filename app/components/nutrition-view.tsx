"use client";

import { useEffect, useRef, useState } from "react";
import { nutritionClient } from "../../lib/supabase/nutrition";
import { emptyMacros, mealTypes, metricKeys, metrics, metricStatus, nutritionWeek, parseNutrition, shiftDate, sumMacros, weeklyNutrition, type Entry, type FrequentMeal, type Macros, type Meal, type NutritionImport } from "../../lib/domain/nutrition";
import "./nutrition.css";

const numberFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const fmt = (value: number) => numberFormat.format(value);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const blankMeal = (): Meal => ({ name: "", type: "breakfast", ...emptyMacros() });
function macroText(meal: Macros) { return `${fmt(meal.calories)} kcal · P ${fmt(meal.protein)} g · C ${fmt(meal.carbs)} g · G ${fmt(meal.fat)} g`; }

export function NutritionView({ userId }: { userId: string }) {
  const [date, setDate] = useState(localToday);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [frequent, setFrequent] = useState<FrequentMeal[]>([]);
  const [goals, setGoals] = useState<Macros | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Meal | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<Macros | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<NutritionImport | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const operation = useRef(false);
  const editorKind = editor ? "meal" : goalDraft ? "goals" : importOpen ? "import" : deleting ? "delete" : "";
  useEffect(() => {
    if (editorKind) document.querySelector(".nutrition-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editorKind]);
  useEffect(() => {
    if (error) document.querySelector(".nutrition-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);
  const today = localToday();
  const days = nutritionWeek(date);
  const start = days[0], end = days[6];

  useEffect(() => {
    let active = true;
    const db = nutritionClient();
    Promise.all([
      db.from("nutrition_entries").select("id,date,type,name,calories,protein,carbs,fat").eq("user_id", userId).gte("date", start).lte("date", end).order("created_at"),
      db.from("nutrition_goals").select("calories,protein,carbs,fat").eq("user_id", userId).maybeSingle(),
      db.from("frequent_meals").select("id,type,name,calories,protein,carbs,fat").eq("user_id", userId).order("name"),
    ]).then(results => {
      if (!active) return;
      const failure = results.find(result => result.error)?.error;
      if (failure) { setError(`No se han podido cargar los datos nutricionales: ${failure.message}`); return; }
      setEntries((results[0].data ?? []) as unknown as Entry[]);
      setGoals(results[1].data as unknown as Macros | null);
      setFrequent((results[2].data ?? []) as unknown as FrequentMeal[]);
      setLoading(false);
    }).catch(() => { if (active) setError("No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo."); });
    return () => { active = false; };
  }, [userId, start, end, revision]);

  const changeDate = (next: string) => { if (!next) return; setLoading(true); setError(""); setEditor(null); setEditingId(null); setDate(next); setRevision(r => r + 1); };
  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar. Vuelve a intentarlo."); }
    finally { operation.current = false; setBusy(false); }
  }
  const db = () => nutritionClient();
  function check(result: { error: { message: string } | null }) { if (result.error) throw new Error(result.error.message); }
  async function saveMeal() {
    if (!editor) return;
    const meal = parseNutrition(JSON.stringify({ schema_version: 1, date, meals: [editor] })).meals[0];
    const row = { ...meal, date, user_id: userId };
    const result = editingId ? await db().from("nutrition_entries").update(row).eq("user_id", userId).eq("id", editingId).select().single() : await db().from("nutrition_entries").insert(row).select().single();
    check(result);
    const saved = result.data as Entry;
    setEntries(current => [...current.filter(entry => entry.id !== saved.id), saved]);
    setEditor(null); setEditingId(null); setMessage("Comida guardada.");
  }
  async function saveGoals() {
    if (!goalDraft) return;
    for (const key of metricKeys) if (!Number.isFinite(goalDraft[key]) || goalDraft[key] <= 0 || goalDraft[key] > 100000) throw new Error("Introduce objetivos mayores que cero y menores o iguales a 100.000.");
    check(await db().from("nutrition_goals").upsert({ user_id: userId, ...goalDraft }, { onConflict: "user_id" }));
    setGoals(goalDraft); setGoalDraft(null); setMessage("Objetivos guardados.");
  }
  async function importMeals() {
    if (!preview) return;
    // Stable content keys make retries (including a lost response) idempotent.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(preview)));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
    const rows = preview.meals.map((meal, index) => ({ ...meal, date: preview.date, user_id: userId, import_key: `${hash}:${index}` }));
    // A single PostgreSQL insert is atomic: all rows or none.
    const result = await db().from("nutrition_entries").upsert(rows, { onConflict: "user_id,import_key", ignoreDuplicates: true }).select("id");
    check(result);
    setMessage(result.data?.length ? `${result.data.length} comidas importadas.` : "Este JSON ya estaba importado. No se han duplicado comidas.");
    setImportOpen(false); setPreview(null); setRaw(""); changeDate(preview.date);
  }
  const daily = entries.filter(entry => entry.date === date);
  const total = sumMacros(daily);
  const week = weeklyNutrition(entries, days, today, goals);
  const status = goals ? metricStatus("calories", total.calories, goals.calories) : "below";
  const chartMax = Math.max(goals?.calories ?? 0, ...days.map(day => sumMacros(entries.filter(e => e.date === day)).calories), 1);
  function openMeal(meal: Meal = blankMeal(), id: string | null = null) { setGoalDraft(null); setImportOpen(false); setDeleting(null); setEditor({ name: meal.name, type: meal.type, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }); setEditingId(id); setError(""); }

  return <section className="nutrition">
    <div className="panel-head"><div><p className="eyebrow">SALUD</p><h1>Nutrición</h1><p>Lo que llevas hoy, frente a tus objetivos.</p></div><div className="nutrition-actions"><button disabled={busy || loading} onClick={() => { setEditor(null); setImportOpen(false); setDeleting(null); setGoalDraft(goals ?? emptyMacros()); }}>Configurar objetivos</button><button disabled={busy || loading} onClick={() => { setEditor(null); setGoalDraft(null); setDeleting(null); setImportOpen(true); setError(""); }}>Importar desde ChatGPT</button></div></div>
    <div className="nutrition-actions nutrition-date"><button disabled={busy} aria-label="Día anterior" onClick={() => changeDate(shiftDate(date,-1))}>←</button><input aria-label="Fecha nutricional" type="date" min="1900-01-01" max="9999-12-31" value={date} disabled={busy} onChange={e => changeDate(e.target.value)} /><button disabled={busy} onClick={() => changeDate(today)}>Hoy</button><button disabled={busy} aria-label="Día siguiente" onClick={() => changeDate(shiftDate(date,1))}>→</button></div>
    {error && <div role="alert" className="nutrition-error">{error}{loading && <button onClick={() => { setError(""); setRevision(r => r+1); }}>Reintentar</button>}</div>}
    {message && <p role="status">{message}</p>}
    {loading ? <p role="status">Cargando nutrición…</p> : <>
      <article className={`panel nutrition-status ${daily.length ? status : ""}`}><h2>{!daily.length ? "Sin comidas registradas" : !goals ? "Configura tus objetivos para comparar" : status === "within" ? "Dentro del rango calórico" : status === "below" ? "Por debajo del objetivo calórico" : "Por encima del objetivo calórico"}</h2><p>{daily.length ? `${fmt(total.calories)} kcal registradas. ${date === today ? "El día sigue en curso." : "Balance de las comidas registradas."}` : "Un día sin registros no se considera un día de consumo cero."}</p><small>Margen de comparación: ±10 % en calorías, carbohidratos y grasas. En proteína, alcanzar o superar el objetivo cuenta como alcanzado. Son criterios de seguimiento, no una valoración médica.</small></article>
      <div className="nutrition-grid">{metricKeys.map(key => { const target = goals?.[key]; const unit = key === "calories" ? "kcal" : "g"; const state = target ? metricStatus(key,total[key],target) : "below"; return <article className={`panel nutrition-metric ${state}`} key={key}><h3>{metrics[key]}</h3><strong>{fmt(total[key])} <small>/ {target ? fmt(target) : "—"} {unit}</small></strong>{target && <progress aria-label={`${metrics[key]} consumidas respecto al objetivo`} value={Math.min(total[key],target)} max={target} />}<p>{!target ? "Objetivo sin configurar" : key === "protein" && total[key] >= target ? "Objetivo alcanzado" : total[key] < target ? `Te quedan aproximadamente ${fmt(target-total[key])} ${unit}` : `${fmt(total[key]-target)} ${unit} por encima del objetivo`}</p><small>{!target ? "" : state === "within" ? key === "protein" ? "Proteína objetivo alcanzada" : "Dentro del rango" : state === "below" ? "Por debajo del objetivo" : "Por encima del objetivo"}</small></article>; })}</div>
      {goals && <article className="panel nutrition-comparison"><div className="panel-head"><div><h2>Objetivo diario frente a lo consumido</h2><p>Comparación directa de los macros registrados para {date === today ? "hoy" : "este día"}.</p></div><div className="nutrition-comparison-key"><span><i className="nutrition-key actual" />Consumido</span><span><i className="nutrition-key target" />Objetivo</span></div></div><div className="nutrition-comparison-rows">{metricKeys.map(key => { const target = goals[key]; const actual = total[key]; const max = Math.max(target, actual, 1); const unit = key === "calories" ? "kcal" : "g"; return <div className="nutrition-comparison-row" key={key}><div className="nutrition-comparison-label"><strong>{metrics[key]}</strong><span>{fmt(actual)} / {fmt(target)} {unit}</span></div><div className="nutrition-comparison-bars" aria-label={`${metrics[key]}: ${fmt(actual)} de ${fmt(target)} ${unit}`}><span className="nutrition-comparison-bar actual" style={{ width: `${actual / max * 100}%` }} /><span className="nutrition-comparison-bar target" style={{ width: `${target / max * 100}%` }} /></div></div>; })}</div></article>}
      <article className="panel"><div className="panel-head"><h2>Comidas del día</h2><button disabled={busy} onClick={() => openMeal()}>+ Añadir comida</button></div>{!daily.length && <p>Añade una comida o importa tus estimaciones desde ChatGPT.</p>}{daily.map(entry => <div className="nutrition-meal" key={entry.id}><div><small>{mealTypes[entry.type]}</small><h3>{entry.name}</h3><p>{macroText(entry)}</p></div><div className="nutrition-actions"><button disabled={busy} onClick={() => openMeal(entry,entry.id)}>Editar</button><button disabled={busy} onClick={() => void run(async () => { const { name,type,calories,protein,carbs,fat } = entry; const result = await db().from("frequent_meals").insert({ user_id:userId,name,type,calories,protein,carbs,fat }).select().single(); check(result); setFrequent(current => [...current,result.data as FrequentMeal]); setMessage("Guardada como frecuente."); })}>Guardar como frecuente</button><button disabled={busy} onClick={() => { setEditor(null); setGoalDraft(null); setImportOpen(false); setDeleting(entry); }}>Eliminar</button></div></div>)}</article>
      <article className="panel"><h2>Comidas frecuentes</h2><p>Selecciona una y ajusta los valores antes de guardarla.</p><div className="nutrition-actions">{frequent.map(meal => <div key={meal.id}><button disabled={busy} onClick={() => openMeal(meal)}>{meal.name} · {fmt(meal.calories)} kcal</button><button disabled={busy} aria-label={`Quitar ${meal.name} de frecuentes`} onClick={() => void run(async () => { check(await db().from("frequent_meals").delete().eq("user_id",userId).eq("id",meal.id)); setFrequent(current => current.filter(m => m.id !== meal.id)); })}>×</button></div>)}{!frequent.length && <p>Aún no hay comidas frecuentes.</p>}</div></article>
      <article className="panel"><h2>Balance semanal</h2><p>{start} — {end} · {week.recorded}/7 días con registros hasta hoy.</p><p>Medias de los días registrados; pueden incluir días incompletos. Comparación con tus objetivos actuales.</p><div className="nutrition-grid">{metricKeys.map(key => <div key={key}><h3>{metrics[key]} medias/día</h3><strong>{week.recorded ? fmt(week.average[key]) : "—"} {key === "calories" ? "kcal" : "g"}</strong><p>Objetivo: {goals ? fmt(goals[key]) : "—"}</p></div>)}</div>{goals && <p>Calorías dentro del rango: {week.caloriesWithin}/{week.recorded} días registrados · Proteína alcanzada: {week.proteinReached}/{week.recorded} días registrados</p>}<h3>Calorías de la semana</h3><p>La línea marca el objetivo: {goals ? `${fmt(goals.calories)} kcal` : "sin configurar"}.</p><div className="nutrition-chart">{days.map(day => { const meals = entries.filter(e => e.date === day); const calories = sumMacros(meals).calories; return <div key={day}><small>{meals.length ? fmt(calories) : "—"}</small><div className="nutrition-track">{goals && <span className="nutrition-target" style={{ bottom: `${goals.calories/chartMax*100}%` }} />}{meals.length > 0 && <i style={{ height: `${calories/chartMax*100}%` }} />}</div><small>{new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday:"short" })}</small></div>; })}</div></article>
    </>}
    {editor && <section className="panel nutrition-editor" aria-label="Formulario de comida"><h2>{editingId ? "Editar comida" : "Añadir comida"}</h2><form onSubmit={e => { e.preventDefault(); void run(saveMeal); }}><fieldset disabled={busy}><label>Nombre de la comida<input autoFocus required maxLength={200} value={editor.name} onChange={e => setEditor({...editor,name:e.target.value})} /></label><label>Tipo de comida<select value={editor.type} onChange={e => setEditor({...editor,type:e.target.value as Meal["type"]})}>{Object.entries(mealTypes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><MacroFields value={editor} onChange={value => setEditor({...editor,...value})} /><div className="nutrition-actions"><button type="submit">Guardar comida</button><button type="button" onClick={() => setEditor(null)}>Cancelar</button></div></fieldset></form></section>}
    {goalDraft && <section className="panel nutrition-editor" aria-label="Objetivos nutricionales"><h2>Objetivos diarios</h2><p>Introduce tus objetivos. Se usarán también para comparar días anteriores.</p><form onSubmit={e => { e.preventDefault(); void run(saveGoals); }}><fieldset disabled={busy}><MacroFields value={goalDraft} onChange={setGoalDraft} positive /><div className="nutrition-actions"><button type="submit">Guardar objetivos</button><button type="button" onClick={() => setGoalDraft(null)}>Cancelar</button></div></fieldset></form></section>}
    {importOpen && <section className="panel nutrition-editor" aria-label="Importación desde ChatGPT"><h2>Importar desde ChatGPT</h2><p>Pega el JSON completo. Revisarás las comidas antes de guardarlas.</p><details><summary>Instrucciones para ChatGPT</summary><p>Estima los macros de mis comidas y devuelve solo JSON con schema_version: 1, date: AAAA-MM-DD y meals: un array de objetos con type, name, calories, protein, carbs y fat. Tipos: breakfast, mid_morning, lunch, snack, dinner, other. Macros en gramos, calorías en kcal; números sin unidades. Pregunta por cantidades si faltan y explica las suposiciones antes de generar el JSON.</p></details><label>JSON nutricional<textarea rows={10} disabled={busy} value={raw} onChange={e => { setRaw(e.target.value); setPreview(null); }} /></label><div className="nutrition-actions"><button disabled={busy} onClick={() => { try { setPreview(parseNutrition(raw)); setError(""); } catch (cause) { setPreview(null); setError((cause as Error).message); } }}>Validar y previsualizar</button><button disabled={busy} onClick={() => { setImportOpen(false); setPreview(null); }}>Cancelar</button></div>{preview && <div><h3>{preview.date} · {preview.meals.length} comidas</h3>{preview.meals.map((meal,i) => <p key={i}><b>{mealTypes[meal.type]}: {meal.name}</b><br />{macroText(meal)}</p>)}<p><strong>Total: {macroText(sumMacros(preview.meals))}</strong></p><p>Se añadirán a las comidas existentes de esa fecha. Un JSON idéntico no se importa dos veces. Si corriges una comida ya importada, edítala en el día correspondiente.</p><button disabled={busy} onClick={() => void run(importMeals)}>Confirmar importación</button></div>}</section>}
    {deleting && <section className="panel nutrition-editor"><h2>¿Eliminar {deleting.name}?</h2><div className="nutrition-actions"><button disabled={busy} onClick={() => void run(async () => { check(await db().from("nutrition_entries").delete().eq("user_id",userId).eq("id",deleting.id)); setEntries(current => current.filter(e => e.id !== deleting.id)); setDeleting(null); })}>Confirmar eliminación</button><button disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div></section>}
  </section>;
}
function MacroFields({value,onChange,positive=false}: {value: Macros; onChange:(value: Macros)=>void; positive?:boolean}) {
  return <div className="nutrition-grid">{metricKeys.map(key => <label key={key}>{metrics[key]} ({key === "calories" ? "kcal" : "g"})<input required type="number" inputMode="decimal" min={positive ? 0.01 : 0} max={100000} step="any" value={Number.isNaN(value[key]) ? "" : value[key]} onFocus={e => e.target.select()} onChange={e => onChange({...value,[key]: e.target.value === "" ? NaN : Number(e.target.value)})} /></label>)}</div>;
}
