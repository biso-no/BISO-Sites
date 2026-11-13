import { afterEach, describe, expect, test } from "bun:test";
import { loginCredential, soapIdentityOverride } from "./soap-identity";

const DEMO_IDENTITY = "2ae8da79-0002-403b-a0df-0001007c0007";
const credentials = {
  ApplicationId: "app-id",
  Password: "secret",
  Username: "user",
};

afterEach(() => {
  Reflect.deleteProperty(process.env, "TFSO_SOAP_IDENTITY_ID");
});

describe("soapIdentityOverride", () => {
  test("is undefined when the variable is unset or blank", () => {
    expect(soapIdentityOverride()).toBeUndefined();
    process.env.TFSO_SOAP_IDENTITY_ID = "   ";
    expect(soapIdentityOverride()).toBeUndefined();
  });

  test("returns the trimmed identity id", () => {
    process.env.TFSO_SOAP_IDENTITY_ID = ` ${DEMO_IDENTITY} `;
    expect(soapIdentityOverride()).toBe(DEMO_IDENTITY);
  });
});

describe("loginCredential", () => {
  test("sends no IdentityId for the default company", () => {
    expect(loginCredential(credentials)).toEqual(credentials);
    expect(loginCredential(credentials)).not.toHaveProperty("IdentityId");
  });

  test("logs straight in to the chosen company", () => {
    expect(loginCredential(credentials, DEMO_IDENTITY)).toEqual({
      ...credentials,
      IdentityId: DEMO_IDENTITY,
    });
  });
});
