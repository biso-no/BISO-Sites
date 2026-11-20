import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("web headers", () => {
  it("sends Document-Policy: js-profiling on every route", async () => {
    const rules = (await config.headers?.()) ?? [];
    const rule = rules.find(({ source }) => source === "/:path*");
    expect(rule?.headers).toContainEqual({
      key: "Document-Policy",
      value: "js-profiling",
    });
  });
});
