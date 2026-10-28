import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrivateSource } from "./source";

const full = {
  DOCS_PRIVATE_SOURCE: "infisical",
  INFISICAL_SITE_URL: "https://i.test",
  INFISICAL_CLIENT_ID: "id",
  INFISICAL_CLIENT_SECRET: "s",
  INFISICAL_PROJECT_ID: "p",
  INFISICAL_ENVIRONMENT: "prod",
  INFISICAL_SECRET_PATH: "/",
};

describe("getPrivateSource", () => {
  it("returns null for none or unset", () => {
    expect(getPrivateSource({})).toBeNull();
    expect(getPrivateSource({ DOCS_PRIVATE_SOURCE: "none" })).toBeNull();
  });

  it("returns a source for fake and infisical", () => {
    expect(
      getPrivateSource({
        DOCS_PRIVATE_SOURCE: "fake",
        DOCS_PRIVATE_FAKE_FILE: "/x.json",
      })
    ).not.toBeNull();
    expect(getPrivateSource(full)).not.toBeNull();
  });

  it("names the missing vars for infisical", () => {
    expect(() =>
      getPrivateSource({ ...full, INFISICAL_CLIENT_SECRET: undefined })
    ).toThrow("INFISICAL_CLIENT_SECRET");
    expect(() =>
      getPrivateSource({ DOCS_PRIVATE_SOURCE: "infisical" })
    ).toThrow("INFISICAL_SITE_URL");
  });

  it("rejects unknown values", () => {
    expect(() => getPrivateSource({ DOCS_PRIVATE_SOURCE: "x" })).toThrow();
  });

  it("requires the fake file", () => {
    expect(() => getPrivateSource({ DOCS_PRIVATE_SOURCE: "fake" })).toThrow(
      "DOCS_PRIVATE_FAKE_FILE"
    );
  });

  it("reads the fake file through getPrivateSource", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "fake-")), "v.json");
    writeFileSync(file, JSON.stringify({ A: "1" }));
    const source = getPrivateSource({
      DOCS_PRIVATE_SOURCE: "fake",
      DOCS_PRIVATE_FAKE_FILE: file,
    });
    expect(await source?.get(["A"])).toEqual({ A: "1" });
  });

  it("refuses fake in production unless allowed", () => {
    const env = {
      DOCS_PRIVATE_SOURCE: "fake",
      DOCS_PRIVATE_FAKE_FILE: "/x.json",
      NODE_ENV: "production",
    };
    expect(() => getPrivateSource(env)).toThrow("DOCS_PRIVATE_ALLOW_FAKE");
    expect(
      getPrivateSource({ ...env, DOCS_PRIVATE_ALLOW_FAKE: "1" })
    ).not.toBeNull();
  });
});
