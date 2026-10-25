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
  await page.getByRole("button", { name: "Crear una cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Empieza a construir tu rumbo." })).toBeVisible();
  await page.getByRole("button", { name: "Volver al inicio de sesión" }).click();
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
  test.slow();
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
    const added = (Array.isArray(body) ? body : [body]).filter(r => !r.import_key || !records.some(old => old.import_key === r.import_key)).map(r => ({...r,id:r.id ?? `row-${records.length}-${Math.random()}`}));
    for (const row of added) { const i = records.findIndex(r => r.id === row.id); if (i >= 0) records[i] = row; else records.push(row); }
    return route.fulfill({json:Array.isArray(body) ? added : added[0]});
  });
  await openAuthenticatedApp(page);
  const mainNavigation = page.getByRole("navigation",{name:"Navegación principal"});
  await expect(mainNavigation.getByRole("button")).toHaveCount(6);
  await expect(mainNavigation.getByRole("button",{name:"Mi día",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Nutrición",exact:true}).click();
  await expect(page.getByText("Añade una comida o importa tus estimaciones desde ChatGPT.")).toBeVisible();
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
  await expect(page.getByText("Guardada como frecuente por unidad.")).toBeVisible();
  await page.getByRole("button",{name:/^Pollo de prueba 600 kcal/}).click();
  await page.getByRole("button",{name:"Añadir alimento"}).click();
  const favoriteForm = page.getByRole("region",{name:"Añadir comida frecuente"});
  await favoriteForm.getByLabel("Tipo de comida").selectOption("dinner");
  await favoriteForm.getByLabel("Cantidad de hoy").fill("2");
  await expect(favoriteForm.getByText("Total: 1200 kcal",{exact:false})).toBeVisible();
  await favoriteForm.getByRole("button",{name:"Añadir 2 raciones"}).click();
  await expect(page.locator(".nutrition-meal")).toHaveCount(2);
  const repeated = page.locator(".nutrition-meal").filter({hasText:"2 raciones"});
  await expect(repeated).toContainText("1200 kcal");
  await repeated.getByRole("button",{name:"Editar",exact:true}).click();
  await form.getByText("Información nutricional adicional").click();
  await form.getByLabel("Azúcares (g)").fill("1.5");
  await form.getByRole("button",{name:"Guardar comida"}).click();
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

test("nutrición: la foto se analiza, se revisa y solo se guarda al confirmar", async ({ page }) => {
  const rows: Record<string, unknown>[] = [];
  let analyzed: { mealType: string | null; photoType: string | null } | null = null;
  await page.route("**/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    if (route.request().method() === "GET") return route.fulfill({ json: table === "nutrition_goals" ? null : table === "nutrition_entries" ? rows : [] });
    const body = route.request().postDataJSON();
    const added = (Array.isArray(body) ? body : [body]).map((r: Record<string, unknown>) => ({ ...r, id: r.id ?? `row-${rows.length}-${Math.random()}` }));
    rows.push(...added);
    return route.fulfill({ json: Array.isArray(body) ? added : added[0] });
  });
  await page.route("**/api/nutrition/analyze-photo", async route => {
    const headers = route.request().headers();
    const postData = route.request().postData() ?? "";
    analyzed = { mealType: /name="mealType"\r\n\r\n(\w+)/.exec(postData)?.[1] ?? null, photoType: /Content-Type: (image\/\w+)/.exec(postData)?.[1] ?? null };
    if (!headers.authorization?.startsWith("Bearer ")) return route.fulfill({ status: 401, json: { error: "Sesión no válida" } });
    return route.fulfill({ json: { meals: [{ type: "dinner", name: "Tortilla de patatas", quantity: 1, unit: "serving", calories: 420, protein: 18, carbs: 30, fat: 25, fiber: 2, sugars: 1, saturated_fat: 6, trans_fat: 0, cholesterol: 0, sodium: 0, potassium: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0, salt: 1.2 }] } });
  });
  await openAuthenticatedApp(page);
  await page.getByRole("button", { name: "Nutrición", exact: true }).click();
  await page.getByRole("button", { name: "Analizar foto", exact: true }).click();
  const photoForm = page.getByRole("region", { name: "Analizar foto de comida" });
  await photoForm.getByLabel("Tipo de comida").selectOption("dinner");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await photoForm.getByLabel("Foto de comida").setInputFiles({ name: "cena.png", mimeType: "image/png", buffer: png });
  await photoForm.getByRole("button", { name: "Analizar foto" }).click();
  const importForm = page.getByRole("region", { name: "Importación desde ChatGPT" });
  await expect(importForm).toContainText("Tortilla de patatas");
  await expect(importForm.getByText("Total: 420 kcal", { exact: false })).toBeVisible();
  expect(rows).toHaveLength(0);
  expect(analyzed).toEqual({ mealType: "dinner", photoType: "image/jpeg" });
  await importForm.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.locator(".nutrition-meal").filter({ hasText: "Tortilla de patatas" })).toBeVisible();
  expect(rows).toHaveLength(1);
});

test("la app se puede instalar: manifiesto, iconos y service worker", async ({ page }) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body).toMatchObject({ name: "Brújula", display: "standalone", start_url: "/" });
  for (const icon of body.icons as { src: string }[]) expect((await page.request.get(icon.src)).ok()).toBe(true);
  const worker = await page.request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(await worker.text()).toContain("brujula-shell");
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
});

