/**
 * Governing-document version numbers ("12", "7.1").
 *
 * Stored without the "v" prefix; the UI adds it. The minor part is an
 * integer, so 7.10 is the tenth minor revision and sorts after 7.9.
 */
export const DOCUMENT_VERSION_PATTERN = /^\d{1,4}(\.\d{1,4})?$/;

const LEADING_V_REGEX = /^v/i;

export interface DocumentVersion {
  major: number;
  minor: number;
}

export function parseDocumentVersion(
  input: string | null | undefined
): DocumentVersion | null {
  if (!input) {
    return null;
  }
  const cleaned = input.trim().replace(LEADING_V_REGEX, "");
  if (!DOCUMENT_VERSION_PATTERN.test(cleaned)) {
    return null;
  }
  const [major, minor = "0"] = cleaned.split(".");
  return { major: Number(major), minor: Number(minor) };
}

export function formatDocumentVersion(version: DocumentVersion): string {
  return version.minor === 0
    ? String(version.major)
    : `${version.major}.${version.minor}`;
}

export function compareDocumentVersions(
  a: DocumentVersion,
  b: DocumentVersion
): number {
  return a.major === b.major ? a.minor - b.minor : a.major - b.major;
}

/**
 * Version label for display: "v12" for a version number, the text itself for
 * a legacy value that is not one ("draft"), and null when there is none.
 */
export function displayDocumentVersion(
  raw: string | null | undefined
): string | null {
  const parsed = parseDocumentVersion(raw);
  if (parsed) {
    return `v${formatDocumentVersion(parsed)}`;
  }
  return raw?.trim() || null;
}
