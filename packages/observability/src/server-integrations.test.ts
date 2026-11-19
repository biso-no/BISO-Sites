import type { Integration } from "@sentry/core";
import { consoleLoggingIntegration } from "@sentry/core";
import { describe, expect, it, vi } from "vitest";
import { buildServerOptions } from "./options";

vi.mock("@sentry/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/core")>();
  return {
    ...actual,
    consoleLoggingIntegration: vi.fn(actual.consoleLoggingIntegration),
  };
});

const input = {
  app: "web",
  dsn: "https://k@o1.ingest.de.sentry.io/2",
  environment: "production",
} as const;

const defaults: Integration[] = [{ name: "Http" }, { name: "VercelAI" }];

describe("buildServerOptions integrations", () => {
  it("adds console logging for exactly warn and error", () => {
    const resolved = buildServerOptions(input).integrations(defaults);
    expect(consoleLoggingIntegration).toHaveBeenCalledWith({
      levels: ["warn", "error"],
    });
    expect(resolved.map(({ name }) => name)).toContain("ConsoleLogs");
  });

  it("removes the default Vercel AI integration and keeps the others", () => {
    const names = buildServerOptions(input)
      .integrations(defaults)
      .map(({ name }) => name);
    expect(names).not.toContain("VercelAI");
    expect(names).toContain("Http");
  });
});
