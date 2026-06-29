/**
 * Code-defined catalog of operational feature flags ("kill switches").
 *
 * The `feature_flags` Appwrite table only stores on/off state per `key`. WHICH
 * flags exist, what they gate, how they group, and their default state live
 * here in code — because a meaningful flag must map to real code paths, and the
 * table schema (auto-generated) has no group column.
 *
 * Reading a flag = DB override if a row exists for the key, else the catalog
 * `defaultEnabled`. Defaults are fail-safe: kill switches default ON so a
 * missing/erroring DB never silently disables a core feature; `payments_stripe`
 * defaults OFF so a half-built provider is never exposed.
 *
 * Pure module — no Appwrite client, no server imports — safe to import from
 * client components. The runtime reader lives in `feature-flags-server.ts`.
 */

export const FEATURE_FLAG_GROUPS = ["expenses", "payments", "ai"] as const;
export type FeatureFlagGroup = (typeof FEATURE_FLAG_GROUPS)[number];

export interface FeatureFlagDef {
  /** State used when no DB row exists for the key. */
  defaultEnabled: boolean;
  description: string;
  group: FeatureFlagGroup;
  /** Stable id stored in the `feature_flags.key` column. */
  key: string;
  title: string;
}

export const FEATURE_FLAGS = [
  {
    key: "expenses_module",
    group: "expenses",
    title: "Reimbursements module",
    description:
      "The student reimbursement/expenses feature at /fs. Turn off to take the " +
      "whole module offline during an incident — the pages show an unavailable " +
      "state and submit/draft are refused.",
    defaultEnabled: true,
  },
  {
    key: "expenses_ocr",
    group: "expenses",
    title: "Receipt scanning (AI/OCR)",
    description:
      "AI receipt scanning that auto-fills reimbursement forms. Turn off to " +
      "disable scanning only — manual entry keeps working. Also requires the " +
      "reimbursements module to be on.",
    defaultEnabled: true,
  },
  {
    key: "expenses_ledger_posting",
    group: "expenses",
    title: "Direct ledger posting (24SO + Teams approval)",
    description:
      "Route submitted reimbursements through a Microsoft Teams/Outlook approval " +
      "and post them straight to the 24SevenOffice ledger instead of emailing " +
      "accounting. Off by default until staging E2E — when off, submit keeps the " +
      "email-to-accounting behavior.",
    defaultEnabled: false,
  },
  {
    key: "payments_vipps",
    group: "payments",
    title: "Vipps checkout",
    description:
      "Vipps MobilePay as a webshop payment option. Turn off if Vipps is down; " +
      "it is hidden at checkout and rejected server-side.",
    defaultEnabled: true,
  },
  {
    key: "payments_stripe",
    group: "payments",
    title: "Stripe (card) checkout",
    description:
      "Stripe card payments as a webshop option. Off by default; turn on to " +
      "offer card checkout (requires the Stripe backend — Phase C).",
    defaultEnabled: false,
  },
  {
    key: "ai_admin_copilot",
    group: "ai",
    title: "Admin AI copilot",
    description:
      "The admin AI assistant widget and its API. Turn off if the assistant " +
      "misbehaves — the widget is hidden and the endpoint returns 403.",
    defaultEnabled: true,
  },
] as const satisfies readonly FeatureFlagDef[];

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]["key"];

/** Typed accessor map: `FEATURE_FLAG_KEYS.payments_vipps === "payments_vipps"`. */
export const FEATURE_FLAG_KEYS = Object.fromEntries(
  FEATURE_FLAGS.map((flag) => [flag.key, flag.key])
) as { [K in FeatureFlagKey]: K };

const FLAG_BY_KEY = new Map<string, FeatureFlagDef>(
  FEATURE_FLAGS.map((flag) => [flag.key, flag])
);

export function getFlagDef(key: string): FeatureFlagDef | undefined {
  return FLAG_BY_KEY.get(key);
}

export function isKnownFlagKey(key: string): key is FeatureFlagKey {
  return FLAG_BY_KEY.has(key);
}

export interface FeatureFlagRow {
  enabled: boolean;
  key: string;
}

/**
 * Resolve the effective on/off state for every catalog flag from the DB rows.
 * A row override wins over the catalog default; rows whose key is not in the
 * catalog are ignored (they gate nothing).
 */
export function mergeFlagStates(
  rows: readonly FeatureFlagRow[]
): Record<FeatureFlagKey, boolean> {
  const overrides = new Map(rows.map((row) => [row.key, row.enabled]));
  const states = {} as Record<FeatureFlagKey, boolean>;
  for (const flag of FEATURE_FLAGS) {
    const override = overrides.get(flag.key);
    states[flag.key as FeatureFlagKey] =
      override === undefined ? flag.defaultEnabled : override;
  }
  return states;
}
