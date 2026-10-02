export type BenefitSaveError = string | Record<string, string[] | undefined>;

/**
 * Turns a failed save into a message an editor can act on. A validation
 * failure and a server rejection used to produce the same generic toast, so
 * nobody could tell a bad image URL from a missing permission.
 */
export function describeBenefitSaveError(
  error: BenefitSaveError,
  fallback: string,
  fieldLabels: Record<string, string>
): string {
  if (typeof error === "string") {
    return error ? `${fallback}: ${error}` : fallback;
  }

  const details: string[] = [];
  for (const [field, messages] of Object.entries(error)) {
    const message = messages?.[0];
    if (message) {
      details.push(`${fieldLabels[field] ?? field}: ${message}`);
    }
  }
  return details.length > 0 ? `${fallback}: ${details.join(". ")}` : fallback;
}
