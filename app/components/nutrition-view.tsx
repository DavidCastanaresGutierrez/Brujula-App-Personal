"use client";

import { useEffect, useRef, useState } from "react";
import { nutritionClient } from "../../lib/supabase/nutrition";
import { detailMetricKeys, detailMetrics, emptyMacros, emptyNutrients, mealTypes, metricKeys, metrics, metricStatus, nutritionWeek, parseNutrition, shiftDate, sumDetails, sumMacros, totalNutrients, units, weeklyNutrition, type Entry, type FrequentMeal, type Macros, type Meal, type NutritionDetails, type NutritionImport } from "../../lib/domain/nutrition";
import "./nutrition.css";

const numberFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const fmt = (value: number) => numberFormat.format(value);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const blankMeal = (): Meal => ({ name: "", type: "breakfast", quantity: 1, unit: "unit", ...emptyNutrients() });
function macroText(meal: Macros) { return `${fmt(meal.calories)} kcal · P ${fmt(meal.protein)} g · C ${fmt(meal.carbs)} g · G ${fmt(meal.fat)} g`; }
function detailText(meal: NutritionDetails) { return detailMetricKeys.filter(key => meal[key] > 0).map(key => `${detailMetrics[key]} ${fmt(meal[key])} g`).join(" · "); }
function quantityText(meal: Pick<Meal,"quantity" | "unit">) {
  const label = units[meal.unit];
  const plural = meal.quantity === 1 || meal.unit === "g" || meal.unit === "ml" ? label : label === "ración" ? "raciones" : label === "envase" ? "envases" : `${label}s`;
  return `${fmt(meal.quantity)} ${plural}`;
}
const normalizedMealName = (name: string) => name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
const matchesMealSearch = (name: string, query: string) => normalizedMealName(query).split(/\s+/).filter(Boolean).every(word => normalizedMealName(name).includes(word));
type HistoryPeriod = "days" | "weeks" | "months";
const dateLabel = (value:string, options:Intl.DateTimeFormatOptions) => new Date(`${value}T12:00:00`).toLocaleDateString("es-ES",options);
function historyBuckets(period:HistoryPeriod, today:string, entries:Entry[]) {
  const count = period === "days" ? 7 : period === "weeks" ? 8 : 12;
  const currentWeek = nutritionWeek(today)[0];
  return Array.from({length:count},(_,reverse) => {
    const index=count-1-reverse;
    if (period === "days") { const start=shiftDate(today,-index); return {start,end:start,label:dateLabel(start,{weekday:"short",day:"numeric"})}; }
    if (period === "weeks") { const start=shiftDate(currentWeek,-index*7); return {start,end:shiftDate(start,6),label:dateLabel(start,{day:"numeric",month:"short"})}; }
    const now=new Date(`${today}T12:00:00`); now.setMonth(now.getMonth()-index); const start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const next=new Date(now.getFullYear(),now.getMonth()+1,0); const end=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-${String(next.getDate()).padStart(2,"0")}`; return {start,end,label:dateLabel(start,{month:"short"})};
  }).map(bucket => {
    const rows=entries.filter(entry => entry.date >= bucket.start && entry.date <= bucket.end);
    const recorded=[...new Set(rows.map(row => row.date))].length;
    const total=sumMacros(rows);
    const divisor=period === "days" ? 1 : recorded;
    return {...bucket, macros: recorded ? metricKeys.reduce((result,key) => ({...result,[key]:total[key]/divisor}),{} as Macros) : null, recorded};
  });
}

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
  const [favoriteEntry, setFavoriteEntry] = useState<{ food: FrequentMeal; type: Meal["type"]; quantity: number } | null>(null);
  const [goalDraft, setGoalDraft] = useState<Macros | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<NutritionImport | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importText, setImportText] = useState("");
  const [importReading, setImportReading] = useState(false);
  const [importError, setImportError] = useState("");
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [frequentSearch, setFrequentSearch] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("days");
  const operation = useRef(false);
  const editorKind = editor ? "meal" : favoriteEntry ? "favorite" : goalDraft ? "goals" : importOpen ? "import" : deleting ? "delete" : "";
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
      db.from("nutrition_entries").select("id,date,type,name,quantity,unit,calories,protein,carbs,fat,fiber,sugars,saturated_fat,salt").eq("user_id", userId).gte("date", shiftDate(today,-365)).lte("date", today).order("created_at"),
      db.from("nutrition_goals").select("calories,protein,carbs,fat").eq("user_id", userId).maybeSingle(),
      db.from("frequent_meals").select("id,type,name,unit,calories,protein,carbs,fat,fiber,sugars,saturated_fat,salt").eq("user_id", userId).order("name"),
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
  }, [userId, today, revision]);

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
  async function saveFavoriteEntry() {
    if (!favoriteEntry) return;
    const { food, type, quantity } = favoriteEntry;
    const meal = parseNutrition(JSON.stringify({ schema_version: 1, date, meals: [{ ...food, type, quantity }] })).meals[0];
    const result = await db().from("nutrition_entries").insert({ ...meal, date, user_id: userId }).select().single();
    check(result);
    setEntries(current => [...current, result.data as Entry]);
    setFavoriteEntry(null); setMessage("Comida añadida.");
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
    setImportOpen(false); setPreview(null); setImportFileName(""); setImportText(""); setImportError(""); changeDate(preview.date);
  }
  const daily = entries.filter(entry => entry.date === date);
  const total = sumMacros(daily);
  const detailTotal = sumDetails(daily);
  const week = weeklyNutrition(entries, days, today, goals);
  const status = goals ? metricStatus("calories", total.calories, goals.calories) : "below";
  const chartMax = Math.max(goals?.calories ?? 0, ...days.map(day => sumMacros(entries.filter(e => e.date === day)).calories), 1);
  const calorieScale = goals ? Math.max(goals.calories * 1.2, total.calories, 1) : 1;
  const macroChart = goals ? ([
    { key:"carbs", label:"Hidratos", value:total.carbs, goal:goals.carbs, color:"carbs" },
    { key:"fat", label:"Grasa", value:total.fat, goal:goals.fat, color:"fat" },
    { key:"protein", label:"Proteína", value:total.protein, goal:goals.protein, color:"protein" },
  ] as const) : [];
  const macroCalories = macroChart.reduce((sum, macro) => sum + macro.value * (macro.key === "fat" ? 9 : 4), 0);
  const goalMacroCalories = macroChart.reduce((sum, macro) => sum + macro.goal * (macro.key === "fat" ? 9 : 4), 0);
  const history=historyBuckets(historyPeriod,today,entries);
  const historyRecorded=history.filter(item => item.macros !== null);
  const historyAverage=metricKeys.reduce((result,key) => ({...result,[key]:historyRecorded.reduce((sum,item) => sum + (item.macros?.[key] ?? 0),0) / (historyRecorded.length || 1)}),{} as Macros);
  const historyGoals=goals ?? metricKeys.reduce((result,key) => ({...result,[key]:Math.max(...history.map(item => item.macros?.[key] ?? 0),1)}),{} as Macros);
  const visibleFrequent = frequent.filter(meal => matchesMealSearch(meal.name, frequentSearch));
  function openMeal(meal: Meal = blankMeal(), id: string | null = null) { setFavoriteEntry(null); setGoalDraft(null); setImportOpen(false); setDeleting(null); setEditor({ name: meal.name, type: meal.type, quantity: meal.quantity, unit: meal.unit, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, fiber: meal.fiber, sugars: meal.sugars, saturated_fat: meal.saturated_fat, salt: meal.salt }); setEditingId(id); setError(""); }
  function openFavorite(food: FrequentMeal) { setEditor(null); setEditingId(null); setGoalDraft(null); setImportOpen(false); setDeleting(null); setFavoriteEntry({ food, type: food.type, quantity: 1 }); setError(""); }
  function inspectNutritionText(content: string, source: string) {
    setImportFileName(source);
    try { setPreview(parseNutrition(content)); setImportError(""); }
    catch (cause) { setPreview(null); setImportError(cause instanceof Error ? cause.message : "No se ha podido leer el JSON."); }
  }
  function closeImport() { setImportOpen(false); setPreview(null); setImportFileName(""); setImportText(""); setImportReading(false); setImportError(""); }
  function loadNutritionFile(file: File | undefined) {
    if (!file) return;
    setImportText("");
    setImportFileName(file.name);
    setImportReading(true);
    setImportError("");
    setPreview(null);
    if (file.size > 100000) { setImportReading(false); setImportError("El JSON supera el tamaño máximo (100 KB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setImportReading(false);
      inspectNutritionText(content, file.name);
    };
    reader.onerror = () => { setImportReading(false); setPreview(null); setImportError("No se ha podido leer el archivo. Descárgalo de nuevo e inténtalo otra vez."); };
    reader.readAsText(file, "utf-8");
  }

  return <section className="nutrition">
    <section className="view-intro nutrition-intro"><p className="eyebrow">SALUD Y ENERGÍA</p><h1>Nutrición</h1><p>Registra tus comidas y contrasta lo que consumes con tus objetivos.</p><div className="nutrition-actions nutrition-intro-actions"><button className="reset-button" disabled={busy || loading} onClick={() => { setEditor(null); setFavoriteEntry(null); setImportOpen(false); setDeleting(null); setGoalDraft(goals ?? emptyMacros()); }}>Configurar objetivos</button><button className="add-button" disabled={busy || loading} onClick={() => { setEditor(null); setFavoriteEntry(null); setGoalDraft(null); setDeleting(null); setImportOpen(true); setError(""); }}>Importar desde ChatGPT</button></div></section>
    <div className="nutrition-actions nutrition-date"><button disabled={busy} aria-label="Día anterior" onClick={() => changeDate(shiftDate(date,-1))}>←</button><input aria-label="Fecha nutricional" type="date" min="1900-01-01" max="9999-12-31" value={date} disabled={busy} onChange={e => changeDate(e.target.value)} /><button disabled={busy} onClick={() => changeDate(today)}>Hoy</button><button disabled={busy} aria-label="Día siguiente" onClick={() => changeDate(shiftDate(date,1))}>→</button></div>
    {error && <div role="alert" className="nutrition-error">{error}{loading && <button onClick={() => { setError(""); setRevision(r => r+1); }}>Reintentar</button>}</div>}
    {message && <p role="status">{message}</p>}
    {loading ? <p role="status">Cargando nutrición…</p> : <>
      <article className={`panel nutrition-status ${daily.length ? status : ""}`}><h2>{!daily.length ? "Sin comidas registradas" : !goals ? "Configura tus objetivos para comparar" : status === "within" ? "Dentro del rango calórico" : status === "below" ? "Por debajo del objetivo calórico" : "Por encima del objetivo calórico"}</h2><p>{daily.length ? `${fmt(total.calories)} kcal registradas. ${date === today ? "El día sigue en curso." : "Balance de las comidas registradas."}` : "Un día sin registros no se considera un día de consumo cero."}</p><small>Margen de comparación: ±10 % en calorías, carbohidratos y grasas. En proteína, alcanzar o superar el objetivo cuenta como alcanzado. Son criterios de seguimiento, no una valoración médica.</small></article>
      <div className="nutrition-grid">{metricKeys.map(key => { const target = goals?.[key]; const unit = key === "calories" ? "kcal" : "g"; const state = target ? metricStatus(key,total[key],target) : "below"; return <article className={`panel nutrition-metric ${state}`} key={key}><h3>{metrics[key]}</h3><strong>{fmt(total[key])} <small>/ {target ? fmt(target) : "—"} {unit}</small></strong>{target && <progress aria-label={`${metrics[key]} consumidas respecto al objetivo`} value={Math.min(total[key],target)} max={target} />}<p>{!target ? "Objetivo sin configurar" : key === "protein" && total[key] >= target ? "Objetivo alcanzado" : total[key] < target ? `Te quedan aproximadamente ${fmt(target-total[key])} ${unit}` : `${fmt(total[key]-target)} ${unit} por encima del objetivo`}</p><small>{!target ? "" : state === "within" ? key === "protein" ? "Proteína objetivo alcanzada" : "Dentro del rango" : state === "below" ? "Por debajo del objetivo" : "Por encima del objetivo"}</small></article>; })}</div>
      <article className="panel nutrition-details-summary"><h2>Información adicional del día</h2><p>Solo suma los datos disponibles; un cero puede significar que el alimento no los incluía.</p><div className="nutrition-grid">{detailMetricKeys.map(key => <div key={key}><span>{detailMetrics[key]}</span><strong>{fmt(detailTotal[key])} g</strong></div>)}</div></article>
      {goals && <div className="nutrition-visuals"><article className="panel nutrition-calorie-card"><div><p className="eyebrow">CALORÍAS</p><strong>{fmt(total.calories)}</strong><span>kcal</span></div><div className="nutrition-calorie-target"><span>Objetivo diario</span><strong>{fmt(goals.calories)} kcal</strong></div><div className="nutrition-calorie-progress" aria-label={`${fmt(total.calories)} de ${fmt(goals.calories)} kcal`}><i style={{ width: `${Math.min(total.calories / calorieScale * 100,100)}%` }} /><b style={{ left: `${goals.calories / calorieScale * 100}%` }} /></div><div className="nutrition-calorie-scale"><span>0</span><span>{fmt(Math.ceil(calorieScale / 10) * 10)} kcal</span></div><p>{total.calories < goals.calories ? `Te quedan ${fmt(goals.calories-total.calories)} kcal para el objetivo.` : `Vas ${fmt(total.calories-goals.calories)} kcal por encima del objetivo.`}</p></article><article className="panel nutrition-macro-card"><div className="panel-head"><div><p className="eyebrow">INFO NUTRICIONAL</p><h2>Reparto de macros</h2></div></div><div className="nutrition-macro-values">{macroChart.map(macro => <div className={macro.color} key={macro.key}><span>{macro.label}</span><strong>{fmt(macro.value)} g</strong></div>)}</div><p className="nutrition-macro-caption">Real</p><div className="nutrition-macro-bar" aria-label="Distribución real de macronutrientes">{macroChart.map(macro => <i className={macro.color} key={macro.key} style={{ width: `${macroCalories ? macro.value * (macro.key === "fat" ? 9 : 4) / macroCalories * 100 : 0}%` }} />)}</div><div className="nutrition-macro-percentages">{macroChart.map(macro => <span className={macro.color} key={macro.key}>{fmt(macroCalories ? macro.value * (macro.key === "fat" ? 9 : 4) / macroCalories * 100 : 0)}%</span>)}</div><p className="nutrition-macro-caption">Objetivo</p><div className="nutrition-macro-bar target" aria-label="Distribución objetivo de macronutrientes">{macroChart.map(macro => <i className={macro.color} key={macro.key} style={{ width: `${macro.goal * (macro.key === "fat" ? 9 : 4) / goalMacroCalories * 100}%` }} />)}</div><div className="nutrition-macro-percentages">{macroChart.map(macro => <span className={macro.color} key={macro.key}>{fmt(macro.goal * (macro.key === "fat" ? 9 : 4) / goalMacroCalories * 100)}%</span>)}</div></article></div>}
      <article className="panel"><div className="panel-head"><h2>Comidas del día</h2><button disabled={busy} onClick={() => openMeal()}>+ Añadir comida</button></div>{!daily.length && <p>Añade una comida o importa tus estimaciones desde ChatGPT.</p>}{daily.map(entry => { const savedAsFrequent = frequent.some(meal => normalizedMealName(meal.name) === normalizedMealName(entry.name)); const entryTotal=totalNutrients(entry); return <div className="nutrition-meal" key={entry.id}><div><small>{mealTypes[entry.type]} · {quantityText(entry)}</small><h3>{entry.name}{savedAsFrequent && <span className="nutrition-frequent-badge" title="Guardada en comidas frecuentes" aria-label="Guardada en comidas frecuentes">★ Frecuente</span>}</h3><p>{macroText(entryTotal)}</p>{detailText(entryTotal) && <p className="nutrition-details-line">{detailText(entryTotal)}</p>}</div><div className="nutrition-actions"><button disabled={busy} onClick={() => openMeal(entry,entry.id)}>Editar</button><button disabled={busy || savedAsFrequent} title={savedAsFrequent ? "Esta comida ya está guardada en frecuentes." : undefined} onClick={() => void run(async () => { if (frequent.some(meal => normalizedMealName(meal.name) === normalizedMealName(entry.name))) throw new Error("Esta comida ya está guardada en frecuentes."); const { name,type,unit,calories,protein,carbs,fat,fiber,sugars,saturated_fat,salt } = entry; const result = await db().from("frequent_meals").insert({ user_id:userId,name,type,unit,calories,protein,carbs,fat,fiber,sugars,saturated_fat,salt }).select().single(); check(result); setFrequent(current => [...current,result.data as FrequentMeal]); setMessage("Guardada como frecuente por unidad."); })}>{savedAsFrequent ? "Ya está en frecuentes" : "Guardar como frecuente"}</button><button disabled={busy} onClick={() => { setEditor(null); setFavoriteEntry(null); setGoalDraft(null); setImportOpen(false); setDeleting(entry); }}>Eliminar</button></div></div>; })}</article>
      <article className="panel"><h2>Comidas frecuentes</h2><p>La ficha guarda los valores por unidad de referencia; al añadirla eliges solo cuántas has tomado.</p>{frequent.length > 0 && <label className="nutrition-search">Buscar por nombre<input type="search" placeholder="Ej.: café, pollo, batido…" value={frequentSearch} onChange={e => setFrequentSearch(e.target.value)} /></label>}<div className="nutrition-actions">{visibleFrequent.map(meal => <div key={meal.id}><button disabled={busy} onClick={() => openFavorite(meal)}>Añadir {meal.name} · {fmt(meal.calories)} kcal/{units[meal.unit]}</button><button disabled={busy} aria-label={`Quitar ${meal.name} de frecuentes`} onClick={() => void run(async () => { check(await db().from("frequent_meals").delete().eq("user_id",userId).eq("id",meal.id)); setFrequent(current => current.filter(m => m.id !== meal.id)); })}>×</button></div>)}{!frequent.length && <p>Aún no hay comidas frecuentes.</p>}{frequent.length > 0 && !visibleFrequent.length && <p>No hay comidas frecuentes que coincidan con “{frequentSearch}”.</p>}</div></article>
      <article className="panel"><h2>Balance semanal</h2><p>{start} — {end} · {week.recorded}/7 días con registros hasta hoy.</p><p>Medias de los días registrados; pueden incluir días incompletos. Comparación con tus objetivos actuales.</p><div className="nutrition-grid">{metricKeys.map(key => <div key={key}><h3>{metrics[key]} medias/día</h3><strong>{week.recorded ? fmt(week.average[key]) : "—"} {key === "calories" ? "kcal" : "g"}</strong><p>Objetivo: {goals ? fmt(goals[key]) : "—"}</p></div>)}</div>{goals && <p>Calorías dentro del rango: {week.caloriesWithin}/{week.recorded} días registrados · Proteína alcanzada: {week.proteinReached}/{week.recorded} días registrados</p>}<h3>Calorías de la semana</h3><p>La línea marca el objetivo: {goals ? `${fmt(goals.calories)} kcal` : "sin configurar"}.</p><div className="nutrition-chart">{days.map(day => { const meals = entries.filter(e => e.date === day); const calories = sumMacros(meals).calories; return <div key={day}><small>{meals.length ? fmt(calories) : "—"}</small><div className="nutrition-track">{goals && <span className="nutrition-target" style={{ bottom: `${goals.calories/chartMax*100}%` }} />}{meals.length > 0 && <i style={{ height: `${calories/chartMax*100}%` }} />}</div><small>{new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday:"short" })}</small></div>; })}</div></article>
      <article className="panel nutrition-history"><div className="panel-head"><div><p className="eyebrow">EVOLUCIÓN NUTRICIONAL</p><h2>Resumen combinado</h2></div><div className="nutrition-history-tabs" role="tablist">{(["days","weeks","months"] as HistoryPeriod[]).map(period => <button key={period} role="tab" aria-selected={historyPeriod===period} className={historyPeriod===period ? "active" : ""} onClick={() => setHistoryPeriod(period)}>{period === "days" ? "Días" : period === "weeks" ? "Semanas" : "Meses"}</button>)}</div></div><p>Las barras muestran el porcentaje del objetivo de cada nutriente, para ver el conjunto de un vistazo.</p><div className="nutrition-history-summary">{metricKeys.map(key => <div className={`nutrition-history-stat ${key}`} key={key}><span>{metrics[key]}</span><strong>{historyRecorded.length ? fmt(historyAverage[key]) : "—"}<small>{key === "calories" ? " kcal" : " g"}</small></strong><em>media</em></div>)}</div><div className="nutrition-history-legend" aria-label="Leyenda"><span className="calories">Calorías</span><span className="protein">Proteína</span><span className="carbs">Hidratos</span><span className="fat">Grasas</span><i>La línea marca el 100 % del objetivo</i></div><p>{historyRecorded.length}/{history.length} periodos con registros. Las medias excluyen periodos sin datos.</p><div className="nutrition-history-chart combined" aria-label="Evolución combinada de calorías y macronutrientes">{history.map(item => <div key={item.start} title={item.macros === null ? `${item.label}: sin registros` : `${item.label}: ${metricKeys.map(key => `${metrics[key]} ${fmt(item.macros?.[key] ?? 0)}${key === "calories" ? " kcal" : " g"}`).join(" · ")}`}><div className="nutrition-history-track">{item.macros && metricKeys.map(key => <i className={key} key={key} style={{height:`${Math.min((item.macros?.[key] ?? 0)/historyGoals[key]*100,100)}%`}} />)}<b /></div><small>{item.label}</small></div>)}</div></article>
    </>}
    {editor && <section className="panel nutrition-editor" aria-label="Formulario de comida"><h2>{editingId ? "Editar comida" : "Añadir comida"}</h2><form onSubmit={e => { e.preventDefault(); void run(saveMeal); }}><fieldset disabled={busy}><label>Nombre de la comida<input autoFocus required maxLength={200} value={editor.name} onChange={e => setEditor({...editor,name:e.target.value})} /></label><label>Tipo de comida<select value={editor.type} onChange={e => setEditor({...editor,type:e.target.value as Meal["type"]})}>{Object.entries(mealTypes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><QuantityFields value={editor} onChange={value => setEditor({...editor,...value})} /><h3>Valores por {units[editor.unit]}</h3><MacroFields value={editor} onChange={value => setEditor({...editor,...value})} /><details className="nutrition-optional-fields"><summary>Información nutricional adicional</summary><DetailFields value={editor} onChange={value => setEditor({...editor,...value})} /></details><p><strong>Total: {macroText(totalNutrients(editor))}</strong></p>{detailText(totalNutrients(editor)) && <p>{detailText(totalNutrients(editor))}</p>}<div className="nutrition-actions"><button type="submit">Guardar comida</button><button type="button" onClick={() => setEditor(null)}>Cancelar</button></div></fieldset></form></section>}
    {favoriteEntry && <section className="panel nutrition-editor" aria-label="Añadir comida frecuente"><h2>Añadir {favoriteEntry.food.name}</h2><p>Este favorito conserva sus valores por {units[favoriteEntry.food.unit]}. La cantidad de hoy se guarda solo en este registro.</p><form onSubmit={e => { e.preventDefault(); void run(saveFavoriteEntry); }}><fieldset disabled={busy}><label>Tipo de comida<select value={favoriteEntry.type} onChange={e => setFavoriteEntry({...favoriteEntry,type:e.target.value as Meal["type"]})}>{Object.entries(mealTypes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Cantidad de hoy<input autoFocus required type="number" inputMode="decimal" min={0.01} max={100000} step="any" value={Number.isNaN(favoriteEntry.quantity) ? "" : favoriteEntry.quantity} onFocus={e => e.target.select()} onChange={e => setFavoriteEntry({...favoriteEntry,quantity:e.target.value === "" ? NaN : Number(e.target.value)})} /></label><p><strong>Total: {macroText(totalNutrients({...favoriteEntry.food,quantity:favoriteEntry.quantity}))}</strong></p><div className="nutrition-actions"><button type="submit">Añadir {quantityText({quantity:favoriteEntry.quantity,unit:favoriteEntry.food.unit})}</button><button type="button" onClick={() => setFavoriteEntry(null)}>Cancelar</button></div></fieldset></form></section>}
    {goalDraft && <section className="panel nutrition-editor" aria-label="Objetivos nutricionales"><h2>Objetivos diarios</h2><p>Introduce tus objetivos. Se usarán también para comparar días anteriores.</p><form onSubmit={e => { e.preventDefault(); void run(saveGoals); }}><fieldset disabled={busy}><MacroFields value={goalDraft} onChange={setGoalDraft} positive /><div className="nutrition-actions"><button type="submit">Guardar objetivos</button><button type="button" onClick={() => setGoalDraft(null)}>Cancelar</button></div></fieldset></form></section>}
    {importOpen && <section className="panel nutrition-editor" aria-label="Importación desde ChatGPT"><h2>Añadir JSON de ChatGPT</h2><p>Selecciona un archivo o pega el JSON directamente. Revisarás las comidas antes de guardarlas.</p><label className="nutrition-file-picker">Archivo JSON<input aria-label="Seleccionar JSON de ChatGPT" className="nutrition-file-input" type="file" accept="application/json,.json" disabled={busy || importReading} onChange={e => loadNutritionFile(e.currentTarget.files?.[0])} /></label>{importReading && <p className="nutrition-file-status" role="status">Leyendo {importFileName}…</p>}<div className="nutrition-import-divider"><span>o pega el contenido</span></div><label>JSON<textarea className="nutrition-json-input" aria-label="Pegar JSON de ChatGPT" placeholder={'{\n  "schema_version": 1,\n  "date": "2026-09-16",\n  "meals": […]\n}'} rows={9} maxLength={100000} spellCheck={false} value={importText} disabled={busy || importReading} onChange={e => { setImportText(e.target.value); setPreview(null); setImportFileName(""); setImportError(""); }} /></label><div className="nutrition-actions"><button type="button" disabled={busy || importReading || !importText.trim()} onClick={() => inspectNutritionText(importText, "JSON pegado")}>Previsualizar JSON</button><button type="button" disabled={busy || importReading} onClick={closeImport}>Cancelar</button></div>{importError && <p className="nutrition-error" role="alert">{importError}</p>}<details><summary>¿Cómo consigo el JSON?</summary><p>Copia el bloque completo que te dé ChatGPT y pégalo arriba. También puedes descargarlo y seleccionar el archivo.</p></details>{preview && <div className="nutrition-import-preview"><h3>JSON listo · {preview.date} · {preview.meals.length} comidas</h3><p className="nutrition-file-status">{importFileName}</p>{preview.meals.map((meal,i) => { const mealTotal=totalNutrients(meal); return <p key={i}><b>{mealTypes[meal.type]}: {meal.name} · {quantityText(meal)}</b><br />{macroText(mealTotal)}{detailText(mealTotal) && <><br />{detailText(mealTotal)}</>}</p>; })}<p><strong>Total: {macroText(sumMacros(preview.meals))}</strong></p><p>Se añadirán a las comidas existentes de esa fecha. Un JSON idéntico no se importa dos veces.</p><button disabled={busy} onClick={() => void run(importMeals)}>Confirmar importación</button></div>}</section>}
    {deleting && <section className="panel nutrition-editor"><h2>¿Eliminar {deleting.name}?</h2><div className="nutrition-actions"><button disabled={busy} onClick={() => void run(async () => { check(await db().from("nutrition_entries").delete().eq("user_id",userId).eq("id",deleting.id)); setEntries(current => current.filter(e => e.id !== deleting.id)); setDeleting(null); })}>Confirmar eliminación</button><button disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div></section>}
  </section>;
}
function MacroFields({value,onChange,positive=false}: {value: Macros; onChange:(value: Macros)=>void; positive?:boolean}) {
  return <div className="nutrition-grid">{metricKeys.map(key => <label key={key}>{metrics[key]} ({key === "calories" ? "kcal" : "g"})<input required type="number" inputMode="decimal" min={positive ? 0.01 : 0} max={100000} step="any" value={Number.isNaN(value[key]) ? "" : value[key]} onFocus={e => e.target.select()} onChange={e => onChange({...value,[key]: e.target.value === "" ? NaN : Number(e.target.value)})} /></label>)}</div>;
}
function DetailFields({value,onChange}: {value: NutritionDetails; onChange:(value: NutritionDetails)=>void}) {
  return <div className="nutrition-grid">{detailMetricKeys.map(key => <label key={key}>{detailMetrics[key]} (g)<input required type="number" inputMode="decimal" min={0} max={100000} step="any" value={Number.isNaN(value[key]) ? "" : value[key]} onFocus={e => e.target.select()} onChange={e => onChange({...value,[key]: e.target.value === "" ? NaN : Number(e.target.value)})} /></label>)}</div>;
}
function QuantityFields({value,onChange}: {value: Pick<Meal,"quantity" | "unit">; onChange:(value: Pick<Meal,"quantity" | "unit">)=>void}) {
  return <div className="nutrition-quantity"><label>Cantidad<input required type="number" inputMode="decimal" min={0.01} max={100000} step="any" value={Number.isNaN(value.quantity) ? "" : value.quantity} onFocus={e => e.target.select()} onChange={e => onChange({...value,quantity:e.target.value === "" ? NaN : Number(e.target.value)})} /></label><label>Unidad<select value={value.unit} onChange={e => onChange({...value,unit:e.target.value as Meal["unit"]})}>{Object.entries(units).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>;
}
