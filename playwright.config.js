import { defineConfig } from "@playwright/test";

const browserName = process.env.TEST_BROWSER || "chromium";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/mangoidiots-solitaire/",
    browserName,
    channel: browserName === "chromium" ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tools/pages-server.mjs",
    url: "http://127.0.0.1:4173/mangoidiots-solitaire/",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "ignore",
  },
});