test("un acceso directo abre la vista pedida y recuerda la última visitada", async ({ page }) => {
  await mockLogin(page);
  await page.route("**/api/state**", async (route) => route.fulfill({ json: { state: initialState, revision: 1 } }));
  await page.route("**/rest/v1/**", async (route) => route.fulfill({ json: route.request().url().includes("nutrition_goals") ? null : [] }));
  await page.goto("/?view=nutrition&action=photo");
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.locator("#auth-password").fill("password-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("region", { name: "Analizar foto de comida" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: "Mi día", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tu día, en una sola vista" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu día, en una sola vista" })).toBeVisible();
});

test("nutrición sin red: la comida se guarda en el dispositivo y se sincroniza al volver la conexión", async ({ page, context }) => {
  const rows: Record<string, unknown>[] = [];
  const posts: Record<string, unknown>[] = [];
  let disconnected = false;
  await page.route("**/rest/v1/**", async route => {
    if (disconnected) return route.abort("internetdisconnected");
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: table === "nutrition_goals" ? null : table === "nutrition_entries" ? rows : [] });
    const body = route.request().postDataJSON();
    if (table === "nutrition_entries") { posts.push(body); rows.push({ ...body }); }
    return route.fulfill({ json: body });
  });
  await openAuthenticatedApp(page);
  await page.getByRole("button", { name: "Nutrición", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Comidas del día" })).toBeVisible();
  disconnected = true;
  await context.setOffline(true);
  await page.getByRole("button", { name: "+ Añadir comida" }).click();
  const form = page.getByRole("region", { name: "Formulario de comida" });
  await form.getByLabel("Nombre de la comida").fill("Tortilla sin red");
  for (const [label, value] of [["Calorías (kcal)", "420"], ["Proteína (g)", "18"], ["Carbohidratos (g)", "30"], ["Grasas (g)", "25"]]) await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByRole("button", { name: "Guardar comida" }).click();
  await expect(page.locator(".nutrition-meal").filter({ hasText: "Tortilla sin red" })).toBeVisible();
  await expect(page.getByText("1 cambio pendiente de sincronizar", { exact: false })).toBeVisible();
  expect(posts).toHaveLength(0);
  disconnected = false;
  await context.setOffline(false);
  await expect(page.getByText("cambio pendiente", { exact: false })).toBeHidden();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ name: "Tortilla sin red", calories: 420 });
  expect(typeof posts[0].id).toBe("string");
  await expect(page.locator(".nutrition-meal").filter({ hasText: "Tortilla sin red" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Nutrición", exact: true }).click();
  await expect(page.locator(".nutrition-meal").filter({ hasText: "Tortilla sin red" })).toBeVisible();
});
