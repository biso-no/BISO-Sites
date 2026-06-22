/**
 * Pure helpers describing which managed `payment_settings` secret columns each
 * provider needs, and whether the active (test or live) set is complete. Drives
 * the admin "configured / not configured" surface without ever touching secret
 * values.
 */

export type PaymentProvider = "vipps" | "stripe";

/** Map of secret column key → whether a non-empty value is stored. */
export type SecretPresence = Record<string, boolean>;

const REQUIRED_SECRETS: Record<
  PaymentProvider,
  { test: string[]; live: string[] }
> = {
  vipps: {
    test: [
      "vipps_test_client_id",
      "vipps_test_client_secret",
      "vipps_test_subscription_key",
      "vipps_test_msn",
    ],
    live: [
      "vipps_live_client_id",
      "vipps_live_client_secret",
      "vipps_live_subscription_key",
      "vipps_live_msn",
    ],
  },
  stripe: {
    test: ["stripe_test_secret_key", "stripe_test_webhook_secret"],
    live: ["stripe_live_secret_key", "stripe_live_webhook_secret"],
  },
};

/**
 * Manageable-but-not-required secret columns. The Vipps webhook secret is
 * normally populated by the registration flow (not typed by hand), so it is
 * editable/visible in the UI but does not block the provider from being "ready".
 */
const OPTIONAL_SECRETS: Record<
  PaymentProvider,
  { test: string[]; live: string[] }
> = {
  vipps: {
    test: ["vipps_test_webhook_secret"],
    live: ["vipps_live_webhook_secret"],
  },
  stripe: { test: [], live: [] },
};

/** All secret column keys for a provider (both test and live sets). */
export function paymentSecretKeys(provider: PaymentProvider): string[] {
  return [
    ...REQUIRED_SECRETS[provider].test,
    ...OPTIONAL_SECRETS[provider].test,
    ...REQUIRED_SECRETS[provider].live,
    ...OPTIONAL_SECRETS[provider].live,
  ];
}

/** The secret column keys required for the active mode. */
export function requiredSecretKeys(
  provider: PaymentProvider,
  testMode: boolean
): string[] {
  return REQUIRED_SECRETS[provider][testMode ? "test" : "live"];
}

/**
 * Whether the active-mode secret set is complete, and which keys are missing.
 */
export function paymentProviderConfigStatus(
  provider: PaymentProvider,
  testMode: boolean,
  presence: SecretPresence
): { complete: boolean; missing: string[] } {
  const required = requiredSecretKeys(provider, testMode);
  const missing = required.filter((key) => !presence[key]);
  return { complete: missing.length === 0, missing };
}
