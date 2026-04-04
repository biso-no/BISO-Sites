import { Client } from "@vippsmobilepay/sdk";

const clientId = process.env.VIPPS_CLIENT_ID!;
const clientSecret = process.env.VIPPS_CLIENT_SECRET!;
const merchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER!;
const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY!;
const testMode = process.env.VIPPS_TEST_MODE === "true";

export const client: ReturnType<typeof Client> = Client({
  merchantSerialNumber,
  subscriptionKey,
  useTestMode: testMode,
  retryRequests: false,
  pluginName: "biso-payment",
  pluginVersion: "1.0.0",
  systemName: "biso",
  systemVersion: "1.0.0",
});

export async function getAccessToken(): Promise<string> {
  const token = await client.auth.getToken(clientId, clientSecret);
  if (token.ok) {
    return token.data.access_token;
  }
  throw new Error("Failed to get Vipps access token");
}
