import { describe, it, expect } from "vitest";
import { parsePublicConfig } from "../../scripts/config/public-config.ts";
export const validConfig = {
  projectId: "barberhq-test",
  firebase: {
    projectId: "barberhq-test",
    apiKey: "test-key",
    appId: "1:123:web:abc",
    authDomain: "barberhq-test.firebaseapp.com",
  },
  functionsRegion: "europe-west1",
  dataConnect: {
    serviceId: "barberhq",
    location: "europe-west1",
    browserConnectorId: "browser",
  },
  hostingSiteId: "barberhq-test",
  appCheck: { siteKey: "public-site-key" },
  replenishmentEnabled: false,
  knowledgeEnabled: false,
  replenishmentAiEnabled: false,
  ragEnabled: false,
};
describe("public config", () => {
  it("accepts a complete first-increment configuration without PDF endpoints", () =>
    expect(parsePublicConfig(validConfig)).toEqual(validConfig));
  it("rejects cross-project Firebase settings", () =>
    expect(() =>
      parsePublicConfig({
        ...validConfig,
        firebase: { ...validConfig.firebase, projectId: "other-project" },
      }),
    ).toThrow());
  it.each(["projectId", "firebase", "dataConnect", "appCheck"])(
    "rejects missing %s",
    (key) => {
      const config: any = { ...validConfig };
      delete config[key];
      expect(() => parsePublicConfig(config)).toThrow();
    },
  );
  it("rejects secret/unknown fields instead of publishing them", () =>
    expect(() =>
      parsePublicConfig({ ...validConfig, privateKey: "not-public" }),
    ).toThrow());
  it("requires HTTPS PDF endpoints when knowledge is enabled", () =>
    expect(() =>
      parsePublicConfig({
        ...validConfig,
        knowledgeEnabled: true,
        pdfReadUrl: "javascript:alert(1)",
      }),
    ).toThrow());
  it("rejects AI flags without their parent feature", () =>
    expect(() =>
      parsePublicConfig({ ...validConfig, ragEnabled: true }),
    ).toThrow());
  it("rejects obsolete thresholds and missing identifiers", () => {
    expect(() =>
      parsePublicConfig({ ...validConfig, lowStockThreshold: 2 }),
    ).toThrow();
    expect(() =>
      parsePublicConfig({
        ...validConfig,
        dataConnect: { ...validConfig.dataConnect, serviceId: "" },
      }),
    ).toThrow();
  });
});
