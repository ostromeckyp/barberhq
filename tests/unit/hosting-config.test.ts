import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderPublicConfig } from "../../scripts/config/build-web.ts";
import { inspectArtifact } from "../../scripts/checks/hosting.ts";
const config = {
  projectId: "test-project",
  firebase: {
    projectId: "test-project",
    apiKey: "public-fixture-key",
    appId: "1:123:web:fixture",
    authDomain: "test-project.firebaseapp.com",
  },
  functionsRegion: "europe-west1",
  dataConnect: {
    serviceId: "barberhq",
    location: "europe-west1",
    browserConnectorId: "browser",
  },
  hostingSiteId: "test-project",
  appCheck: { siteKey: "public-fixture-site-key" },
  lowStockThreshold: 2,
  replenishmentEnabled: false,
  knowledgeEnabled: false,
  replenishmentAiEnabled: false,
  ragEnabled: false,
};
it("renders only approved public fields for the explicitly selected project", () => {
  const output = renderPublicConfig(config, "test-project");
  expect(output).toContain("public-fixture-key");
  expect(output).toContain('"useEmulators":false');
  expect(() =>
    renderPublicConfig({ ...config, privateKey: "secret" }, "test-project"),
  ).toThrow();
  expect(() => renderPublicConfig(config, "other-project")).toThrow();
  expect(() => renderPublicConfig(undefined, "test-project")).toThrow();
});
it("rejects placeholder settings before a release", () => {
  expect(() =>
    renderPublicConfig(
      { ...config, appCheck: { siteKey: "REPLACE_WITH_SITE_KEY" } },
      "test-project",
    ),
  ).toThrow();
});
it("refuses private artifacts and requires a browser index", () => {
  const dir = mkdtempSync(join(tmpdir(), "barberhq-artifact-"));
  try {
    expect(() => inspectArtifact(dir)).toThrow();
    writeFileSync(join(dir, "index.html"), "<html>app</html>");
    writeFileSync(join(dir, "main-123.js"), 'console.log("public");');
    expect(inspectArtifact(dir).files).toEqual(["index.html", "main-123.js"]);
    writeFileSync(join(dir, "company.pdf"), "private");
    expect(() => inspectArtifact(dir)).toThrow();
    rmSync(join(dir, "company.pdf"));
    writeFileSync(join(dir, "main-123.js"), "-----BEGIN PRIVATE KEY-----");
    expect(() => inspectArtifact(dir)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { verifyRelease } from "../../scripts/checks/release.ts";
it("blocks emulator artifacts, stale builds and a different deployment project", () => {
  const record = {
    mode: "production",
    projectId: "notbad-6be95",
    siteId: "notbad-6be95",
    buildHash: "hash",
  };
  expect(() =>
    verifyRelease(record, "hash", "notbad-6be95", "notbad-6be95"),
  ).not.toThrow();
  expect(() =>
    verifyRelease(
      { ...record, mode: "emulator" },
      "hash",
      "notbad-6be95",
      "notbad-6be95",
    ),
  ).toThrow();
  expect(() =>
    verifyRelease(record, "changed", "notbad-6be95", "notbad-6be95"),
  ).toThrow();
  expect(() =>
    verifyRelease(record, "hash", "another-project", "notbad-6be95"),
  ).toThrow();
});
