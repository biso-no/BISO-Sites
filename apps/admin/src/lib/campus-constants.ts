/**
 * Maps campus names (from SG-App-Campus-* team names) to their numeric
 * Appwrite document IDs in the campus table.
 *
 * These IDs are the campus_id stored on content documents
 * (events, jobs, news, pages, webshop_products).
 *
 * Oslo=1, Bergen=2, Trondheim=3, Stavanger=4, National=5
 *
 * Kept in a plain (non-server-action) module so it can be imported from
 * both "use server" and "use client" contexts without violating the
 * Next.js constraint that server-action files may only export async functions.
 */
export const CAMPUS_NAME_TO_ID: Record<string, string> = {
  Oslo: "1",
  Bergen: "2",
  Trondheim: "3",
  Stavanger: "4",
  National: "5",
};

/** Invert the map: numeric campus_id → campus name */
export const CAMPUS_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPUS_NAME_TO_ID).map(([name, id]) => [id, name])
);

/**
 * Converts a PascalCase/camelCase team-name suffix to a space-separated
 * string so it can be matched against department Name values in the DB.
 *
 * Examples:
 *   "OperationsUnit" → "Operations Unit"
 *   "LedelsenOslo"   → "Ledelsen Oslo"
 *   "Sosialutvalget" → "Sosialutvalget"  (single word — unchanged)
 */
export function expandDeptName(raw: string): string {
  return raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Derive the campus management (Ledelsen{City}) team $id for a given campus_id.
 *
 * Team IDs are deterministic: lowercased Azure displayName.
 * e.g. campus_id "1" (Oslo) -> "sg-app-dept-ledelsenoslo"
 *      campus_id "5" (National) -> null (no city management team)
 *
 * Pure synchronous function — lives here rather than team-provisioning.ts
 * because that file has "use server" and can only export async functions.
 */
export function getCampusManagementTeamId(campusId: string): string | null {
  const campusName = CAMPUS_ID_TO_NAME[campusId];
  if (!campusName || campusName === "National") {
    return null;
  }
  return `sg-app-dept-ledelsen${campusName.toLowerCase()}`;
}
