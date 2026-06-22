"use server";

import type { Models } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { PaymentSettingsRow } from "@repo/payment/credentials";
import {
  type PaymentProvider,
  paymentProviderConfigStatus,
  paymentSecretKeys,
} from "@repo/shared/utils/payment-config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { logAuditEvent } from "../_actions/audit-log";

const TABLE = "payment_settings";
const PROVIDERS: PaymentProvider[] = ["vipps", "stripe"];

export interface ProviderSecretView {
  configured: boolean;
  key: string;
}

export interface ProviderSettingsView {
  activeMode: "test" | "live";
  liveSecrets: ProviderSecretView[];
  provider: PaymentProvider;
  status: { complete: boolean; missing: string[] };
  testMode: boolean;
  testSecrets: ProviderSecretView[];
}

type ActionResult<T> = { data: T } | { error: string };

type SettingsDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

function isProvider(value: string): value is PaymentProvider {
  return value === "vipps" || value === "stripe";
}

function clean(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function requirePaymentAccess(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error(
      "Forbidden: only global admins can manage payment settings"
    );
  }
  return ctx;
}

async function readRow(
  db: SettingsDb,
  provider: PaymentProvider
): Promise<PaymentSettingsRow | null> {
  try {
    return await db.getRow<PaymentSettingsRow & Models.Row>(
      "app",
      TABLE,
      provider
    );
  } catch {
    return null;
  }
}

/**
 * Upserts the single per-provider row ($id = provider). Only the supplied
 * columns are written, so blank secret fields leave their stored value
 * untouched.
 */
async function upsertSettings(
  db: SettingsDb,
  provider: PaymentProvider,
  data: Record<string, unknown>
): Promise<void> {
  const existing = await readRow(db, provider);
  if (existing) {
    await db.updateRow("app", TABLE, provider, data);
  } else {
    await db.createRow("app", TABLE, provider, { provider, ...data });
  }
}

function buildView(
  provider: PaymentProvider,
  row: PaymentSettingsRow | null
): ProviderSettingsView {
  const testMode = row?.test_mode ?? true;
  const record = row as Record<string, unknown> | null;
  const presence: Record<string, boolean> = {};
  for (const key of paymentSecretKeys(provider)) {
    presence[key] = Boolean(clean(record?.[key] as string | undefined));
  }

  const secretsFor = (mode: "test" | "live"): ProviderSecretView[] =>
    paymentSecretKeys(provider)
      .filter((key) => key.includes(`_${mode}_`))
      .map((key) => ({ key, configured: presence[key] }));

  return {
    provider,
    testMode,
    activeMode: testMode ? "test" : "live",
    testSecrets: secretsFor("test"),
    liveSecrets: secretsFor("live"),
    status: paymentProviderConfigStatus(provider, testMode, presence),
  };
}

/**
 * Per-provider managed configuration as a write-only view: which secrets are
 * configured (never the values), the active mode, and completeness. Global
 * admin only.
 */
export async function getPaymentSettingsView(): Promise<
  ProviderSettingsView[]
> {
  await requirePaymentAccess();
  const { db } = await createSessionClient();

  const views: ProviderSettingsView[] = [];
  for (const provider of PROVIDERS) {
    const row = await readRow(db, provider);
    views.push(buildView(provider, row));
  }
  return views;
}

/**
 * Writes the supplied non-empty secret fields for a provider. Validates field
 * keys against the provider's allow-list, audits the field names (never the
 * values), and revalidates.
 */
export async function updatePaymentSecrets(
  provider: string,
  secrets: Record<string, string>
): Promise<ActionResult<ProviderSettingsView>> {
  try {
    const ctx = await requirePaymentAccess();
    if (!isProvider(provider)) {
      return { error: `Unknown provider: ${provider}` };
    }

    const allowed = new Set(paymentSecretKeys(provider));
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      const trimmed = clean(value);
      if (allowed.has(key) && trimmed) {
        updates[key] = trimmed;
      }
    }

    if (Object.keys(updates).length === 0) {
      return { error: "No values to update" };
    }

    const { db } = await createSessionClient();
    await upsertSettings(db, provider, updates);

    await logAuditEvent(ctx, "payment_setting.update", {
      resourceId: provider,
      resourceType: TABLE,
      // Field names only — the encrypted values must never be logged.
      payload: { provider, fields: Object.keys(updates) },
    });

    revalidatePath("/payment-settings");
    return { data: buildView(provider, await readRow(db, provider)) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update payment settings",
    };
  }
}

/** Toggles the per-provider test/live mode. Audited. */
export async function setPaymentTestMode(
  provider: string,
  testMode: boolean
): Promise<ActionResult<ProviderSettingsView>> {
  try {
    const ctx = await requirePaymentAccess();
    if (!isProvider(provider)) {
      return { error: `Unknown provider: ${provider}` };
    }

    const { db } = await createSessionClient();
    await upsertSettings(db, provider, { test_mode: testMode });

    await logAuditEvent(ctx, "payment_setting.toggle", {
      resourceId: provider,
      resourceType: TABLE,
      payload: { provider, testMode },
    });

    revalidatePath("/payment-settings");
    return { data: buildView(provider, await readRow(db, provider)) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update payment mode",
    };
  }
}
