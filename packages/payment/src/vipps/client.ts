import { Client } from "@vippsmobilepay/sdk";
import type { VippsCredentials } from "../credentials/types";

/**
 * Builds a Vipps SDK client from resolved credentials. Credentials are always
 * passed in (never read from `process.env` here) so the managed test/live
 * configuration drives which merchant + mode is used.
 */
export function buildVippsClient(
  creds: VippsCredentials
): ReturnType<typeof Client> {
  return Client({
    merchantSerialNumber: creds.merchantSerialNumber,
    subscriptionKey: creds.subscriptionKey,
    useTestMode: creds.testMode,
    retryRequests: false,
    pluginName: "biso-payment",
    pluginVersion: "1.0.0",
    systemName: "biso",
    systemVersion: "1.0.0",
  });
}

/**
 * Fetches a short-lived ePayment access token. The ePayment, webhook, and
 * order-management endpoints all take this bearer token (unlike the legacy
 * Checkout API, which took the client id/secret per call).
 */
export async function getVippsAccessToken(
  creds: VippsCredentials
): Promise<string> {
  const client = buildVippsClient(creds);
  const result = await client.auth.getToken(creds.clientId, creds.clientSecret);
  if (!result.ok) {
    throw new Error(`Vipps authentication failed: ${JSON.stringify(result)}`);
  }
  return result.data.access_token;
}
