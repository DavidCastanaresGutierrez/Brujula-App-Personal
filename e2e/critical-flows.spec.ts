import { expect, test, type Page } from "@playwright/test";

const userId = "00000000-0000-4000-8000-000000000001";
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: userId, email: "e2e@example.test", role: "authenticated", exp: 4_102_444_800 })}.signature`;

function previousWeekStart() {
  const date = new Date();
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - mondayOffset - 7);
  return date.toISOString().slice(0, 10);
}

function completedCurrentMonthThroughToday() {
  const date = new Date();
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return { [monthKey]: Array.from({ length: date.getDate() }, (_, index) => index + 1) };
}

const initialState = {
  daily: [{ id: 1, name: "Caminar", goal: 31, color: "#39c6a4", checks: [], category: "health", everyDay: true, history: completedCurrentMonthThroughToday() }],
  weekly: [],
  categories: [{ id: "health", label: "Salud", icon: "♡", color: "#39c6a4", priority: false }],
  motivations: ["Avanza en la dirección correcta."],
  goals: [],
  weeklyReviews: [{ weekStart: previousWeekStart(), priorities: ["Descansar"], adjustment: "Dormir antes", reflection: "La constancia mejoró." }],
};

async function mockLogin(page: Page) {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: "e2e-refresh-token",
      token_type: "bearer",
      expires_in: 2_147_483_647,
      user: { id: userId, email: "e2e@example.test", role: "authenticated", aud: "authenticated" },
    }),
  }));
}

async function openAuthenticatedApp(page: Page, onSave?: (body: Record<string, unknown>) => void) {
  await mockLogin(page);
  await page.route("**/api/state**", async (route) => {
    if (route.request().method() === "PUT") {
      onSave?.(route.request().postDataJSON());
      return route.fulfill({ json: { revision: 2 } });
    }
    return route.fulfill({ json: { state: initialState, revision: 1 } });
  });
  await page.goto("/");
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.locator("#auth-password").fill("password-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
}

test("inicio de sesión y recuperación muestran estados accesibles", async ({ page }) => {
  await mockLogin(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Crear una cuenta/ })).toHaveCount(0);
  await page.getByRole("button", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(page.getByRole("heading", { name: "Recupera el acceso a tu rumbo." })).toBeVisible();
  await page.getByRole("button", { name: "Volver al inicio de sesión" }).click();
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.locator("#auth-password").fill("password-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Pequeños pasos.")).toBeVisible();
});

test("crear un hábito recorre interfaz, caché y guardado remoto", async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  await openAuthenticatedApp(page, (body) => { saved = body; });
  await page.getByRole("button", { name: "Hábitos" }).click();
  await expect(page.getByRole("button", { name: "Frases" })).toBeVisible();
  await page.getByRole("button", { name: "+ Añadir hábito" }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir hábito diario" });
  await dialog.getByLabel("Nombre").fill("Meditar");
  await dialog.getByRole("button", { name: "Crear hábito" }).click();
  await expect(page.getByText("Meditar", { exact: true })).toBeVisible();
  await expect.poll(() => saved).toBeTruthy();
  expect(JSON.stringify(saved)).toContain("Meditar");
});

test("crear un bloque y una frase conserva la configuración", async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  await openAuthenticatedApp(page, (body) => { saved = body; });
  await page.getByRole("button", { name: "Hábitos" }).click();

  await page.getByRole("button", { name: "Gestionar bloques" }).click();
  const blocksDialog = page.getByRole("dialog", { name: "Gestionar bloques" });
  await blocksDialog.getByLabel("Nombre").fill("Ocio");
  await blocksDialog.getByRole("button", { name: "+ Añadir bloque" }).click();
  await expect(blocksDialog.getByText("Ocio", { exact: true })).toBeVisible();
  await blocksDialog.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: "Frases" }).click();
  const motivationsDialog = page.getByRole("dialog", { name: "Frases motivacionales" });
  await motivationsDialog.getByRole("textbox", { name: "Frase", exact: true }).fill("Avanzar también es descansar.");
  await motivationsDialog.getByRole("button", { name: "+ Añadir frase" }).click();
  await expect(motivationsDialog.getByText(/Avanzar también es descansar/)).toBeVisible();

  await expect.poll(() => JSON.stringify(saved)).toContain("Ocio");
  await expect.poll(() => JSON.stringify(saved)).toContain("Avanzar también es descansar.");
});

test("crear un objetivo cuantitativo y sumar progreso conserva el flujo completo", async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  await openAuthenticatedApp(page, (body) => { saved = body; });
  await page.getByRole("button", { name: "Objetivos" }).click();
  await page.getByRole("button", { name: "+ Añadir objetivo" }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir objetivo" });
  await dialog.getByLabel("Objetivo", { exact: true }).fill("Ahorrar para vacaciones");
  await dialog.getByLabel("Cómo se mide").selectOption("quantity");
  await dialog.getByLabel("Meta").fill("5");
  await dialog.getByLabel("Unidad").fill("mil €");
  await dialog.getByRole("button", { name: "Crear objetivo" }).click();
  const goalCard = page.locator(".goal-card").filter({ hasText: "Ahorrar para vacaciones" });
  await expect(goalCard).toBeVisible();
  const progressInput = goalCard.getByLabel("Cantidad que añadir a Ahorrar para vacaciones");
  await progressInput.fill("2");
  await goalCard.getByRole("button", { name: "Sumar" }).click();
  await expect(goalCard.getByText("2 / 5 mil €", { exact: true })).toBeVisible();
  await expect.poll(() => JSON.stringify(saved)).toContain("Ahorrar para vacaciones");
});

test("crear una lectura anual y registrar un libro terminado", async ({ page }) => {
  await openAuthenticatedApp(page);
  await page.getByRole("button", { name: "Objetivos" }).click();
  await page.getByRole("button", { name: "Lectura anual" }).click();
  const templateDialog = page.getByRole("dialog").filter({ hasText: "Lectura anual" });
  await templateDialog.getByLabel("Libros que quieres leer este año").fill("3");
  await templateDialog.getByRole("button", { name: "Crear objetivo" }).click();
  const goalCard = page.locator(".goal-card").filter({ hasText: "Lectura anual" });
  await expect(goalCard).toBeVisible();
  await goalCard.getByRole("button", { name: "+ Libro en proceso" }).click();
  let bookDialog = page.getByRole("dialog").filter({ hasText: "Registrar libro" });
  await bookDialog.getByLabel("Título").fill("El infinito en un junco");
  await bookDialog.getByRole("button", { name: "Añadir libro" }).click();
  await expect(goalCard.getByText("0 / 3 libros", { exact: true })).toBeVisible();
  await goalCard.getByRole("button", { name: "+ Libro terminado" }).click();
  bookDialog = page.getByRole("dialog").filter({ hasText: "Registrar libro" });
  await bookDialog.getByLabel("Título").fill("Hábitos atómicos");
  await bookDialog.getByLabel("Autor").fill("James Clear");
  await bookDialog.getByRole("button", { name: "Añadir libro" }).click();
  await expect(goalCard.getByText("Hábitos atómicos")).toBeVisible();
  await expect(goalCard.getByText("1 / 3 libros", { exact: true })).toBeVisible();
});

test("la clasificación mensual no penaliza los días futuros", async ({ page }) => {
  await openAuthenticatedApp(page);
  const rankedHabit = page.locator(".rank-row").filter({ hasText: "Caminar" });
  await expect(rankedHabit.getByText("100%", { exact: true })).toBeVisible();
});

test("el historial semanal recupera la reflexión guardada", async ({ page }) => {
  await openAuthenticatedApp(page);
  await page.getByRole("button", { name: "Semana" }).click();
  await expect(page.getByText("La constancia mejoró.")).toBeVisible();
  await expect(page.getByText("Ajuste decidido: Dormir antes")).toBeVisible();
});

test("un conflicto de guardado se comunica y no sobrescribe en silencio", async ({ page }) => {
  await mockLogin(page);
  await page.route("**/api/state**", async (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 409, json: { code: "STATE_CONFLICT", error: "Conflicto" } })
    : route.fulfill({ json: { state: initialState, revision: 1 } }));
  await page.goto("/");
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.locator("#auth-password").fill("password-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("button", { name: "Hábitos" }).click();
  await page.getByRole("button", { name: "+ Añadir hábito" }).click();
  await page.getByRole("dialog").getByLabel("Nombre").fill("Provocar conflicto");
  await page.getByRole("dialog").getByRole("button", { name: "Crear hábito" }).click();
  await expect(page.locator(".save-note.conflict")).toBeVisible({ timeout: 12_000 });
});

test("el login y los modales siguen siendo utilizables con altura móvil reducida", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto("/");
  const authPage = page.locator(".auth-page");
  await expect(authPage).toHaveCSS("overflow-y", "auto");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("un error de API se distingue de estar sin internet", async ({ page }) => {
  await mockLogin(page);
  await page.route("**/api/state**", async (route) => route.fulfill({ status: 500, json: { error: "Fallo simulado" } }));
  await page.goto("/");
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.locator("#auth-password").fill("password-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("button", { name: "Hábitos" }).click();
  await expect(page.getByText(/Error de sincronización/)).toBeVisible();
  await expect(page.getByText(/Sin conexión/)).toHaveCount(0);
});

test("nutrición: objetivos, registro, edición, frecuentes e importación revisada", async ({ page }) => {
  const rows: Record<string, unknown>[] = [];
  const favorites: Record<string, unknown>[] = [];
  let targets: Record<string, unknown> | null = null;
  let insertRequests = 0;
  await page.route("**/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    const method = route.request().method();
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (table === "nutrition_goals") {
      if (method === "POST") targets = route.request().postDataJSON();
      return route.fulfill({ json: targets });
    }
    const records = table === "frequent_meals" ? favorites : rows;
    if (method === "GET") return route.fulfill({ json: records });
    if (method === "DELETE") { const i = records.findIndex(r => r.id === id); if (i >= 0) records.splice(i,1); return route.fulfill({status:204}); }
    const body = route.request().postDataJSON();
    if (method === "PATCH") { const i = records.findIndex(r => r.id === id); records[i] = {...records[i],...body}; return route.fulfill({json:records[i]}); }
    insertRequests++;
    const added = (Array.isArray(body) ? body : [body]).filter(r => !r.import_key || !records.some(old => old.import_key === r.import_key)).map(r => ({...r,id:`row-${records.length}-${Math.random()}`}));
    records.push(...added);
    return route.fulfill({json:Array.isArray(body) ? added : added[0]});
  });
  await openAuthenticatedApp(page);
  const mainNavigation = page.getByRole("navigation",{name:"Navegación principal"});
  await expect(mainNavigation.getByRole("button")).toHaveCount(6);
  await expect(mainNavigation.getByRole("button",{name:"Mi día",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Nutrición",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Sin comidas registradas"})).toBeVisible();
  await page.getByRole("button",{name:"Configurar objetivos"}).click();
  const goalForm = page.getByRole("region",{name:"Objetivos nutricionales"});
  for (const [label,value] of [["Calorías (kcal)","2300"],["Proteína (g)","170"],["Carbohidratos (g)","220"],["Grasas (g)","70"]]) await goalForm.getByLabel(label,{exact:true}).fill(value);
  await goalForm.getByRole("button",{name:"Guardar objetivos"}).click();
  await expect(page.getByText("Objetivos guardados.")).toBeVisible();
  await page.getByRole("button",{name:"+ Añadir comida"}).click();
  const form = page.getByRole("region",{name:"Formulario de comida"});
  await form.getByLabel("Nombre de la comida").fill("Pollo de prueba");
  await form.getByLabel("Unidad").selectOption("serving");
  for (const [label,value] of [["Calorías (kcal)","550"],["Proteína (g)","72"],["Carbohidratos (g)","35"],["Grasas (g)","13"]]) await form.getByLabel(label,{exact:true}).fill(value);
  await form.getByRole("button",{name:"Guardar comida"}).click();
  const meal = page.locator(".nutrition-meal").filter({hasText:"Pollo de prueba"});
  await expect(meal).toBeVisible();
  await meal.getByRole("button",{name:"Editar",exact:true}).click();
  await form.getByLabel("Calorías (kcal)",{exact:true}).fill("600");
  await form.getByRole("button",{name:"Guardar comida"}).click();
  await expect(meal).toContainText("600 kcal");
  await meal.getByRole("button",{name:"Guardar como frecuente"}).click();
  await page.getByRole("button",{name:"Pollo de prueba · 600 kcal"}).click();
  await form.getByLabel("Nombre de la comida").fill("Pollo repetido");
  await form.getByLabel("Cantidad").fill("2");
  await form.getByText("Información nutricional adicional").click();
  await form.getByLabel("Azúcares (g)").fill("1.5");
  await expect(form.getByText("Total: 1200 kcal",{exact:false})).toBeVisible();
  await form.getByRole("button",{name:"Guardar comida"}).click();
  await expect(page.locator(".nutrition-meal")).toHaveCount(2);
  const repeated = page.locator(".nutrition-meal").filter({hasText:"Pollo repetido"});
  await expect(repeated).toContainText("2 raciones");
  await expect(repeated).toContainText("1200 kcal");
  await expect(repeated).toContainText("Azúcares 3 g");
  await page.getByRole("button",{name:"Importar desde ChatGPT",exact:true}).click();
  const importForm = page.getByRole("region",{name:"Importación desde ChatGPT"});
  const importInput = importForm.getByLabel("Seleccionar JSON de ChatGPT");
  await importInput.setInputFiles({name:"incompatible.json",mimeType:"application/json",buffer:Buffer.from('{"schema_version":2}')});
  await expect(page.locator(".nutrition-error")).toContainText("todavía no es compatible");
  const before = insertRequests;
  const date = await page.getByLabel("Fecha nutricional").inputValue();
  const json = JSON.stringify({schema_version:1,date,meals:[{type:"snack",name:"Batido importado",calories:105,protein:21,carbs:2,fat:2}]});
  await importInput.setInputFiles({name:"comida.json",mimeType:"application/json",buffer:Buffer.from(json)});
  await expect(importForm.getByText("Total:",{exact:false})).toBeVisible();
  expect(insertRequests).toBe(before);
  await importForm.getByRole("button",{name:"Confirmar importación"}).click();
  await expect(page.locator(".nutrition-meal")).toHaveCount(3);
  await page.getByRole("button",{name:"Importar desde ChatGPT",exact:true}).click();
  await importForm.getByLabel("Seleccionar JSON de ChatGPT").setInputFiles({name:"comida.json",mimeType:"application/json",buffer:Buffer.from(json)});
  await importForm.getByRole("button",{name:"Confirmar importación"}).click();
  await expect(page.getByText("Este JSON ya estaba importado. No se han duplicado comidas.")).toBeVisible();
  await expect(page.locator(".nutrition-meal")).toHaveCount(3);
  await expect(page.locator("body")).not.toContainText("Application error");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/nutrition-${test.info().project.name}.png`,fullPage:true});
});
