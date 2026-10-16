import "server-only";
import { googleClassId, signServiceAccountJwt } from "./google-pass";
import type { GoogleWalletConfig } from "./wallet-config";

/**
 * Google Wallet REST API client (server-only). Writes the Generic Class and
 * the member's Generic Object through the API so the TOTP key never appears
 * in a save link, and so a renewed membership updates a pass that is
 * already saved.
 *
 * https://developers.google.com/wallet/reference/rest/v1/genericobject
 * https://developers.google.com/identity/protocols/oauth2/service-account
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
/** Google caps the assertion lifetime at one hour. */
const ASSERTION_LIFETIME_SECONDS = 3600;
/** Refresh the cached token this long before Google says it expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

type WalletResource = "genericClass" | "genericObject";

export class GoogleWalletApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleWalletApiError";
    this.status = status;
  }
}

let cachedToken: {
  clientEmail: string;
  expiresAt: number;
  token: string;
} | null = null;

/** Test hook: forget the cached access token. */
export function resetGoogleWalletTokenCache(): void {
  cachedToken = null;
}

/** An OAuth access token for the service account, cached until near expiry. */
export async function getGoogleWalletAccessToken(
  config: GoogleWalletConfig,
  now: number = Date.now()
): Promise<string> {
  if (
    cachedToken &&
    cachedToken.clientEmail === config.clientEmail &&
    cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now
  ) {
    return cachedToken.token;
  }
  const iat = Math.floor(now / 1000);
  const assertion = signServiceAccountJwt(
    {
      aud: TOKEN_URL,
      exp: iat + ASSERTION_LIFETIME_SECONDS,
      iat,
      iss: config.clientEmail,
      scope: SCOPE,
    },
    config.privateKey
  );
  const response = await fetch(TOKEN_URL, {
    body: new URLSearchParams({ assertion, grant_type: JWT_BEARER_GRANT }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new GoogleWalletApiError(
      "Google OAuth token request failed",
      response.status
    );
  }
  const body = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof body.access_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    throw new GoogleWalletApiError(
      "Google OAuth token response was malformed",
      response.status
    );
  }
  cachedToken = {
    clientEmail: config.clientEmail,
    expiresAt: now + body.expires_in * 1000,
    token: body.access_token,
  };
  return body.access_token;
}

async function walletRequest(
  token: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<Response> {
  return await fetch(`${API_BASE}/${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function ensureOk(response: Response, action: string): void {
  if (!response.ok) {
    throw new GoogleWalletApiError(
      `Google Wallet ${action} failed`,
      response.status
    );
  }
}

/** GET by id → 404 → insert (POST); otherwise replace (PUT). */
async function upsert(
  token: string,
  resource: WalletResource,
  body: { id: string }
): Promise<void> {
  const itemPath = `${resource}/${encodeURIComponent(body.id)}`;
  const existing = await walletRequest(token, "GET", itemPath);
  if (existing.status === HTTP_NOT_FOUND) {
    const inserted = await walletRequest(token, "POST", resource, body);
    // Another request inserted it first: fall through to an update.
    if (inserted.status !== HTTP_CONFLICT) {
      ensureOk(inserted, `${resource} insert`);
      return;
    }
  } else {
    ensureOk(existing, `${resource} get`);
  }
  const updated = await walletRequest(token, "PUT", itemPath, body);
  ensureOk(updated, `${resource} update`);
}

/**
 * Creates or updates the BISO Generic Class and this member's Generic
 * Object. Throws GoogleWalletApiError when Google rejects a request.
 */
export async function syncGoogleWalletPass(
  config: GoogleWalletConfig,
  genericObject: { id: string } & Record<string, unknown>
): Promise<void> {
  const token = await getGoogleWalletAccessToken(config);
  await upsert(token, "genericClass", { id: googleClassId(config.issuerId) });
  await upsert(token, "genericObject", genericObject);
}
