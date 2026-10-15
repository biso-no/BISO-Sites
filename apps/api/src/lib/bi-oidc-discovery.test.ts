import { describe, expect, it } from "vitest";
import {
  isDiscoveryDocument,
  isTenantSpecific,
  rewriteDiscovery,
} from "./bi-oidc-discovery";

const TENANT =
  "https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555";
const doc = {
  authorization_endpoint: `${TENANT}/oauth2/v2.0/authorize`,
  issuer: `${TENANT}/v2.0`,
  jwks_uri: `${TENANT}/discovery/v2.0/keys`,
  token_endpoint: `${TENANT}/oauth2/v2.0/token`,
  userinfo_endpoint: "https://graph.microsoft.com/oidc/userinfo",
};

describe("isDiscoveryDocument", () => {
  it("requires the two endpoints Appwrite reads", () => {
    expect(isDiscoveryDocument(doc)).toBe(true);
    expect(isDiscoveryDocument({ issuer: "x" })).toBe(false);
    expect(isDiscoveryDocument(null)).toBe(false);
    expect(isDiscoveryDocument("nope")).toBe(false);
  });
});

describe("isTenantSpecific", () => {
  it("accepts a tenant authority", () => {
    expect(isTenantSpecific(doc)).toBe(true);
  });

  it("rejects the multi-tenant authorities", () => {
    for (const authority of ["common", "organizations", "consumers"]) {
      expect(
        isTenantSpecific({
          ...doc,
          authorization_endpoint: `https://login.microsoftonline.com/${authority}/oauth2/v2.0/authorize`,
        })
      ).toBe(false);
    }
  });
});

describe("rewriteDiscovery", () => {
  it("replaces only the userinfo endpoint", () => {
    const rewritten = rewriteDiscovery(
      doc,
      "https://api.biso.no/api/auth/bi-userinfo"
    );
    expect(rewritten.userinfo_endpoint).toBe(
      "https://api.biso.no/api/auth/bi-userinfo"
    );
    expect(rewritten.authorization_endpoint).toBe(doc.authorization_endpoint);
    expect(rewritten.token_endpoint).toBe(doc.token_endpoint);
    expect(rewritten.jwks_uri).toBe(doc.jwks_uri);
  });
});
