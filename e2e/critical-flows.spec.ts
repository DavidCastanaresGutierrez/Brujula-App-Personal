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
