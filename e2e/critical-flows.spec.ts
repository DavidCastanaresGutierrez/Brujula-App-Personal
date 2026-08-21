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

const initialState = {
  daily: [{ id: 1, name: "Caminar", goal: 12, color: "#39c6a4", checks: [], category: "health", history: {} }],
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
