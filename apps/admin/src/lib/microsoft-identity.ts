export const MICROSOFT_PROVIDER = "microsoft";

/**
 * The emails Azure AD vouches for: trimmed, lowercased, de-duplicated
 * `providerEmail`s of the Microsoft identities. The bare account email is not
 * included, since non-Microsoft sessions can set any address.
 */
export function microsoftIdentityEmails(
  identities: { provider: string; providerEmail?: string | null }[]
): string[] {
  const emails = new Set<string>();
  for (const identity of identities) {
    const email = identity.providerEmail?.trim().toLowerCase();
    if (identity.provider === MICROSOFT_PROVIDER && email) {
      emails.add(email);
    }
  }
  return [...emails];
}
