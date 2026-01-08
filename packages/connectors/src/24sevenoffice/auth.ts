/**
 * 24SevenOffice Authentication Service
 *
 * Manages session tokens for 24SevenOffice SOAP API.
 * Tokens are cached in the database for 24 hours.
 */

import { createSessionClient } from "@repo/api/server";
import { createSoapClient } from "./client";
import type {
  Credentials,
  HasSessionResult,
  LoginResult,
  StoredToken,
} from "./types";

// Token validity: 23 hours (1 hour safety margin before 24hr expiry)
const TOKEN_MAX_AGE_MS = 23 * 60 * 60 * 1000;

const DATABASE_ID = "app";
const TOKENS_TABLE = "24sevenoffice_auth_tokens";

/**
 * Get a valid session token, either from cache or by logging in
 */
export async function getValidSession(): Promise<string> {
  const { db } = await createSessionClient();

  // Check for stored token
  const stored = await getStoredToken(db);

  if (stored && !isNearExpiry(stored.$createdAt)) {
    // Verify session is still valid with 24SO
    const isValid = await hasSession(stored.token);
    if (isValid) {
      return stored.token;
    }
  }

  // Login and store new token
  const credentials = getCredentials();
  const newToken = await login(credentials);
  await storeToken(db, newToken);

  return newToken;
}

/**
 * Check if a session token is still valid
 */
export async function hasSession(token: string): Promise<boolean> {
  try {
    const client = await createSoapClient("authenticate");
    client.addHttpHeader("Cookie", `ASP.NET_SessionId=${token}`);

    const [result]: [HasSessionResult] = await client.HasSessionAsync({});
    return result.HasSessionResult === true;
  } catch (error) {
    console.error("[24SO Auth] HasSession check failed:", error);
    return false;
  }
}

/**
 * Login to 24SevenOffice and get a session token
 */
async function login(credentials: Credentials): Promise<string> {
  const client = await createSoapClient("authenticate");

  const [result]: [LoginResult] = await client.LoginAsync({
    credential: {
      ApplicationId: credentials.ApplicationId,
      IdentityId: credentials.IdentityId,
      Username: credentials.Username,
      Password: credentials.Password,
    },
  });

  if (!result.LoginResult) {
    throw new Error("[24SO Auth] Login failed - no token received");
  }

  console.log("[24SO Auth] Successfully authenticated");
  return result.LoginResult;
}

/**
 * Get stored token from database
 */
async function getStoredToken(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"]
): Promise<StoredToken | null> {
  try {
    const response = await db.listRows<StoredToken>(DATABASE_ID, TOKENS_TABLE, [
      // Get most recent token
    ]);

    if (response.rows.length === 0) {
      return null;
    }

    // Return the first (most recent) token
    return response.rows[0] ?? null;
  } catch (error) {
    console.error("[24SO Auth] Failed to get stored token:", error);
    return null;
  }
}

/**
 * Store a new token in database (replace existing)
 */
async function storeToken(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  token: string
): Promise<void> {
  try {
    // Delete existing tokens
    const existing = await db.listRows<StoredToken>(DATABASE_ID, TOKENS_TABLE);
    for (const row of existing.rows) {
      try {
        await db.deleteRow(DATABASE_ID, TOKENS_TABLE, row.$id);
      } catch {
        // Ignore delete errors
      }
    }

    // Create new token
    await db.createRow(DATABASE_ID, TOKENS_TABLE, { token });
    console.log("[24SO Auth] Stored new session token");
  } catch (error) {
    console.error("[24SO Auth] Failed to store token:", error);
    throw error;
  }
}

/**
 * Check if token is near expiry (within safety margin)
 */
function isNearExpiry(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const age = now - created;
  return age >= TOKEN_MAX_AGE_MS;
}

/**
 * Get credentials from environment variables
 */
function getCredentials(): Credentials {
  const appId = process.env.TFSO_APP_ID;
  const identityId = process.env.TFSO_IDENTITY_ID;
  const username = process.env.TFSO_USERNAME;
  const password = process.env.TFSO_PASSWORD;

  if (!appId || !identityId || !username || !password) {
    throw new Error(
      "[24SO Auth] Missing credentials. Required env vars: TFSO_APP_ID, TFSO_IDENTITY_ID, TFSO_USERNAME, TFSO_PASSWORD"
    );
  }

  return {
    ApplicationId: appId,
    IdentityId: identityId,
    Username: username,
    Password: password,
  };
}
