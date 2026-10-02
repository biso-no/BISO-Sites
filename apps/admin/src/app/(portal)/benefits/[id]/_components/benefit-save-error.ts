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

const SAVE_DID_NOT_COMPLETE =
  "The request did not complete. Check your connection and try again.";

interface SaveDidNotComplete {
  data?: undefined;
  error: string;
  translationQueued?: undefined;
}

/**
 * Runs a save and reports a thrown failure the same way as a returned one.
 * A server action that throws — an expired session, a dropped connection —
 * rejects the call rather than returning `{ error }`, which used to leave the
 * editor with no feedback at all.
 */
export async function settleBenefitSave<T>(
  save: () => Promise<T>
): Promise<T | SaveDidNotComplete> {
  try {
    return await save();
  } catch {
    return { error: SAVE_DID_NOT_COMPLETE };
  }
}
