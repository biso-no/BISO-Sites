"use server";
import { createSessionClient } from "@repo/api/server";

type MembershipCheckResult =
  | {
      ok: true;
      active: boolean;
      membership?: Record<string, unknown>;
      studentId?: number;
      categories?: number[];
    }
  | { ok: false; error: string };

interface Identity {
  provider?: string;
}

interface MembershipPayload {
  active?: boolean;
  categories?: number[];
  error?: string;
  membership?: Record<string, unknown> & { status?: unknown };
  studentId?: number;
}

interface FunctionExecutionResult {
  response?: string;
  responseBody?: string;
}

export async function checkMembership(): Promise<MembershipCheckResult> {
  try {
    const { functions, account } = await createSessionClient();

    // Only verify if BI Student identity is linked
    try {
      const identities = await account.listIdentities();
      const hasBI = (identities?.identities || []).some(
        (identity: Identity) =>
          String(identity?.provider || "").toLowerCase() === "oidc"
      );
      if (!hasBI) {
        return { ok: true, active: false };
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Failed to inspect identities: ${message}`,
      };
    }
    const exec = (await functions.createExecution(
      "verify_biso_membership",
      undefined,
      false
    )) as FunctionExecutionResult;

    const raw = (exec && (exec.responseBody || exec.response)) ?? "{}";
    let data: MembershipPayload = {};
    try {
      data = JSON.parse(raw) as MembershipPayload;
    } catch {
      const sample = String(raw).slice(0, 200);
      return { ok: false, error: `Bad JSON from function: ${sample}` };
    }

    if (data?.error) {
      return { ok: false, error: String(data.error) };
    }

    const active: boolean = Boolean(data?.active || data?.membership?.status);
    const membership = data?.membership;
    const studentId =
      typeof data?.studentId === "number" ? data.studentId : undefined;
    const categories = Array.isArray(data?.categories)
      ? data.categories
      : undefined;

    return { ok: true, active, membership, studentId, categories };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
