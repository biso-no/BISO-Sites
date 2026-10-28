import { describe, expect, it } from "bun:test";
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
    expect(getPrivateSource({ DOCS_PRIVATE_SOURCE: "fake" })).not.toBeNull();
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
});
