/**
 * Managed payment provider configuration.
 *
 * The `payment_settings` Appwrite table stores one row per provider
 * (`$id` = "vipps" | "stripe") with `encrypt:true` secret columns for both a
 * test and a live credential set, plus a `test_mode` toggle that selects which
 * set is active. This row type is hand-written (rather than pulled from the
 * generated `@repo/api/types/appwrite`) so `@repo/payment` stays decoupled from
 * the Appwrite SDK; regenerate the schema types separately if you prefer.
 */
export interface PaymentSettingsRow {
  $id: string;
  stripe_live_secret_key?: string | null;
  stripe_live_webhook_secret?: string | null;
  stripe_test_secret_key?: string | null;
  stripe_test_webhook_secret?: string | null;
  test_mode?: boolean | null;
  vipps_live_client_id?: string | null;
  vipps_live_client_secret?: string | null;
  vipps_live_msn?: string | null;
  vipps_live_subscription_key?: string | null;
  vipps_live_webhook_secret?: string | null;
  vipps_test_client_id?: string | null;
  vipps_test_client_secret?: string | null;
  vipps_test_msn?: string | null;
  vipps_test_subscription_key?: string | null;
  vipps_test_webhook_secret?: string | null;
}

export type PaymentProvider = "vipps" | "stripe";

/** Resolved Vipps credentials for the active (test or live) mode. */
export interface VippsCredentials {
  clientId: string;
  clientSecret: string;
  merchantSerialNumber: string;
  subscriptionKey: string;
  testMode: boolean;
  /**
   * ePayment webhook signing secret (returned at registration). Empty string
   * when not yet registered — payments still work, webhook verification won't.
   */
  webhookSecret: string;
}

/** Resolved Stripe credentials for the active (test or live) mode. */
export interface StripeCredentials {
  secretKey: string;
  testMode: boolean;
  /** Empty string when not configured — checkout works, webhook verify won't. */
  webhookSecret: string;
}

/** Minimal env shape, injectable for testing. */
export type CredentialEnv = Record<string, string | undefined>;

/** Minimal Appwrite `db` reader — avoids depending on `@repo/api/server`. */
export interface PaymentSettingsReader {
  getRow: <T = unknown>(
    databaseId: string,
    tableId: string,
    rowId: string,
    queries?: string[]
  ) => Promise<T>;
}
