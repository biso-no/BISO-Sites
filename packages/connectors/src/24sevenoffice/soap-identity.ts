/**
 * Which 24SevenOffice company (SOAP "identity") the SOAP login uses.
 *
 * One login can reach several companies. `TFSO_SOAP_IDENTITY_ID` picks one
 * other than the login's default, e.g. the DEMO company for a local test. It is
 * unset in production. The REST API picks its company with `TFSO_REST_ORG_ID`.
 */
import type { Credentials } from "./types";

export function soapIdentityOverride(): string | undefined {
  const value = process.env.TFSO_SOAP_IDENTITY_ID?.trim();
  return value ? value : undefined;
}

export interface LoginCredential {
  ApplicationId: string;
  IdentityId?: string;
  Password: string;
  Username: string;
}

/**
 * The `credential` sent to `Authenticate.Login`. With an identity the session
 * starts in that company, so it never sits in the default one first.
 */
export function loginCredential(
  credentials: Credentials,
  identityId?: string
): LoginCredential {
  return identityId
    ? {
        ApplicationId: credentials.ApplicationId,
        IdentityId: identityId,
        Username: credentials.Username,
        Password: credentials.Password,
      }
    : {
        ApplicationId: credentials.ApplicationId,
        Username: credentials.Username,
        Password: credentials.Password,
      };
}
