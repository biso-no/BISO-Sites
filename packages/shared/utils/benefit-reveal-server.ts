import { ID, Permission, Query, Role } from "@repo/api";
import { isBenefitVisible } from "./benefit-visibility";

export interface RevealDb {
  createRow(
    table: string,
    id: string,
    data: Record<string, unknown>,
    permissions: string[]
  ): Promise<unknown>;
  getRow<T>(table: string, id: string): Promise<T>;
  listRows<T>(table: string, queries: string[]): Promise<{ rows: T[] }>;
}

export type RevealResult =
  | { ok: true; value: string }
  | {
      ok: false;
      reason: "no_code" | "not_found" | "not_member" | "unavailable";
    };

interface BenefitRow {
  campus_id: string;
  partner_id?: string | null;
  publish_end?: string | null;
  publish_start?: string | null;
  redemption_type?: string | null;
  redemption_value?: string | null;
  section?: string | null;
  status: string;
}

interface PartnerRow {
  is_active?: boolean | null;
}

const NOT_FOUND_TYPES = new Set(["row_not_found", "document_not_found"]);

/** Shared modules can't import app helpers, so this mirrors the apps' check. */
const CONFLICT_TYPES = new Set([
  "row_already_exists",
  "document_already_exists",
]);

function isRowConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, type } = error as { code?: unknown; type?: unknown };
  return code === 409 || (typeof type === "string" && CONFLICT_TYPES.has(type));
}

function isRowNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, type } = error as { code?: unknown; type?: unknown };
  return (
    code === 404 || (typeof type === "string" && NOT_FOUND_TYPES.has(type))
  );
}

async function getRowOrNull<T>(
  db: RevealDb,
  table: string,
  id: string
): Promise<T | null> {
  try {
    return await db.getRow<T>(table, id);
  } catch (error) {
    if (isRowNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function recordReveal(
  db: RevealDb,
  input: { benefitId: string; campusId: string; now: Date; userId: string }
): Promise<void> {
  const { benefitId, campusId, now, userId } = input;
  const existing = await db.listRows("benefit_reveals", [
    Query.equal("user_id", userId),
    Query.equal("benefit_id", benefitId),
    Query.limit(1),
  ]);
  if (existing.rows.length === 0) {
    try {
      await db.createRow(
        "benefit_reveals",
        ID.unique(),
        {
          benefit_id: benefitId,
          revealed_at: now.toISOString(),
          user_id: userId,
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
        ]
      );
    } catch (error) {
      // A concurrent reveal won the unique index: already revealed.
      if (!isRowConflict(error)) {
        throw error;
      }
    }
  }
  try {
    await db.createRow(
      "benefit_interactions",
      ID.unique(),
      {
        action: "reveal",
        benefit_id: benefitId,
        campus_id: campusId,
        metadata: null,
        user_id: userId,
      },
      [Permission.read(Role.user(userId))]
    );
  } catch {
    // Analytics only: never fail a reveal because of it.
  }
}

export async function revealBenefitCode(
  db: RevealDb,
  input: {
    benefitId: string;
    membership: "active" | "inactive" | "unavailable";
    now: Date;
    userId: string;
  }
): Promise<RevealResult> {
  const { benefitId, membership, now, userId } = input;
  if (membership === "unavailable") {
    return { ok: false, reason: "unavailable" };
  }
  if (membership === "inactive") {
    return { ok: false, reason: "not_member" };
  }

  const benefit = await getRowOrNull<BenefitRow>(
    db,
    "campus_benefits",
    benefitId
  );
  if (!benefit) {
    return { ok: false, reason: "not_found" };
  }
  const section = benefit.section ?? "member";
  if (section !== "member") {
    return { ok: false, reason: "not_found" };
  }
  const partner = benefit.partner_id
    ? await getRowOrNull<PartnerRow>(db, "benefit_partners", benefit.partner_id)
    : null;
  if (!isBenefitVisible(benefit, partner, now)) {
    return { ok: false, reason: "not_found" };
  }

  if (
    benefit.redemption_type !== "code" &&
    benefit.redemption_type !== "link"
  ) {
    return { ok: false, reason: "no_code" };
  }

  const codeRow = await getRowOrNull<{ value?: string | null }>(
    db,
    "benefit_codes",
    benefitId
  );
  const value = (
    (codeRow ? codeRow.value : benefit.redemption_value) ?? ""
  ).trim();
  if (value === "") {
    return { ok: false, reason: "no_code" };
  }

  await recordReveal(db, {
    benefitId,
    campusId: benefit.campus_id,
    now,
    userId,
  });
  return { ok: true, value };
}
