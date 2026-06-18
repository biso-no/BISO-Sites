/**
 * Read-only integration health: which external integrations are fully
 * configured, based on the presence of their environment variables.
 *
 * This module never reads `process.env` itself and never holds a secret value
 * — the caller passes an `isPresent(key)` predicate, so only key *names* and
 * boolean presence flow through here. That keeps it pure and unit-testable and
 * guarantees the operations surface can show config status without leaking
 * secrets. Each integration links to the runbook for fixing a gap.
 */

export type IntegrationStatusValue =
  | "configured"
  | "incomplete"
  | "not_configured";

export type IntegrationCategory =
  | "core"
  | "identity"
  | "documents"
  | "payments"
  | "schedulers";

export interface IntegrationDef {
  category: IntegrationCategory;
  /** Names of the env vars required for this integration (no values). */
  envKeys: string[];
  id: string;
  label: string;
  purpose: string;
  /** Docs runbook path for fixing a gap. */
  runbook: string;
}

export interface IntegrationHealthEntry extends IntegrationDef {
  missingKeys: string[];
  presentKeys: string[];
  status: IntegrationStatusValue;
}

export interface IntegrationHealthReport {
  configuredCount: number;
  entries: IntegrationHealthEntry[];
  incompleteCount: number;
  notConfiguredCount: number;
}

export const INTEGRATIONS: readonly IntegrationDef[] = [
  {
    id: "appwrite",
    label: "Appwrite",
    category: "core",
    envKeys: [
      "NEXT_PUBLIC_APPWRITE_ENDPOINT",
      "NEXT_PUBLIC_APPWRITE_PROJECT",
      "APPWRITE_API_KEY",
    ],
    runbook: "/docs/operations/monitoring-and-health",
    purpose:
      "The backend for all data, auth, and storage. Without the service key, " +
      "every admin operation that bypasses row security fails.",
  },
  {
    id: "microsoft365",
    label: "Microsoft 365",
    category: "identity",
    envKeys: [
      "AZURE_GRAPH_CLIENT_ID",
      "AZURE_GRAPH_CLIENT_SECRET",
      "AZURE_GRAPH_TENANT_ID",
      "M365_DOMAIN",
    ],
    runbook: "/docs/integrations",
    purpose:
      "Azure AD sign-in and the Graph sync that mirrors security groups into " +
      "Appwrite teams (the source of all admin roles).",
  },
  {
    id: "sharepoint",
    label: "SharePoint",
    category: "documents",
    envKeys: [
      "SHAREPOINT_CLIENT_ID",
      "SHAREPOINT_CLIENT_SECRET",
      "SHAREPOINT_TENANT_ID",
      "SHAREPOINT_SITES",
      "SHAREPOINT_DOCUMENTS_DRIVE_ID",
    ],
    runbook: "/docs/operations/incident-response",
    purpose: "Document storage and download for the documents feature.",
  },
  {
    id: "vipps",
    label: "Vipps MobilePay",
    category: "payments",
    envKeys: [
      "VIPPS_CLIENT_ID",
      "VIPPS_CLIENT_SECRET",
      "VIPPS_MERCHANT_SERIAL_NUMBER",
      "VIPPS_SUBSCRIPTION_KEY",
    ],
    runbook: "/docs/operations/incident-response",
    purpose: "Checkout payments for the shop. Missing keys break checkout.",
  },
  {
    id: "schedulers",
    label: "Scheduler secrets",
    category: "schedulers",
    envKeys: ["CRON_SECRET", "ENTUR_SYNC_SECRET", "TICKSTER_SYNC_SECRET"],
    runbook: "/docs/operations/cron-and-scheduled-tasks",
    purpose:
      "Shared secrets the external scheduler must send to run reservation " +
      "cleanup, announcement dispatch, and the transit/ticket sync routes.",
  },
];

function statusFor(
  presentCount: number,
  missingCount: number
): IntegrationStatusValue {
  if (missingCount === 0) {
    return "configured";
  }
  if (presentCount === 0) {
    return "not_configured";
  }
  return "incomplete";
}

/**
 * Evaluate each integration's configuration status using the supplied presence
 * predicate (typically `(key) => Boolean(process.env[key]?.trim())`).
 */
export function checkIntegrationHealth(
  isPresent: (key: string) => boolean
): IntegrationHealthReport {
  const entries: IntegrationHealthEntry[] = INTEGRATIONS.map((integration) => {
    const presentKeys = integration.envKeys.filter((key) => isPresent(key));
    const missingKeys = integration.envKeys.filter((key) => !isPresent(key));
    return {
      ...integration,
      status: statusFor(presentKeys.length, missingKeys.length),
      presentKeys,
      missingKeys,
    };
  });

  return {
    entries,
    configuredCount: entries.filter((e) => e.status === "configured").length,
    incompleteCount: entries.filter((e) => e.status === "incomplete").length,
    notConfiguredCount: entries.filter((e) => e.status === "not_configured")
      .length,
  };
}
