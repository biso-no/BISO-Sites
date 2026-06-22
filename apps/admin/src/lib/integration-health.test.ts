import { describe, expect, test } from "bun:test";
import { checkIntegrationHealth, INTEGRATIONS } from "./integration-health";

const ALL_KEYS = INTEGRATIONS.flatMap((integration) => integration.envKeys);

function presentExcept(missing: string[]): (key: string) => boolean {
  const missingSet = new Set(missing);
  return (key) => !missingSet.has(key);
}

describe("INTEGRATIONS registry", () => {
  test("covers the core platform integrations", () => {
    const ids = INTEGRATIONS.map((integration) => integration.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "appwrite",
        "microsoft365",
        "sharepoint",
        "vipps",
        "schedulers",
      ])
    );
  });

  test("every integration has env keys, a purpose, and a runbook link", () => {
    for (const integration of INTEGRATIONS) {
      expect(integration.envKeys.length).toBeGreaterThan(0);
      expect(integration.purpose.length).toBeGreaterThan(0);
      expect(integration.runbook.startsWith("/docs/")).toBe(true);
      expect(integration.label.length).toBeGreaterThan(0);
    }
  });

  test("never exposes a secret value — only env key names are stored", () => {
    for (const integration of INTEGRATIONS) {
      for (const key of integration.envKeys) {
        expect(key).toBe(key.toUpperCase());
      }
    }
  });
});

describe("checkIntegrationHealth", () => {
  test("reports every integration configured when all keys are present", () => {
    const report = checkIntegrationHealth(() => true);

    expect(report.entries).toHaveLength(INTEGRATIONS.length);
    expect(report.entries.every((e) => e.status === "configured")).toBe(true);
    expect(report.configuredCount).toBe(INTEGRATIONS.length);
    expect(report.incompleteCount).toBe(0);
    expect(report.notConfiguredCount).toBe(0);
  });

  test("marks an integration not_configured when none of its keys are present", () => {
    const vipps = INTEGRATIONS.find((i) => i.id === "vipps");
    if (!vipps) {
      throw new Error("vipps integration missing from registry");
    }

    const report = checkIntegrationHealth(presentExcept(vipps.envKeys));
    const entry = report.entries.find((e) => e.id === "vipps");

    expect(entry?.status).toBe("not_configured");
    expect(entry?.missingKeys).toEqual(vipps.envKeys);
    expect(entry?.presentKeys).toHaveLength(0);
    expect(report.notConfiguredCount).toBe(1);
  });

  test("marks an integration incomplete when only some keys are present", () => {
    const sharepoint = INTEGRATIONS.find((i) => i.id === "sharepoint");
    if (!sharepoint) {
      throw new Error("sharepoint integration missing from registry");
    }
    const firstKey = sharepoint.envKeys[0] as string;

    const report = checkIntegrationHealth(presentExcept([firstKey]));
    const entry = report.entries.find((e) => e.id === "sharepoint");

    expect(entry?.status).toBe("incomplete");
    expect(entry?.missingKeys).toEqual([firstKey]);
    expect(entry?.presentKeys.length).toBe(sharepoint.envKeys.length - 1);
    expect(report.incompleteCount).toBe(1);
  });

  test("reads presence only through the provided callback", () => {
    const checked: string[] = [];
    checkIntegrationHealth((key) => {
      checked.push(key);
      return true;
    });
    expect(checked).toEqual(expect.arrayContaining(ALL_KEYS));
  });
});
