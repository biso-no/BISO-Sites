import type {
  CredentialEnv,
  PaymentSettingsRow,
  StripeCredentials,
  VippsCredentials,
} from "./types";

/** Trim and drop empty/whitespace-only values. */
function clean(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Picks the active Vipps credential set.
 *
 * Preference order: the managed DB row's active-mode set (when complete) →
 * the `VIPPS_*` env fallback. The webhook secret is read from the active-mode
 * column (env `VIPPS_WEBHOOK_SECRET` fallback) and may be empty until the
 * webhook is registered. Returns `null` when neither source is complete.
 */
export function selectVippsCredentials(
  row: PaymentSettingsRow | null,
  env: CredentialEnv
): VippsCredentials | null {
  const envWebhookSecret = clean(env.VIPPS_WEBHOOK_SECRET) ?? "";

  if (row) {
    const testMode = row.test_mode ?? true;
    const clientId = clean(
      testMode ? row.vipps_test_client_id : row.vipps_live_client_id
    );
    const clientSecret = clean(
      testMode ? row.vipps_test_client_secret : row.vipps_live_client_secret
    );
    const subscriptionKey = clean(
      testMode
        ? row.vipps_test_subscription_key
        : row.vipps_live_subscription_key
    );
    const merchantSerialNumber = clean(
      testMode ? row.vipps_test_msn : row.vipps_live_msn
    );
    const webhookSecret =
      clean(
        testMode ? row.vipps_test_webhook_secret : row.vipps_live_webhook_secret
      ) ?? envWebhookSecret;

    if (clientId && clientSecret && subscriptionKey && merchantSerialNumber) {
      return {
        clientId,
        clientSecret,
        subscriptionKey,
        merchantSerialNumber,
        webhookSecret,
        testMode,
      };
    }
  }

  const clientId = clean(env.VIPPS_CLIENT_ID);
  const clientSecret = clean(env.VIPPS_CLIENT_SECRET);
  const subscriptionKey = clean(env.VIPPS_SUBSCRIPTION_KEY);
  const merchantSerialNumber = clean(env.VIPPS_MERCHANT_SERIAL_NUMBER);

  if (clientId && clientSecret && subscriptionKey && merchantSerialNumber) {
    return {
      clientId,
      clientSecret,
      subscriptionKey,
      merchantSerialNumber,
      webhookSecret: envWebhookSecret,
      testMode: env.VIPPS_TEST_MODE === "true",
    };
  }

  return null;
}

/**
 * Picks the active Stripe credential set.
 *
 * The secret key is required to transact; the webhook secret may be empty
 * (checkout still works, only signature verification needs it). In the env
 * fallback the mode is inferred from the key prefix (`sk_live_` → live).
 */
export function selectStripeCredentials(
  row: PaymentSettingsRow | null,
  env: CredentialEnv
): StripeCredentials | null {
  if (row) {
    const testMode = row.test_mode ?? true;
    const secretKey = clean(
      testMode ? row.stripe_test_secret_key : row.stripe_live_secret_key
    );
    const webhookSecret =
      clean(
        testMode
          ? row.stripe_test_webhook_secret
          : row.stripe_live_webhook_secret
      ) ?? "";

    if (secretKey) {
      return { secretKey, webhookSecret, testMode };
    }
  }

  const secretKey = clean(env.STRIPE_SECRET_KEY);
  const webhookSecret = clean(env.STRIPE_WEBHOOK_SECRET) ?? "";

  if (secretKey) {
    return {
      secretKey,
      webhookSecret,
      testMode: !secretKey.startsWith("sk_live_"),
    };
  }

  return null;
}
