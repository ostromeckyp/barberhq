import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env["BARBERHQ_BASE_URL"] ?? "http://127.0.0.1:4200",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
