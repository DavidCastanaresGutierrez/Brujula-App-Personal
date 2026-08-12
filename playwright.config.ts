import { defineConfig, devices } from "@playwright/test";

// This managed container reports uid 0 but rejects chown on its virtual /tmp.
// Present a regular uid while the Lambda-compatible Chromium archive expands.
if (process.getuid?.() === 0) process.getuid = () => 1000;
process.env.XDG_CACHE_HOME = "/tmp/chromium-cache";
const { default: chromium } = await import("@sparticuz/chromium");
const executablePath = await chromium.executablePath();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath, args: chromium.args.filter((argument) => argument !== "--single-process") },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Lambda-compatible Chromium hangs with Playwright's full iPhone emulation
    // (mobile context + device scale factor). A phone-sized Chromium viewport
    // still exercises the responsive layout reliably in CI.
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://e2e.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
