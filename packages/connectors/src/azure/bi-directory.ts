/**
 * Lookups against BI's Azure tenant, through BISO's app registration there.
 *
 * Separate from the `AZURE_*` variables, which address BISO's own tenant. The
 * only value this flow needs is `employeeId`, which becomes the Finago
 * customer number. `officeLocation`/`department` are read as a campus hint to
 * prefill the purchase wizard — never as an authority, since BI does not
 * populate them consistently.
 */

import "server-only";

import { GraphUserService } from "./users";

export interface BiDirectoryUser {
  campusHint: string | null;
  displayName: string;
  employeeId: string | null;
  givenName: string | null;
  mail: string | null;
  surname: string | null;
}

const CAMPUS_ID_BY_NAME: Record<string, string> = {
  oslo: "1",
  bergen: "2",
  trondheim: "3",
  stavanger: "4",
};

export function isBiDirectoryConfigured(): boolean {
  return Boolean(
    process.env.BI_AZURE_TENANT_ID &&
      process.env.BI_AZURE_CLIENT_ID &&
      process.env.BI_AZURE_CLIENT_SECRET
  );
}

function resolveCampusHint(
  ...values: Array<string | undefined>
): string | null {
  for (const value of values) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    for (const [name, campusId] of Object.entries(CAMPUS_ID_BY_NAME)) {
      if (normalized.includes(name)) {
        return campusId;
      }
    }
  }
  return null;
}

export async function getBiDirectoryUser(
  email: string
): Promise<BiDirectoryUser | null> {
  if (!isBiDirectoryConfigured()) {
    throw new Error("BI_AZURE_* credentials are not configured");
  }

  const service = new GraphUserService(
    process.env.BI_AZURE_TENANT_ID as string,
    process.env.BI_AZURE_CLIENT_ID as string,
    process.env.BI_AZURE_CLIENT_SECRET as string
  );

  const user = await service.getUser(email);
  if (!user) {
    return null;
  }

  return {
    displayName: user.displayName,
    employeeId: user.employeeId ?? null,
    givenName: user.givenName ?? null,
    surname: user.surname ?? null,
    mail: user.mail ?? null,
    campusHint: resolveCampusHint(user.officeLocation, user.department),
  };
}
