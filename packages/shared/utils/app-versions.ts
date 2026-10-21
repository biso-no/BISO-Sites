export const APP_PLATFORMS = ["ios", "android"] as const;

export type AppPlatform = (typeof APP_PLATFORMS)[number];

export interface AppVersionPolicy {
  minimum: string | null;
  recommended: string | null;
}

export type AppVersionsConfig = Record<AppPlatform, AppVersionPolicy>;

export const EMPTY_APP_VERSIONS: AppVersionsConfig = {
  ios: { minimum: null, recommended: null },
  android: { minimum: null, recommended: null },
};

/** Row shape until the generated types are regenerated. */
export interface AppVersionsRow {
  minimum_version: string | null;
  platform: AppPlatform;
  recommended_version: string | null;
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function isVersionString(value: string): boolean {
  return VERSION_PATTERN.test(value);
}

/** Negative, zero or positive. Only call with valid version strings. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < left.length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export type AppVersionError =
  | "invalidMinimum"
  | "invalidRecommended"
  | "recommendedBelowMinimum";

export function validateAppVersionPolicy(input: {
  minimum: string;
  recommended: string;
}): { policy: AppVersionPolicy } | { error: AppVersionError } {
  const minimum = input.minimum.trim() || null;
  const recommended = input.recommended.trim() || null;

  if (minimum !== null && !isVersionString(minimum)) {
    return { error: "invalidMinimum" };
  }
  if (recommended !== null && !isVersionString(recommended)) {
    return { error: "invalidRecommended" };
  }
  if (
    minimum !== null &&
    recommended !== null &&
    compareVersions(recommended, minimum) < 0
  ) {
    return { error: "recommendedBelowMinimum" };
  }
  return { policy: { minimum, recommended } };
}

function validOrNull(value: string | null | undefined): string | null {
  return value && isVersionString(value) ? value : null;
}

export function policyFromRow(row: AppVersionsRow | null): AppVersionPolicy {
  return {
    minimum: validOrNull(row?.minimum_version),
    recommended: validOrNull(row?.recommended_version),
  };
}
