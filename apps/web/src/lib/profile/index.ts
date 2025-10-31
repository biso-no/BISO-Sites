"use server";
import { createSessionClient } from "../appwrite";

export type MembershipCheckResult =
  | { ok: true; active: boolean; membership?: any; studentId?: number; categories?: number[] }
  | { ok: false; error: string };

export async function checkMembership(): Promise<MembershipCheckResult> {
  try {
    const { functions, account } = await createSessionClient();

    // Only verify if BI Student identity is linked
    try {
      const identities = await account.listIdentities();
      const hasBI = (identities?.identities || []).some((i: any) => String(i?.provider || "").toLowerCase() === "oidc");
      if (!hasBI) {
        return { ok: true, active: false };
      }
    } catch (e: any) {
      return { ok: false, error: `Failed to inspect identities: ${String(e?.message || e)}` };
    }
    const exec: any = await functions.createExecution(
      "verify_biso_membership",
      undefined,
      false
    );

    const raw = (exec && (exec.responseBody || (exec as any).response)) ?? "{}";
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      const sample = String(raw).slice(0, 200);
      return { ok: false, error: `Bad JSON from function: ${sample}` };
    }

    if (data?.error) {
      return { ok: false, error: String(data.error) };
    }

    const active: boolean = Boolean(data?.active || data?.membership?.status);
    const membership = data?.membership;
    const studentId = typeof data?.studentId === "number" ? data.studentId : undefined;
    const categories = Array.isArray(data?.categories) ? data.categories : undefined;

    return { ok: true, active, membership, studentId, categories };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}
