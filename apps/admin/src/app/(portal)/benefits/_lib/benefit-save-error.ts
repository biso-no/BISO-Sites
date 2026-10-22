export type BenefitSaveError = string | Record<string, string[] | undefined>;

/**
 * The detail behind a failed save, shown under the panel's plain "could not
 * save" message: the server's reason, or each field that failed validation
 * with the panel's own label. Null when there is nothing more to say.
 */
export function describeBenefitSaveError(
  error: BenefitSaveError,
  fieldLabels: Record<string, string>
): string | null {
  if (typeof error === "string") {
    return error.trim() ? error : null;
  }
  const details: string[] = [];
  for (const [field, messages] of Object.entries(error)) {
    const message = messages?.[0];
    if (message) {
      details.push(`${fieldLabels[field] ?? field}: ${message}`);
    }
  }
  return details.length > 0 ? details.join(". ") : null;
}
