"use server";
import { createSessionClient } from "@repo/api/server";

interface MembershipData {
  status?: unknown;
  [key: string]: unknown;
}

interface CheckMembershipData {
  active?: boolean;
  categories?: number[];
  error?: string;
  membership?: MembershipData;
  studentId?: number;
}

export type MembershipCheckResult =
  | {
      ok: true;
      active: boolean;
      membership?: MembershipData;
      studentId?: number;
      categories?: number[];
    }
  | { ok: false; error: string };

interface IdentityLike {
  provider?: string;
}
interface IdentitiesResponse {
  identities?: IdentityLike[];
}
interface ExecutionLike {
  response?: string;
  responseBody?: string;
}

export async function checkMembership(): Promise<MembershipCheckResult> {
  try {
    const { functions, account } = await createSessionClient();

    // Only verify if BI Student identity is linked
    try {
      const identities = (await account.listIdentities()) as IdentitiesResponse;
      const hasBI = (identities?.identities || []).some(
        (i) => String(i?.provider || "").toLowerCase() === "oidc"
      );
      if (!hasBI) {
        return { ok: true, active: false };
      }
    } catch (e) {
      return {
        ok: false,
        error: `Failed to inspect identities: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    const exec = (await functions.createExecution(
      "verify_biso_membership",
      undefined,
      false
    )) as unknown as ExecutionLike;

    const raw = (exec && (exec.responseBody || exec.response)) ?? "{}";
    let data: CheckMembershipData = {};
    try {
      data = JSON.parse(raw) as CheckMembershipData;
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
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
