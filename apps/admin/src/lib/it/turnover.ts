import type {
  GraphUserProfileUpdate,
  GraphUserService,
} from "@repo/connectors/azure/users";

// Plain module (NOT a "use server" file) so the turnover server action and the
// stop-retention cron can share these helpers — a sync export from a "use
// server" module would break the build.

/**
 * Microsoft states a retention policy may need up to 7 days to fully remove
 * Teams chat before it can be safely stopped, so the retention run is held
 * open for this long before the stop sweep tears it down.
 */
export const RETENTION_RUN_DAYS = 7;

const WHITESPACE_REGEX = /\s+/g;
const DEFAULT_WEBHOOK_TIMEOUT_MS = 20_000;

export type TurnoverRetentionAction = "start" | "stop";

export interface RetentionWebhookPayload {
  action: TurnoverRetentionAction;
  retentionDays: number;
  // Correlates the start/stop pair for the Azure Automation runbook.
  turnoverJobId?: string;
  userId: string;
  userUpn: string;
}

export interface RetentionWebhookResult {
  error?: string;
  ok: boolean;
  status?: number;
}

export interface TurnoverProfilePatch {
  displayName: string;
  givenName: string;
  surname: string;
}

/**
 * Build the Graph profile patch for a role-account handover. The login address
 * (UPN/mail) is deliberately left untouched — only the human-facing name
 * changes so the stable role identity is preserved. The concrete return type
 * (no undefineds) is also assignable to {@link GraphUserProfileUpdate}.
 */
export function buildTurnoverProfilePatch(
  firstName: string,
  lastName: string
): TurnoverProfilePatch {
  const given = firstName.trim();
  const surname = lastName.trim();
  const displayName = `${given} ${surname}`
    .replace(WHITESPACE_REGEX, " ")
    .trim();
  return {
    displayName,
    givenName: given,
    surname,
  } satisfies GraphUserProfileUpdate;
}

export function computeRetentionStopAt(
  fromMs: number,
  days: number = RETENTION_RUN_DAYS
): string {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export interface MfaMethodFailure {
  error: string;
  type: string;
}

export interface MfaResetOutcome {
  /** Methods Graph refused to delete, with the reason for each. */
  failures: MfaMethodFailure[];
  removedCount: number;
  removedTypes: string[];
  /** Methods left in place because Graph exposes no DELETE route for them. */
  skippedTypes: string[];
}

/**
 * Remove every removable authentication method (Authenticator, phone, the
 * private email recovery address, FIDO, …) so the holder's MFA no longer works
 * and the next holder re-registers from scratch. The password method is never
 * removable — Graph requires the account to keep one credential.
 *
 * Each method is deleted independently: one failure is recorded and the sweep
 * continues, so a single stubborn method cannot leave the rest registered. The
 * caller decides what a partial result means.
 */
export async function resetUserMfaMethods(
  graph: GraphUserService,
  userId: string
): Promise<MfaResetOutcome> {
  // `removable` is decided by the connector, which owns the Graph route table —
  // this module stays a type-only consumer of it.
  const methods = await graph.listAuthenticationMethods(userId);
  const toRemove = methods.filter((method) => method.removable);
  const skippedTypes = methods
    .filter((method) => !method.removable)
    .map((method) => method.type);

  const removedTypes: string[] = [];
  const failures: MfaMethodFailure[] = [];

  for (const method of toRemove) {
    try {
      await graph.deleteAuthenticationMethod(
        userId,
        method.id,
        method.odataType
      );
      removedTypes.push(method.type);
    } catch (error) {
      failures.push({
        type: method.type,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    failures,
    removedCount: removedTypes.length,
    removedTypes,
    skippedTypes,
  };
}

/**
 * Fire an Azure Automation retention webhook. The webhook URL itself carries
 * the automation account's auth token (that's how Automation webhooks work), so
 * no separate secret is sent. Never throws — the caller records the result on
 * the turnover job so a failure can be retried by the stop sweep.
 */
export async function postRetentionWebhook(
  url: string,
  payload: RetentionWebhookPayload,
  timeoutMs: number = DEFAULT_WEBHOOK_TIMEOUT_MS
): Promise<RetentionWebhookResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Retention webhook returned ${response.status}`,
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Retention webhook failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
