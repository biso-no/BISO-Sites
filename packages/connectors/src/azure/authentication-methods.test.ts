import { describe, expect, test } from "bun:test";
import {
  getAuthenticationMethodPath,
  isRemovableAuthenticationMethod,
  PASSWORD_AUTHENTICATION_METHOD,
} from "./authentication-methods";

describe("getAuthenticationMethodPath", () => {
  // The three methods an IT admin resets for a user who lost their phone.
  test.each([
    [
      "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod",
      "microsoftAuthenticatorMethods",
    ],
    ["#microsoft.graph.phoneAuthenticationMethod", "phoneMethods"],
    ["#microsoft.graph.emailAuthenticationMethod", "emailMethods"],
  ])("maps %s to %s", (odataType, expected) => {
    expect(getAuthenticationMethodPath(odataType)).toBe(expected);
  });

  test("maps the remaining deletable Graph method types", () => {
    expect(
      getAuthenticationMethodPath("#microsoft.graph.fido2AuthenticationMethod")
    ).toBe("fido2Methods");
    expect(
      getAuthenticationMethodPath(
        "#microsoft.graph.softwareOathAuthenticationMethod"
      )
    ).toBe("softwareOathMethods");
    expect(
      getAuthenticationMethodPath(
        "#microsoft.graph.temporaryAccessPassAuthenticationMethod"
      )
    ).toBe("temporaryAccessPassMethods");
    expect(
      getAuthenticationMethodPath(
        "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod"
      )
    ).toBe("windowsHelloForBusinessMethods");
  });

  test("has no route for the password method — Graph refuses to delete it", () => {
    expect(
      getAuthenticationMethodPath(PASSWORD_AUTHENTICATION_METHOD)
    ).toBeNull();
  });

  test("returns null for an unknown type instead of guessing a route", () => {
    expect(
      getAuthenticationMethodPath(
        "#microsoft.graph.somethingNewAuthenticationMethod"
      )
    ).toBeNull();
  });
});

describe("isRemovableAuthenticationMethod", () => {
  test("the private email recovery address is removable", () => {
    // Regression: this type used to have no route, so an MFA reset failed with
    // "Unsupported authentication method type" before removing anything.
    expect(
      isRemovableAuthenticationMethod(
        "#microsoft.graph.emailAuthenticationMethod"
      )
    ).toBe(true);
  });

  test("the password method is not removable", () => {
    expect(
      isRemovableAuthenticationMethod(PASSWORD_AUTHENTICATION_METHOD)
    ).toBe(false);
  });
});
