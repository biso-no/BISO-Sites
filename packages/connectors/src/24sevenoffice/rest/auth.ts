/**
 * Finago REST API — OAuth2 Authentication
 *
 * Manages bearer tokens for the Finago REST API using the
 * OAuth 2.0 Client Credentials Flow. Tokens are cached in memory
 * and refreshed automatically 60 seconds before expiry.
 */

const TOKEN_URL = "https://login.24sevenoffice.com/oauth/token";
const AUDIENCE = "https://api.24sevenoffice.com";

// Refresh token 60 seconds before it actually expires
const EXPIRY_BUFFER_MS = 60 * 1000;

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cached: CachedToken | null = null;

/**
 * Returns a valid bearer token, fetching a new one if expired or missing.
 */
export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.accessToken;
  }

  const { clientId, clientSecret, loginOrganization } = getCredentials();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    audience: AUDIENCE,
    client_id: clientId,
    client_secret: clientSecret,
    login_organization: loginOrganization,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `[Finago Auth] Token request failed: ${response.status} ${response.statusText} — ${text}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error(
      `[Finago Auth] Token response did not contain access_token: ${JSON.stringify(data)}`
    );
  }

  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - EXPIRY_BUFFER_MS,
  };

  console.log("[Finago Auth] Obtained new access token");
  return cached.accessToken;
}

function getCredentials() {
  const clientId = process.env.TFSO_REST_CLIENT_ID;
  const clientSecret = process.env.TFSO_REST_CLIENT_SECRET;
  const loginOrganization = process.env.TFSO_REST_ORG_ID;

  if (!(clientId && clientSecret && loginOrganization)) {
    throw new Error(
      "[Finago Auth] Missing credentials. Required env vars: TFSO_REST_CLIENT_ID, TFSO_REST_CLIENT_SECRET, TFSO_REST_ORG_ID"
    );
  }

  return { clientId, clientSecret, loginOrganization };
}
