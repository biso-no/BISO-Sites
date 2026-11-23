// What a student may see of their own receipts. Projects are an approver and
// bookkeeping matter: they are stripped from every attachment returned to the
// submitter, like accounts.

const PROJECT_FIELDS = [
  "project_confidence",
  "project_id",
  "project_name",
  "project_source",
] as const;

/** The attachment with every project field nulled. */
export function withoutProject<T extends object>(attachment: T): T {
  const stripped = { ...attachment } as Record<string, unknown>;
  for (const field of PROJECT_FIELDS) {
    stripped[field] = null;
  }
  return stripped as T;
}

/**
 * The row with its attachments' project fields nulled. A row without
 * attachment objects (not read with them, or ids only) comes back unchanged.
 */
export function withoutProjects<T extends { expenseAttachments?: unknown }>(
  row: T
): T {
  const { expenseAttachments } = row;
  if (!Array.isArray(expenseAttachments)) {
    return row;
  }
  return {
    ...row,
    expenseAttachments: expenseAttachments.map((attachment) =>
      attachment && typeof attachment === "object"
        ? withoutProject(attachment)
        : attachment
    ),
  };
}
