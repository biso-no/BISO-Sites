import { selectStripeCredentials, selectVippsCredentials } from "./select";
import type {
  CredentialEnv,
  PaymentProvider,
  PaymentSettingsReader,
  PaymentSettingsRow,
  StripeCredentials,
  VippsCredentials,
} from "./types";

const TABLE_ID = "payment_settings";
const CACHE_TTL_MS = 15_000;

interface CacheEntry {
  at: number;
  row: PaymentSettingsRow | null;
}
const rowCache = new Map<PaymentProvider, CacheEntry>();

function databaseId(): string {
  return process.env.APPWRITE_DATABASE_ID ?? "app";
}

/**
 * Reads the managed `payment_settings` row for a provider through the caller's
 * admin `db` client, with a short in-process TTL cache (mirrors the
 * feature-flag reader). A missing row (404) resolves to `null` so the pure
 * selectors fall back to env.
 */
async function readSettingsRow(
  provider: PaymentProvider,
  db: PaymentSettingsReader
): Promise<PaymentSettingsRow | null> {
  const cached = rowCache.get(provider);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.row;
  }

  let row: PaymentSettingsRow | null = null;
  try {
    row = await db.getRow<PaymentSettingsRow>(databaseId(), TABLE_ID, provider);
  } catch (e) {
    console.warn(
      `[payment/credentials] ${provider} row not found in DB (${(e as Error)?.message ?? e}) — falling back to env`
    );
    row = null;
  }

  rowCache.set(provider, { at: Date.now(), row });
  return row;
}

/** Clears the credential row cache (use after an admin config change). */
export function clearPaymentCredentialCache(): void {
  rowCache.clear();
}

export async function resolveVippsCredentials(
  db: PaymentSettingsReader,
  env: CredentialEnv = process.env
): Promise<VippsCredentials | null> {
  const row = await readSettingsRow("vipps", db);
  return selectVippsCredentials(row, env);
}

export async function resolveStripeCredentials(
  db: PaymentSettingsReader,
  env: CredentialEnv = process.env
): Promise<StripeCredentials | null> {
  const row = await readSettingsRow("stripe", db);
  return selectStripeCredentials(row, env);
}
