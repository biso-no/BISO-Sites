// Microsoft Graph helper for the api service (expense approver resolution).

import { GraphUserService } from "@repo/connectors/azure/users";

const AZURE_GRAPH_TENANT_ID =
  process.env.AZURE_GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID || "";
const AZURE_GRAPH_CLIENT_ID =
  process.env.AZURE_GRAPH_CLIENT_ID || process.env.AZURE_APP_ID || "";
const AZURE_GRAPH_CLIENT_SECRET = process.env.AZURE_GRAPH_CLIENT_SECRET || "";

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
