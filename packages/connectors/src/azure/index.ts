import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { ClientSecretCredential } from "@azure/identity";

export const createGraphClient = (
  tenantId: string,
  clientId: string,
  clientSecret: string
) => {
  // Create the auth credentials for application-only (daemon) authentication
  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );

  // Create the auth provider with application permissions
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"]
  });

  // Initialize the Graph client
  const graphClient = Client.initWithMiddleware({
    authProvider
  });

  return graphClient;
};

export type { Client as GraphClient } from "@microsoft/microsoft-graph-client";