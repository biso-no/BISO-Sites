/**
 * Microsoft Graph authentication-method route table.
 *
 * Kept in its own dependency-free module so the mapping can be unit-tested
 * without pulling in the Graph SDK (which is server-only and cannot be loaded
 * by the test runner).
 */

export const PASSWORD_AUTHENTICATION_METHOD =
  "#microsoft.graph.passwordAuthenticationMethod";

/**
 * Maps an authentication method's `@odata.type` onto the Graph
 * `/users/{id}/authentication/{path}` collection that owns it.
 *
 * Only types listed here can be deleted. The password method is deliberately
 * absent — Graph rejects deleting it, an account must keep one credential.
 */
const AUTHENTICATION_METHOD_PATHS: Record<string, string> = {
  "#microsoft.graph.emailAuthenticationMethod": "emailMethods",
  "#microsoft.graph.fido2AuthenticationMethod": "fido2Methods",
  "#microsoft.graph.hardwareOathAuthenticationMethod": "hardwareOathMethods",
  "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod":
    "microsoftAuthenticatorMethods",
  "#microsoft.graph.phoneAuthenticationMethod": "phoneMethods",
  "#microsoft.graph.platformCredentialAuthenticationMethod":
    "platformCredentialMethods",
  "#microsoft.graph.softwareOathAuthenticationMethod": "softwareOathMethods",
  "#microsoft.graph.temporaryAccessPassAuthenticationMethod":
    "temporaryAccessPassMethods",
  "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod":
    "windowsHelloForBusinessMethods",
};

/** The Graph sub-collection a method type lives in, or null when undeletable. */
export function getAuthenticationMethodPath(odataType: string): string | null {
  return AUTHENTICATION_METHOD_PATHS[odataType] ?? null;
}

/** True when {@link GraphUserService.deleteAuthenticationMethod} can remove it. */
export function isRemovableAuthenticationMethod(odataType: string): boolean {
  return getAuthenticationMethodPath(odataType) !== null;
}
