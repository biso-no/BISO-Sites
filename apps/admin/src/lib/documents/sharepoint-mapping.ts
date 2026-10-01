export type DocumentLanguage = "no" | "en";

/** Folder inside the Intranet document library that holds governing documents. */
const ORG_DOCS_ROOT = "/Organisational documents";

/** Every uploaded version is also kept here, one file per version. */
export const PREVIOUS_VERSIONS_FOLDER = "Previous versions";

/**
 * Maps each document category to its SharePoint folder under the root. Keyed
 * by string so it also covers categories the admin form offers that the
 * generated Appwrite enum does not list yet.
 */
const CATEGORY_FOLDER_MAP: Record<string, string> = {
  "authorization-matrix": "Authorization Matrix",
  "business-regulations": "Business Regulations",
  "campus-bylaws": "Local laws",
  "code-of-conduct": "Code of Conduct",
  "communication-guidelines": "Communication Guidelines",
  "national-statutes": "Statutes",
  "target-documents": "Target Documents",
};

const LANGUAGE_SUBFOLDER: Record<DocumentLanguage, string> = {
  no: "Norsk versjon",
  en: "Engelsk versjon",
};

const MAX_FILE_BASE_LENGTH = 120;
// Characters SharePoint rejects in file names, plus "#" and "%", which break
// the path-addressed Graph upload URL.
const UNSAFE_FILE_CHARS_REGEX = /["*:<>?/\\|#%]/g;
const WHITESPACE_RUN_REGEX = /\s+/g;
const TRAILING_DOTS_AND_SPACES_REGEX = /[.\s]+$/;

/**
 * The drive (document library) all governing documents are written to. There
 * is deliberately no fallback: guessing a site from SHAREPOINT_SITES once sent
 * uploads to the wrong site.
 */
export function getDocumentsDriveId(): string {
  const driveId = process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID?.trim();
  if (!driveId) {
    throw new Error(
      "SHAREPOINT_DOCUMENTS_DRIVE_ID is not set. Set it to the Intranet document library's drive id."
    );
  }
  return driveId;
}

/**
 * Folder for a document's current file, by category, language and (for campus
 * bylaws) campus name.
 */
export function resolveFolderPath(
  category: string,
  language: DocumentLanguage,
  campusName: string | null
): string {
  const categoryFolder = CATEGORY_FOLDER_MAP[category];
  if (!categoryFolder) {
    throw new Error(
      `No SharePoint folder is mapped for category "${category}"`
    );
  }
  const languageFolder = LANGUAGE_SUBFOLDER[language];

  if (category === "campus-bylaws" && campusName) {
    return `${ORG_DOCS_ROOT}/${categoryFolder}/${campusName}/${languageFolder}`;
  }

  return `${ORG_DOCS_ROOT}/${categoryFolder}/${languageFolder}`;
}

function toSafeFileBase(title: string): string {
  const cleaned = title
    .replace(UNSAFE_FILE_CHARS_REGEX, "")
    .replace(WHITESPACE_RUN_REGEX, " ")
    .trim()
    .slice(0, MAX_FILE_BASE_LENGTH)
    .replace(TRAILING_DOTS_AND_SPACES_REGEX, "");
  return cleaned || "Document";
}

/**
 * File names derive from the document title, not the uploaded file's name, so
 * the current file's name is stable across versions.
 */
export function buildDocumentFileNames(
  title: string,
  version: string
): { archived: string; current: string } {
  const base = toSafeFileBase(title);
  return {
    archived: `${base} v${version}.pdf`,
    current: `${base}.pdf`,
  };
}
