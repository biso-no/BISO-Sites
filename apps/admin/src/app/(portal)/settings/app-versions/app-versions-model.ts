import {
  compareVersions,
  isVersionString,
} from "@repo/shared/utils/app-versions";

/** True when a valid typed minimum is higher than the version live in the store. */
export function shouldWarnAboveStore(
  minimum: string,
  storeVersion: string | null
): boolean {
  const trimmed = minimum.trim();
  if (storeVersion === null || !isVersionString(trimmed)) {
    return false;
  }
  return compareVersions(trimmed, storeVersion) > 0;
}
