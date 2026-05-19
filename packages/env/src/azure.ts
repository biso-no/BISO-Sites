import { z } from "zod";

export const azureServer = {
  AZURE_APP_ID: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
};

export const azureGraphServer = {
  AZURE_GRAPH_TENANT_ID: z.string().optional(),
  AZURE_GRAPH_CLIENT_ID: z.string().optional(),
  AZURE_GRAPH_CLIENT_SECRET: z.string().optional(),
  AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL: z.string().optional(),
  M365_DOMAIN: z.string().default("biso.no"),
};
