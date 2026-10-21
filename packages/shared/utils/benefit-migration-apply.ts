import {
  type MigrationPlan,
  type PlannedLine,
  type PlannedRowUpdate,
  validateMigrationPlan,
} from "./benefit-migration";

export type MigrationTable =
  | "benefit_codes"
  | "benefit_partners"
  | "campus_benefits";

export interface MigrationWriter {
  /** "missing" means the row was already gone (Appwrite 404). */
  deleteRow(
    table: "campus_benefits",
    rowId: string
  ): Promise<"deleted" | "missing">;
  updateRow(
    table: "campus_benefits",
    rowId: string,
    data: Record<string, unknown>,
    permissions?: string[]
  ): Promise<void>;
  upsertRow(
    table: MigrationTable,
    rowId: string,
    data: Record<string, unknown>,
    permissions?: string[]
  ): Promise<void>;
}

export interface MigrationApplyResult {
  codes: number;
  created: number;
  deleted: number;
  partners: number;
  updated: number;
}

export class InvalidMigrationPlanError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Ugyldig migreringsplan: ${problems.length} problem(er)`);
    this.name = "InvalidMigrationPlanError";
    this.problems = problems;
  }
}

/** Rethrows with table/row context; never includes data values (codes). */
async function guarded<T>(
  table: MigrationTable,
  rowId: string,
  write: () => Promise<T>
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${table}/${rowId}: ${reason}`, { cause: error });
  }
}

const PUBLIC_READ = ['read("any")'];

function createData(
  line: PlannedLine,
  partnerIds: Map<string, string>
): Record<string, unknown> {
  return {
    campus: line.campusId,
    campus_id: line.campusId,
    section: line.section,
    status: "published",
    title_nb: line.titleNb,
    title_en: line.titleEn,
    sort_order: line.sortOrder,
    redemption_type: "none",
    is_featured: false,
    category: line.section === "member" ? "other" : null,
    partner_id:
      line.partnerKey === null
        ? null
        : (partnerIds.get(line.partnerKey) ?? null),
  };
}

function updateData(
  row: PlannedRowUpdate,
  partnerIds: Map<string, string>
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    section: row.section,
    category: row.category,
  };
  if (row.partnerKey !== null) {
    data.partner_id = partnerIds.get(row.partnerKey) ?? null;
  }
  if (row.sortOrder !== null) {
    data.sort_order = row.sortOrder;
  }
  return data;
}

/**
 * Writes an approved plan through the injected writer. Sequential and
 * idempotent (deterministic ids, upserts). Never logs: codes are secret.
 */
export async function applyBenefitMigration(
  plan: MigrationPlan,
  writer: MigrationWriter
): Promise<MigrationApplyResult> {
  const problems = validateMigrationPlan(plan);
  if (problems.length > 0) {
    throw new InvalidMigrationPlanError(problems);
  }
  const partnerIds = new Map(plan.partners.map((p) => [p.key, p.id]));
  const deletedIds = new Set(
    plan.deletions.filter((d) => d.approved).map((d) => d.rowId)
  );
  const result: MigrationApplyResult = {
    codes: 0,
    created: 0,
    deleted: 0,
    partners: 0,
    updated: 0,
  };

  for (const partner of plan.partners) {
    await guarded("benefit_partners", partner.id, () =>
      writer.upsertRow(
        "benefit_partners",
        partner.id,
        {
          name: partner.name,
          campus_id: partner.campusId,
          logo_url: partner.logoUrl,
          is_active: true,
        },
        PUBLIC_READ
      )
    );
    result.partners += 1;
  }

  for (const line of plan.lines) {
    if (line.action !== "create") {
      continue;
    }
    await guarded("campus_benefits", line.id, () =>
      writer.upsertRow(
        "campus_benefits",
        line.id,
        createData(line, partnerIds),
        PUBLIC_READ
      )
    );
    result.created += 1;
  }

  for (const row of plan.rowUpdates) {
    if (deletedIds.has(row.rowId)) {
      continue;
    }
    await guarded("campus_benefits", row.rowId, () =>
      writer.updateRow(
        "campus_benefits",
        row.rowId,
        updateData(row, partnerIds),
        row.makePublic ? PUBLIC_READ : undefined
      )
    );
    result.updated += 1;
  }

  for (const code of plan.codes) {
    if (deletedIds.has(code.rowId)) {
      continue;
    }
    await guarded("benefit_codes", code.rowId, () =>
      writer.upsertRow(
        "benefit_codes",
        code.rowId,
        { benefit_id: code.rowId, value: code.value },
        []
      )
    );
    result.codes += 1;
  }

  for (const deletion of plan.deletions) {
    if (!deletion.approved) {
      continue;
    }
    const outcome = await guarded("campus_benefits", deletion.rowId, () =>
      writer.deleteRow("campus_benefits", deletion.rowId)
    );
    if (outcome === "deleted") {
      result.deleted += 1;
    }
  }

  return result;
}
