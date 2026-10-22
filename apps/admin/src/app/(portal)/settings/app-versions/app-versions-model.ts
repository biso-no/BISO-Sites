import {
  compareVersions,
  isVersionString,
} from "@repo/shared/utils/app-versions";

/**
 * True when a valid typed version (minimum or recommended) is higher than the
 * version live in the store.
 */
export function shouldWarnAboveStore(
  typed: string,
  storeVersion: string | null
): boolean {
  const trimmed = typed.trim();
  if (storeVersion === null || !isVersionString(trimmed)) {
    return false;
  }
  return compareVersions(trimmed, storeVersion) > 0;
}
