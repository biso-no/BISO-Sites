import { M365_DOMAIN } from "@/lib/it/m365-config";

const LEADING_AT_REGEX = /^@/;

/**
 * Domain check only: true when the address ends with `@` plus the tenant
 * domain (case-insensitive, trimmed). It does NOT tell role accounts from
 * personal accounts; the operator decides which account to hand over and
 * confirms it by typing the address.
 */
export function isTurnoverTarget(upn: string): boolean {
  const address = (upn ?? "").trim().toLowerCase();
  const domain = M365_DOMAIN.trim().toLowerCase().replace(LEADING_AT_REGEX, "");
  const suffix = `@${domain}`;
  return address.length > suffix.length && address.endsWith(suffix);
}
