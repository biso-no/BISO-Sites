// Shared Microsoft Graph helpers for the IT server actions.
//
// IMPORTANT: this is a plain (non-"use server") server-side module on purpose.
// A "use server" file may export ONLY async functions, so constants and sync
// helpers shared between server-action files (it-users.ts, it-remediation.ts)
// must live here, not in those action files.

import { GraphUserService } from "@repo/connectors/azure/users";
import type { M365UserListItem } from "@repo/shared/types/user-management";

const AZURE_GRAPH_TENANT_ID =
  process.env.AZURE_GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID || "";
const AZURE_GRAPH_CLIENT_ID =
  process.env.AZURE_GRAPH_CLIENT_ID || process.env.AZURE_APP_ID || "";
const AZURE_GRAPH_CLIENT_SECRET = process.env.AZURE_GRAPH_CLIENT_SECRET || "";

export const M365_DOMAIN = process.env.M365_DOMAIN || "biso.no";

export function getGraphService(): GraphUserService {
  if (
    !(
      AZURE_GRAPH_TENANT_ID &&
      AZURE_GRAPH_CLIENT_ID &&
      AZURE_GRAPH_CLIENT_SECRET
    )
  ) {
    throw new Error("Missing Microsoft Graph server credentials");
  }

  return new GraphUserService(
    AZURE_GRAPH_TENANT_ID,
    AZURE_GRAPH_CLIENT_ID,
    AZURE_GRAPH_CLIENT_SECRET
  );
}

export function toListItem(user: {
  accountEnabled?: boolean;
  createdDateTime?: string;
  department?: string;
  displayName: string;
  id: string;
  jobTitle?: string;
  lastNonInteractiveSignInDateTime?: string;
  lastSignInDateTime?: string;
  lastSuccessfulSignInDateTime?: string;
  mail?: string;
  officeLocation?: string;
  userPrincipalName: string;
}): M365UserListItem {
  return {
    accountEnabled: user.accountEnabled ?? null,
    createdDateTime: user.createdDateTime ?? null,
    department: user.department ?? null,
    displayName: user.displayName,
    id: user.id,
    jobTitle: user.jobTitle ?? null,
    lastNonInteractiveSignInDateTime:
      user.lastNonInteractiveSignInDateTime ?? null,
    lastSignInDateTime: user.lastSignInDateTime ?? null,
    lastSuccessfulSignInDateTime: user.lastSuccessfulSignInDateTime ?? null,
    mail: user.mail ?? null,
    officeLocation: user.officeLocation ?? null,
    userPrincipalName: user.userPrincipalName,
  };
}
