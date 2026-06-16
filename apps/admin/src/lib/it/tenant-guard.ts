import type { GraphUserService } from "@repo/connectors/azure/users";
import { M365_DOMAIN } from "@/lib/it/graph";

// Shared tenant-user guard. Lives in a plain module (NOT a "use server" file) so
// both IT server actions and the remediation actions can reuse it — a sync
// export from a "use server" module would break the build.

const LEADING_AT_REGEX = /^@/;

// True when the account is a licensed @biso.no tenant user — the only accounts
// IT admin is allowed to read or mutate.
export function isAllowedTenantUser(user: {
  assignedLicenses?: Array<{ skuId: string }>;
  mail?: string;
  userPrincipalName: string;
}): boolean {
  const allowedDomain = `@${M365_DOMAIN.toLowerCase().replace(
    LEADING_AT_REGEX,
    ""
  )}`;
  const hasDomain = [user.userPrincipalName, user.mail]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().endsWith(allowedDomain));
  const hasLicense = (user.assignedLicenses?.length ?? 0) > 0;

  return hasDomain && hasLicense;
}

// Loads a user by id and asserts it's an allowed tenant user. Throws otherwise.
// Use before any Graph mutation that takes a client-supplied user id.
export async function getAllowedTenantUser(
  graph: GraphUserService,
  userId: string
): Promise<NonNullable<Awaited<ReturnType<GraphUserService["getUser"]>>>> {
  const user = await graph.getUser(userId);
  if (!user) {
    throw new Error("Microsoft 365 user not found");
  }
  if (!isAllowedTenantUser(user)) {
    throw new Error(
      "Only licensed @biso.no Microsoft 365 users are visible in IT admin."
    );
  }
  return user;
}
