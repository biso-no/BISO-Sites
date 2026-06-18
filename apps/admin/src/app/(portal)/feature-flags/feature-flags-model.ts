/**
 * Pure validation + normalization for feature-flag writes.
 *
 * Kept in a plain (non-"use server") module so it can be imported from both the
 * server actions and the client form, and unit-tested without an Appwrite
 * client. The `feature_flags` table requires `key` and `title`; `description`
 * is optional and `enabled` defaults to off for a new flag.
 */

export interface FeatureFlagInput {
  description?: string | null;
  enabled?: boolean;
  key: string;
  title: string;
}

export interface NormalizedFeatureFlag {
  description: string | null;
  enabled: boolean;
  key: string;
  title: string;
}

export type FeatureFlagValidation =
  | { ok: true; value: NormalizedFeatureFlag }
  | { ok: false; error: string };

const KEY_REGEX = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_KEY_LENGTH = 64;
const MAX_TITLE_LENGTH = 120;

/** Flag keys are lowercase, trimmed identifiers used in code. */
export function normalizeFlagKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateFeatureFlagInput(
  input: FeatureFlagInput
): FeatureFlagValidation {
  const key = normalizeFlagKey(input.key ?? "");
  if (!key) {
    return { ok: false, error: "Key is required" };
  }
  if (key.length > MAX_KEY_LENGTH) {
    return {
      ok: false,
      error: `Key must be ${MAX_KEY_LENGTH} characters or fewer`,
    };
  }
  if (!KEY_REGEX.test(key)) {
    return {
      ok: false,
      error:
        "Key may only contain lowercase letters, numbers, hyphens, and underscores",
    };
  }

  const title = (input.title ?? "").trim();
  if (!title) {
    return { ok: false, error: "Title is required" };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer`,
    };
  }

  const trimmedDescription = input.description?.trim();

  return {
    ok: true,
    value: {
      key,
      title,
      description: trimmedDescription ? trimmedDescription : null,
      enabled: input.enabled ?? false,
    },
  };
}
