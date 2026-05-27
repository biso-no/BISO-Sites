import { DocumentsCategory } from "@repo/api/types/appwrite";
import type { SharePointService } from "@repo/connectors/sharepoint";

export type DocumentLanguage = "no" | "en";

/** Root path within the drive that contains all organisational documents. */
const ORG_DOCS_ROOT = "/Documents/Organisational Documents";

/**
 * Maps each document category to its corresponding SharePoint folder name
 * under the Organisational Documents root.
 */
const CATEGORY_FOLDER_MAP: Record<DocumentsCategory, string> = {
  [DocumentsCategory.NATIONAL_STATUTES]: "Statutes",
  [DocumentsCategory.CAMPUS_BYLAWS]: "Local laws",
  [DocumentsCategory.CODE_OF_CONDUCT]: "Code of Conduct",
  [DocumentsCategory.BUSINESS_REGULATIONS]: "Business Regulations",
  [DocumentsCategory.COMMUNICATION_GUIDELINES]: "Communication Guidelines",
  [DocumentsCategory.AUTHORIZATION_MATRIX]: "Authorization Matrix",
  [DocumentsCategory.TARGET_DOCUMENTS]: "Target Documents",
};

const LANGUAGE_SUBFOLDER: Record<DocumentLanguage, string> = {
  no: "Norsk versjon",
  en: "Engelsk versjon",
};

/**
 * Categories that are auto-mapped to the main Organisational Documents site.
 * Business Regulations and Communication Guidelines live on different SharePoint
 * sites and are excluded from auto-mapping for now.
 */
export const AUTO_MAPPED_CATEGORIES = new Set<DocumentsCategory>([
  DocumentsCategory.NATIONAL_STATUTES,
  DocumentsCategory.CAMPUS_BYLAWS,
  DocumentsCategory.CODE_OF_CONDUCT,
  DocumentsCategory.AUTHORIZATION_MATRIX,
  DocumentsCategory.TARGET_DOCUMENTS,
]);

/**
 * Builds the full SharePoint folder path for a document based on its category,
 * language, and (for campus-bylaws) the campus name.
 *
 * All categories support language subfolders.
 */
export function resolveFolderPath(
  category: DocumentsCategory,
  language: DocumentLanguage,
  campusName: string | null
): string {
  const categoryFolder = CATEGORY_FOLDER_MAP[category];
  const languageFolder = LANGUAGE_SUBFOLDER[language];

  if (category === "campus-bylaws" && campusName) {
    return `${ORG_DOCS_ROOT}/${categoryFolder}/${campusName}/${languageFolder}`;
  }

  return `${ORG_DOCS_ROOT}/${categoryFolder}/${languageFolder}`;
}

/**
 * Resolves the SharePoint drive ID for the Organisational Documents library.
 *
 * Checks SHAREPOINT_DOCUMENTS_DRIVE_ID env var first (preferred — avoids an
 * extra API round-trip on every upload). Falls back to auto-discovering the
 * drive from the first configured SharePoint site.
 */
export async function resolveDocumentsDriveId(
  sp: SharePointService
): Promise<string> {
  const fromEnv = process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const sites = await sp.listSites();
  if (sites.length === 0) {
    throw new Error(
      "No SharePoint sites configured. Set SHAREPOINT_SITES or SHAREPOINT_DOCUMENTS_DRIVE_ID."
    );
  }

  const drives = await sp.listDrivesForSite(sites[0].id);
  if (drives.length === 0) {
    throw new Error(
      `No drives found on SharePoint site "${sites[0].displayName}". Set SHAREPOINT_DOCUMENTS_DRIVE_ID.`
    );
  }

  const preferred = drives.find(
    (d) => d.name === "Documents" || d.name === "Shared Documents"
  );
  return (preferred ?? drives[0]).id;
}
