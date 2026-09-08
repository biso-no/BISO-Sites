import type { GraphUserService } from "@repo/connectors/azure/users";
import { M365_DOMAIN } from "@/lib/it/m365-config";

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

// True when the account sits inside the caller's campus scope. `null` means
// unrestricted (global admin). BISO mirrors campus.name onto the M365
// officeLocation attribute, so that is what the scope is matched against.
//
// Fails closed: an account with no officeLocation is out of scope for anyone
// who is not a global admin, since there is no campus to check it against.
export function isWithinCampusScope(
  user: { officeLocation?: string },
  campusScope: string[] | null
): boolean {
  if (campusScope === null) {
    return true;
  }

  const officeLocation = user.officeLocation?.trim().toLowerCase();
  if (!officeLocation) {
    return false;
  }

  return campusScope.some(
    (campus) => campus.trim().toLowerCase() === officeLocation
  );
}

// Loads a user by id and asserts it's an allowed tenant user inside the
// caller's campus scope. Throws otherwise. Use before any Graph read or
// mutation that takes a client-supplied user id — this is the chokepoint that
// keeps a campus admin from reaching another campus's account by id.
export async function getAllowedTenantUser(
  graph: GraphUserService,
  userId: string,
  campusScope: string[] | null = null
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
  if (!isWithinCampusScope(user, campusScope)) {
    throw new Error(
      "This Microsoft 365 user belongs to another campus than the ones you manage."
    );
  }
  return user;
}
