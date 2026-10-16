# Document Versions & SharePoint Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uploading a governing document in admin stores every version in SharePoint and Appwrite, keeps one stable "current" file with a public link, and the web documents page shows the current version plus history, filtered by campus.

**Architecture:** A new `document_versions` table holds one row per uploaded version; the existing `documents` row keeps pointing at the current SharePoint file, which is replaced in place so its URL never changes. Version parsing/sorting is one pure helper in `@repo/shared`, used by both apps. Web filtering and ordering move into a pure, unit-tested module.

**Tech Stack:** Next.js 16 (App Router, server actions), Appwrite via `@repo/api`, Microsoft Graph via `@repo/connectors/sharepoint`, zod, `bun:test` (admin, connectors), vitest (web, shared), Biome/Ultracite.

**Spec:** `docs/superpowers/specs/2026-10-01-document-versions-sharepoint-design.md`

## Global Constraints

- Use Bun only (`bun`, `bunx`); never `npm`/`pnpm`.
- All Appwrite access goes through `@repo/api`; never import `appwrite`/`node-appwrite` in app code.
- Do not hand-edit `packages/api/types/appwrite.ts`. `packages/api/appwrite.config.json` may only gain the new `document_versions` table (Task 2); Markus pushes it and regenerates types.
- `"use server"` files export only `async function`s. After touching one, verify with `bun run build --filter=admin`, not just `check-types`.
- Version strings match `^\d{1,4}(\.\d{1,4})?$`, are stored without the `v` prefix (`"12"`, `"7.1"`), and the UI adds the `v`.
- SharePoint root is `/Organisational documents` in the drive named by `SHAREPOINT_DOCUMENTS_DRIVE_ID`. There is no site auto-discovery fallback.
- Layout: `<Category>/[<Campus>/]<Language>/<Title>.pdf` (current) and `…/Previous versions/<Title> v<version>.pdf` (one per version, including the current one).
- SharePoint writes happen before database writes.
- `sort_order` is never read or written by new code; the column stays in the schema.
- Run `bun x ultracite fix` before every commit.
- Work on a branch: `git checkout -b feat/document-versions-sharepoint`.

## Review Focus

1. **Minor version `7.10` vs `7.1`:** minor is an integer, so v7.10 sorts after v7.9 and is not equal to v7.1. Pinned in Task 1.
2. **Titles with characters SharePoint or the Graph path rejects** (`/ \ : * ? " < > | # %`, trailing dots): the upload must succeed with a cleaned file name, not 400 or land in the wrong folder. Pinned in Task 4.
3. **Second document with the same title in the same folder:** creating it must be rejected, not overwrite the first document's current file. Pinned in Task 5.
4. **Uploading a version that is not higher than the latest** (same number, or lower): rejected before anything is written to SharePoint. Pinned in Task 5.
5. **`?version=` id that belongs to a different or unpublished document:** the download route returns 404, never another document's file. Pinned in Task 7.

---

### Task 1: Version helper in `@repo/shared`

**Files:**
- Create: `packages/shared/utils/document-version.ts`
- Test: `packages/shared/utils/document-version.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DOCUMENT_VERSION_PATTERN: RegExp`
  - `interface DocumentVersion { major: number; minor: number }`
  - `parseDocumentVersion(input: string | null | undefined): DocumentVersion | null` (tolerates surrounding whitespace and one leading `v`/`V`)
  - `formatDocumentVersion(version: DocumentVersion): string` (`{12,0}` → `"12"`, `{7,1}` → `"7.1"`)
  - `compareDocumentVersions(a: DocumentVersion, b: DocumentVersion): number` (negative when `a` is older)

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/utils/document-version.test.ts
import { describe, expect, it } from "vitest";
import {
  compareDocumentVersions,
  DOCUMENT_VERSION_PATTERN,
  formatDocumentVersion,
  parseDocumentVersion,
} from "./document-version";

describe("parseDocumentVersion", () => {
  it("parses whole and major.minor versions", () => {
    expect(parseDocumentVersion("12")).toEqual({ major: 12, minor: 0 });
    expect(parseDocumentVersion("7.1")).toEqual({ major: 7, minor: 1 });
  });

  it("tolerates whitespace and a pasted v prefix", () => {
    expect(parseDocumentVersion(" v12 ")).toEqual({ major: 12, minor: 0 });
    expect(parseDocumentVersion("V7.1")).toEqual({ major: 7, minor: 1 });
  });

  it("rejects anything that is not a version number", () => {
    for (const input of ["", "v", "1.", ".1", "1.2.3", "1,2", "abc", "-1"]) {
      expect(parseDocumentVersion(input)).toBeNull();
    }
    expect(parseDocumentVersion(null)).toBeNull();
    expect(parseDocumentVersion(undefined)).toBeNull();
  });

  it("treats the minor part as an integer, not a decimal", () => {
    expect(parseDocumentVersion("7.10")).toEqual({ major: 7, minor: 10 });
  });
});

describe("formatDocumentVersion", () => {
  it("omits a zero minor", () => {
    expect(formatDocumentVersion({ major: 12, minor: 0 })).toBe("12");
    expect(formatDocumentVersion({ major: 7, minor: 1 })).toBe("7.1");
  });
});

describe("compareDocumentVersions", () => {
  it("orders by major, then minor", () => {
    const sorted = ["7.1", "12", "7", "7.10", "7.9"]
      .map((v) => parseDocumentVersion(v))
      .filter((v) => v !== null)
      .sort(compareDocumentVersions)
      .map(formatDocumentVersion);
    expect(sorted).toEqual(["7", "7.1", "7.9", "7.10", "12"]);
  });

  it("returns 0 for equal versions", () => {
    expect(
      compareDocumentVersions({ major: 7, minor: 0 }, { major: 7, minor: 0 })
    ).toBe(0);
  });
});

describe("DOCUMENT_VERSION_PATTERN", () => {
  it("matches only the stored form, without a prefix", () => {
    expect(DOCUMENT_VERSION_PATTERN.test("12")).toBe(true);
    expect(DOCUMENT_VERSION_PATTERN.test("7.1")).toBe(true);
    expect(DOCUMENT_VERSION_PATTERN.test("v12")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bunx vitest run utils/document-version.test.ts`
Expected: FAIL, cannot resolve `./document-version`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/shared/utils/document-version.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bunx vitest run utils/document-version.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/document-version.ts packages/shared/utils/document-version.test.ts
git commit -m "feat(shared): add document version parse/format/compare helper"
```

---

### Task 2: `document_versions` table (manual gate)

**Files:**
- Modify: `packages/api/appwrite.config.json` (append one object to the top-level `tables` array)

**Interfaces:**
- Produces (after Markus regenerates types): `DocumentVersions` in `@repo/api/types/appwrite`:

```ts
export type DocumentVersions = Models.Row & {
  document_id: string;
  version_major: number;
  version_minor: number;
  sharepoint_item_id: string;
  sharepoint_drive_id: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
};
```

- [ ] **Step 1: Append the table to the `tables` array**

Add this object as the last element of `tables` (after `member_roster`), keeping the file's existing 4-space indentation:

```json
{
    "$id": "document_versions",
    "$permissions": [
        "read(\"any\")",
        "create(\"team:sg-app-dept-operationsunit\")",
        "update(\"team:sg-app-dept-operationsunit\")",
        "delete(\"team:sg-app-dept-operationsunit\")"
    ],
    "databaseId": "app",
    "name": "Document Versions",
    "enabled": true,
    "rowSecurity": true,
    "columns": [
        { "key": "document_id", "type": "string", "required": true, "array": false, "size": 50, "default": null, "encrypt": false },
        { "key": "version_major", "type": "integer", "required": true, "array": false, "default": null, "min": 0, "max": 9999 },
        { "key": "version_minor", "type": "integer", "required": false, "array": false, "default": 0, "min": 0, "max": 9999 },
        { "key": "sharepoint_item_id", "type": "string", "required": true, "array": false, "size": 500, "default": null, "encrypt": false },
        { "key": "sharepoint_drive_id", "type": "string", "required": true, "array": false, "size": 500, "default": null, "encrypt": false },
        { "key": "file_name", "type": "string", "required": true, "array": false, "size": 255, "default": null, "encrypt": false },
        { "key": "file_size", "type": "integer", "required": false, "array": false, "default": null, "min": 0, "max": 9223372036854775807 },
        { "key": "uploaded_by", "type": "string", "required": false, "array": false, "size": 50, "default": null, "encrypt": false }
    ],
    "indexes": [
        { "key": "idx_document_id", "type": "key", "status": "available", "columns": ["document_id"], "orders": [] },
        { "key": "uniq_document_version", "type": "unique", "status": "available", "columns": ["document_id", "version_major", "version_minor"], "orders": [] }
    ]
}
```

- [ ] **Step 2: Verify the file is still valid JSON**

Run: `python3 -c "import json; t=json.load(open('packages/api/appwrite.config.json'))['tables']; print(t[-1]['\$id'], len(t[-1]['columns']))"`
Expected: `document_versions 8`

- [ ] **Step 3: Commit**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(api): add document_versions table to Appwrite config"
```

- [ ] **Step 4: STOP — hand off to Markus**

Ask Markus to push the table with the Appwrite CLI and regenerate types (`appwrite types -l ts ./types` in `packages/api`), then commit the regenerated `packages/api/types/appwrite.ts`. Tasks 1, 3 and 4 do not need the type and may proceed meanwhile.

Gate before Task 5: `rg -n "export type DocumentVersions" packages/api/types/appwrite.ts` must print one line.

---

### Task 3: Anonymous link in the SharePoint connector

**Files:**
- Modify: `packages/connectors/src/sharepoint/index.ts` (add one method after `replaceFileInPlace`, ~line 493)
- Test: `packages/connectors/src/sharepoint/index.test.ts` (new)

**Interfaces:**
- Produces: `SharePointService.createAnonymousViewLink(driveId: string, itemId: string): Promise<string>` — resolves to the link URL; rejects when Graph refuses (tenant or site forbids "Anyone" links).

- [ ] **Step 1: Write the failing test**

```ts
// packages/connectors/src/sharepoint/index.test.ts
import { beforeEach, describe, expect, mock, test } from "bun:test";

const post = mock();
const api = mock(() => ({ post }));

mock.module("server-only", () => ({}));
mock.module("@azure/msal-node", () => ({
  ConfidentialClientApplication: class {
    acquireTokenByClientCredential() {
      return Promise.resolve({ accessToken: "token" });
    }
  },
}));
mock.module("@microsoft/microsoft-graph-client", () => ({
  Client: { init: () => ({ api }) },
  ResponseType: { ARRAYBUFFER: "arraybuffer" },
}));

const { SharePointService } = await import("./index");

const service = new SharePointService({
  authority: "https://login.microsoftonline.com/tenant",
  clientId: "client",
  clientSecret: "secret",
  tenantId: "tenant",
});

beforeEach(() => {
  post.mockReset();
  api.mockClear();
});

describe("createAnonymousViewLink", () => {
  test("requests an anonymous view link and returns its URL", async () => {
    post.mockResolvedValue({
      link: { scope: "anonymous", webUrl: "https://sp.example/:b:/g/abc" },
    });

    const url = await service.createAnonymousViewLink("drive-1", "item-1");

    expect(url).toBe("https://sp.example/:b:/g/abc");
    expect(api).toHaveBeenCalledWith("/drives/drive-1/items/item-1/createLink");
    expect(post).toHaveBeenCalledWith({ scope: "anonymous", type: "view" });
  });

  test("rejects when Graph returns no link URL", async () => {
    post.mockResolvedValue({ link: {} });

    await expect(
      service.createAnonymousViewLink("drive-1", "item-1")
    ).rejects.toThrow("SharePoint did not return a sharing link");
  });

  test("propagates a Graph refusal", async () => {
    post.mockRejectedValue(new Error("sharingDisabled"));

    await expect(
      service.createAnonymousViewLink("drive-1", "item-1")
    ).rejects.toThrow("sharingDisabled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/connectors && bun test ./src/sharepoint/index.test.ts`
Expected: FAIL, `service.createAnonymousViewLink is not a function`.

- [ ] **Step 3: Add the method**

Insert in `SharePointService`, directly after `replaceFileInPlace`:

```ts
  /**
   * Creates (or returns the existing) "Anyone with the link can view" link for
   * a file. Rejects when the tenant or site forbids anonymous links.
   */
  async createAnonymousViewLink(
    driveId: string,
    itemId: string
  ): Promise<string> {
    const client = await this.getAuthenticatedClient();
    const response: { link?: { webUrl?: string } } = await client
      .api(`/drives/${driveId}/items/${itemId}/createLink`)
      .post({ scope: "anonymous", type: "view" });
    const url = response.link?.webUrl;
    if (!url) {
      throw new Error("SharePoint did not return a sharing link");
    }
    return url;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/connectors && bun test ./src/sharepoint/index.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/connectors/src/sharepoint/index.ts packages/connectors/src/sharepoint/index.test.ts
git commit -m "feat(connectors): create anonymous view links for SharePoint files"
```

---

### Task 4: SharePoint path and file-name mapping

**Files:**
- Modify (full rewrite): `apps/admin/src/lib/documents/sharepoint-mapping.ts`
- Test: `apps/admin/src/lib/documents/sharepoint-mapping.test.ts` (new)
- Modify: `turbo.json` (add `"SHAREPOINT_DOCUMENTS_DRIVE_ID"` to `tasks.build.env`, next to the other `SHAREPOINT_*` entries around line 61)
- Modify: `apps/admin/.env.local` (append the drive id; this file is gitignored and holds secrets, so append only, never print it)

**Interfaces:**
- Produces:
  - `type DocumentLanguage = "no" | "en"`
  - `PREVIOUS_VERSIONS_FOLDER = "Previous versions"`
  - `getDocumentsDriveId(): string` — throws `Error("SHAREPOINT_DOCUMENTS_DRIVE_ID is not set…")` when missing
  - `resolveFolderPath(category: string, language: DocumentLanguage, campusName: string | null): string` — throws on an unknown category
  - `buildDocumentFileNames(title: string, version: string): { archived: string; current: string }`
- Removes: `resolveDocumentsDriveId` (its only caller, `_actions/documents.ts`, is rewritten in Task 5; admin `check-types` fails between Task 4 and Task 5 — that is expected).

- [ ] **Step 1: Write the failing test**

```ts
// apps/admin/src/lib/documents/sharepoint-mapping.test.ts
import { afterEach, describe, expect, test } from "bun:test";
import {
  buildDocumentFileNames,
  getDocumentsDriveId,
  PREVIOUS_VERSIONS_FOLDER,
  resolveFolderPath,
} from "./sharepoint-mapping";

const ORIGINAL_DRIVE_ID = process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID;

afterEach(() => {
  if (ORIGINAL_DRIVE_ID === undefined) {
    delete process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID;
  } else {
    process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = ORIGINAL_DRIVE_ID;
  }
});

describe("getDocumentsDriveId", () => {
  test("returns the trimmed configured drive id", () => {
    process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = "  b!drive  ";
    expect(getDocumentsDriveId()).toBe("b!drive");
  });

  test("throws instead of guessing a site when unset", () => {
    delete process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID;
    expect(() => getDocumentsDriveId()).toThrow(
      "SHAREPOINT_DOCUMENTS_DRIVE_ID is not set"
    );
  });
});

describe("resolveFolderPath", () => {
  test("national categories sit directly under the library root folder", () => {
    expect(resolveFolderPath("national-statutes", "no", null)).toBe(
      "/Organisational documents/Statutes/Norsk versjon"
    );
    expect(resolveFolderPath("code-of-conduct", "en", null)).toBe(
      "/Organisational documents/Code of Conduct/Engelsk versjon"
    );
  });

  test("campus bylaws get a campus subfolder", () => {
    expect(resolveFolderPath("campus-bylaws", "no", "Bergen")).toBe(
      "/Organisational documents/Local laws/Bergen/Norsk versjon"
    );
  });

  test("covers every category the admin form offers", () => {
    expect(resolveFolderPath("authorization-matrix", "no", null)).toBe(
      "/Organisational documents/Authorization Matrix/Norsk versjon"
    );
    expect(resolveFolderPath("target-documents", "en", null)).toBe(
      "/Organisational documents/Target Documents/Engelsk versjon"
    );
  });

  test("throws on an unknown category instead of writing to 'undefined'", () => {
    expect(() => resolveFolderPath("nope", "no", null)).toThrow(
      'No SharePoint folder is mapped for category "nope"'
    );
  });
});

describe("buildDocumentFileNames", () => {
  test("names the current file by title and the archive by title + version", () => {
    expect(buildDocumentFileNames("Lokale lover BISO Bergen", "12")).toEqual({
      archived: "Lokale lover BISO Bergen v12.pdf",
      current: "Lokale lover BISO Bergen.pdf",
    });
  });

  test("keeps Norwegian letters", () => {
    expect(buildDocumentFileNames("Vedtekter for BISO – æøå", "7.1").current)
      .toBe("Vedtekter for BISO – æøå.pdf");
  });

  test("strips characters SharePoint or the Graph path rejects", () => {
    expect(
      buildDocumentFileNames('Laws: "Oslo" 50% #1 / draft?*<>|\\', "1").current
    ).toBe("Laws Oslo 50 1 draft.pdf");
  });

  test("drops trailing dots and collapses whitespace", () => {
    expect(buildDocumentFileNames("  Code   of  Conduct... ", "3").archived)
      .toBe("Code of Conduct v3.pdf");
  });

  test("falls back to a generic name when nothing usable is left", () => {
    expect(buildDocumentFileNames("???", "1").current).toBe("Document.pdf");
  });

  test("caps very long titles", () => {
    const { current } = buildDocumentFileNames("a".repeat(300), "1");
    expect(current.length).toBeLessThanOrEqual(124);
  });
});

test("archive folder name matches the existing SharePoint convention", () => {
  expect(PREVIOUS_VERSIONS_FOLDER).toBe("Previous versions");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && bun test ./src/lib/documents/sharepoint-mapping.test.ts`
Expected: FAIL, `getDocumentsDriveId` / `buildDocumentFileNames` are not exported.

- [ ] **Step 3: Rewrite the module**

```ts
// apps/admin/src/lib/documents/sharepoint-mapping.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && bun test ./src/lib/documents/sharepoint-mapping.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Add the env var to Turbo and local config**

In `turbo.json`, inside `tasks.build.env`, add `"SHAREPOINT_DOCUMENTS_DRIVE_ID",` on the line after `"SHAREPOINT_CLIENT_SECRET",` (keep the list alphabetical).

Append the drive id to the admin env file without printing the file:

```bash
grep -q '^SHAREPOINT_DOCUMENTS_DRIVE_ID=' apps/admin/.env.local || printf "\nSHAREPOINT_DOCUMENTS_DRIVE_ID='b!30gBbEnUK0eE6GP7DuU_i1dvRTW2yrZIoAWiMw27rtsom68ClMaYRLzU2E6uM3l-'\n" >> apps/admin/.env.local
```

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/documents/sharepoint-mapping.ts apps/admin/src/lib/documents/sharepoint-mapping.test.ts turbo.json
git commit -m "fix(admin): target the Intranet documents library and stable file names"
```

---

### Task 5: Admin schema and server actions

**Gate:** `rg -n "export type DocumentVersions" packages/api/types/appwrite.ts` prints one line (Task 2 Step 4 done).

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts` (the `documentMetadataSchema` block, ~lines 342-365)
- Modify: `apps/admin/src/app/(portal)/_actions/documents.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/documents-relationships.test.ts` (fixture + SharePoint mock only)
- Test: `apps/admin/src/app/(portal)/_actions/documents-versions.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 helpers from `@repo/shared/utils/document-version`; Task 3 `createAnonymousViewLink`; Task 4 `getDocumentsDriveId`, `resolveFolderPath`, `buildDocumentFileNames`, `PREVIOUS_VERSIONS_FOLDER`; `DocumentVersions` type.
- Produces:
  - `documentMetadataSchema` — no `version`, `version_number` or `sort_order`
  - `documentCreateSchema = documentMetadataSchema.extend({ version })`
  - `type DocumentMetadataFormValues`, `type DocumentCreateFormValues`
  - `createDocument(metadata: DocumentCreateFormValues, formData: FormData): Promise<{ data: string; publicLink: boolean } | { error: string; sharePointError: boolean }>`
  - `uploadNewVersion(id: string, version: string, formData: FormData): Promise<{ data: string; version: string } | { error: string; sharePointError: boolean }>`
  - `listDocumentVersions(id: string): Promise<DocumentVersions[]>` — newest first; `[]` when the caller cannot see the document
  - `updateDocumentMetadata` no longer writes `version` or `sort_order`
  - `deleteDocument` also deletes the document's `document_versions` rows

- [ ] **Step 1: Update the schema**

In `schemas.ts`, add to the imports at the top of the file:

```ts
import { DOCUMENT_VERSION_PATTERN } from "@repo/shared/utils/document-version";
```

Replace the whole `export const documentMetadataSchema = z.object({ … });` block and the `DocumentMetadataFormValues` line after it with:

```ts
export const documentMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  category: z.enum([
    "national-statutes",
    "campus-bylaws",
    "code-of-conduct",
    "business-regulations",
    "communication-guidelines",
    "authorization-matrix",
    "target-documents",
  ]),
  scope: z.enum(["national", "campus"]),
  campus_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  language: z.enum(["no", "en"]),
  status: z.enum(["draft", "published"]),
});

export type DocumentMetadataFormValues = z.infer<typeof documentMetadataSchema>;

/** Stored without the "v" prefix, e.g. "12" or "7.1". */
export const documentVersionSchema = z
  .string()
  .trim()
  .regex(DOCUMENT_VERSION_PATTERN, "Version must be a number like 12 or 7.1");

export const documentCreateSchema = documentMetadataSchema.extend({
  version: documentVersionSchema,
});

export type DocumentCreateFormValues = z.infer<typeof documentCreateSchema>;
```

- [ ] **Step 2: Fix the existing test fixture**

In `documents-relationships.test.ts`, remove these three lines from `departmentValues`: `sort_order: 0,`, `version: null,`, `version_number: 1,`. Change nothing else in that file. In particular, do not mock `@/lib/documents/sharepoint-mapping` there: `mock.module` is process-wide in `bun test`, and the new test file in Step 3 relies on the real mapping module.

- [ ] **Step 3: Write the failing tests for the new behaviour**

```ts
// apps/admin/src/app/(portal)/_actions/documents-versions.test.ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { DocumentCreateFormValues } from "./schemas";

const db = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

const sp = {
  createAnonymousViewLink: mock(),
  replaceFileInPlace: mock(),
  uploadNewFile: mock(),
};

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: null,
  managedCampuses: [],
  managedCampusIds: [],
  name: null,
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => globalAdminCtx),
}));
mock.module("@repo/connectors/sharepoint", () => ({
  getSharePointConfig: mock(() => ({})),
  SharePointService: class SharePointService {
    createAnonymousViewLink = sp.createAnonymousViewLink;
    replaceFileInPlace = sp.replaceFileInPlace;
    uploadNewFile = sp.uploadNewFile;
  },
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = "drive-1";

const { createDocument, deleteDocument, listDocumentVersions, uploadNewVersion } =
  await import("./documents");

const nationalValues: DocumentCreateFormValues = {
  campus_id: null,
  category: "national-statutes",
  department_id: null,
  description: null,
  language: "no",
  scope: "national",
  status: "draft",
  title: "Vedtekter for BISO",
  version: "13",
};

function pdfFormData(): FormData {
  const formData = new FormData();
  formData.append(
    "file",
    new File([new Uint8Array([1, 2, 3])], "upload.pdf", {
      type: "application/pdf",
    })
  );
  return formData;
}

const existingDoc = {
  $id: "doc-1",
  campus: null,
  campus_id: null,
  category: "national-statutes",
  department: null,
  language: "no",
  scope: "national",
  sharepoint_drive_id: "drive-1",
  sharepoint_item_id: "current-item",
  sharepoint_web_url: "https://sp.example/:b:/g/public",
  status: "published",
  title: "Vedtekter for BISO",
  version: "12",
  version_number: 12,
};

/** Routes listRows by table so each test states only the rows it needs. */
function mockTables(tables: Record<string, Record<string, unknown>[]>): void {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    const rows = tables[tableId] ?? [];
    return { rows, total: rows.length };
  });
}

beforeEach(() => {
  for (const fn of [...Object.values(db), ...Object.values(sp)]) {
    fn.mockReset();
  }
  mockTables({});
  db.upsertRow.mockImplementation(async () => ({ $id: "doc-new" }));
  db.createRow.mockImplementation(async () => ({ $id: "ver-new" }));
  db.updateRow.mockImplementation(async () => ({ $id: "doc-1" }));
  db.deleteRow.mockImplementation(async () => undefined);
  sp.uploadNewFile.mockImplementation(
    async (driveId: string, _folder: string, name: string) => ({
      driveId,
      itemId: `item:${name}`,
      lastModified: "2026-10-01T00:00:00Z",
      name,
      size: 3,
      webUrl: `https://sp.example/${name}`,
    })
  );
  sp.replaceFileInPlace.mockImplementation(
    async (driveId: string, itemId: string) => ({
      driveId,
      itemId,
      lastModified: "2026-10-01T00:00:00Z",
      name: "Vedtekter for BISO.pdf",
      size: 3,
      webUrl: "https://sp.example/internal",
    })
  );
  sp.createAnonymousViewLink.mockResolvedValue("https://sp.example/:b:/g/public");
});

describe("createDocument", () => {
  test("archives the version, uploads the current file and stores both rows", async () => {
    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ data: "doc-new", publicLink: true });
    expect(sp.uploadNewFile).toHaveBeenNthCalledWith(
      1,
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon/Previous versions",
      "Vedtekter for BISO v13.pdf",
      expect.anything()
    );
    expect(sp.uploadNewFile).toHaveBeenNthCalledWith(
      2,
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon",
      "Vedtekter for BISO.pdf",
      expect.anything()
    );
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "unique()",
      expect.objectContaining({
        sharepoint_item_id: "item:Vedtekter for BISO.pdf",
        sharepoint_web_url: "https://sp.example/:b:/g/public",
        version: "13",
        version_number: 13,
      })
    );
    const documentPayload = db.upsertRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(documentPayload).not.toHaveProperty("sort_order");
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "document_versions",
      expect.any(String),
      expect.objectContaining({
        document_id: "doc-new",
        file_name: "Vedtekter for BISO v13.pdf",
        sharepoint_item_id: "item:Vedtekter for BISO v13.pdf",
        version_major: 13,
        version_minor: 0,
      })
    );
  });

  test("falls back to the internal URL when anonymous links are forbidden", async () => {
    sp.createAnonymousViewLink.mockRejectedValue(new Error("sharingDisabled"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ data: "doc-new", publicLink: false });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "unique()",
      expect.objectContaining({
        sharepoint_web_url: "https://sp.example/Vedtekter for BISO.pdf",
      })
    );
  });

  test("rejects an invalid version before touching SharePoint", async () => {
    const result = await createDocument(
      { ...nationalValues, version: "v13b" },
      pdfFormData()
    );

    expect(result).toEqual({ error: "Invalid form data", sharePointError: false });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("refuses a second document that would share the same SharePoint file", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("writes nothing to the database when SharePoint fails", async () => {
    sp.uploadNewFile.mockRejectedValue(new Error("403 Forbidden"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error: "SharePoint upload failed: 403 Forbidden",
      sharePointError: true,
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("uploadNewVersion", () => {
  test("archives the new version and replaces the current file in place", async () => {
    mockTables({
      document_versions: [
        { $id: "ver-12", document_id: "doc-1", version_major: 12, version_minor: 0 },
      ],
      documents: [existingDoc],
    });

    const result = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(result).toEqual({ data: "doc-1", version: "13" });
    expect(sp.uploadNewFile).toHaveBeenCalledWith(
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon/Previous versions",
      "Vedtekter for BISO v13.pdf",
      expect.anything()
    );
    expect(sp.replaceFileInPlace).toHaveBeenCalledWith(
      "drive-1",
      "current-item",
      expect.anything()
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({ version: "13", version_number: 13 })
    );
    // The stored public link stays; the current item did not change.
    const payload = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("sharepoint_web_url");
  });

  test.each([
    ["12", "the same version"],
    ["11.9", "a lower version"],
  ])("rejects %s (%s) before touching SharePoint", async (version) => {
    mockTables({
      document_versions: [
        { $id: "ver-12", document_id: "doc-1", version_major: 12, version_minor: 0 },
      ],
      documents: [existingDoc],
    });

    const result = await uploadNewVersion("doc-1", version, pdfFormData());

    expect(result).toEqual({
      error: "Version must be higher than the current v12",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(sp.replaceFileInPlace).not.toHaveBeenCalled();
  });

  test("uses the document's own version when no history rows exist yet", async () => {
    mockTables({ documents: [existingDoc] });

    const rejected = await uploadNewVersion("doc-1", "12", pdfFormData());
    expect(rejected).toEqual({
      error: "Version must be higher than the current v12",
      sharePointError: false,
    });

    const accepted = await uploadNewVersion("doc-1", "12.1", pdfFormData());
    expect(accepted).toEqual({ data: "doc-1", version: "12.1" });
  });

  test("rejects a malformed version", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await uploadNewVersion("doc-1", "next", pdfFormData());

    expect(result).toEqual({
      error: "Version must be a number like 12 or 7.1",
      sharePointError: false,
    });
  });
});

describe("listDocumentVersions", () => {
  test("returns versions newest first", async () => {
    mockTables({
      document_versions: [
        { $id: "a", document_id: "doc-1", version_major: 7, version_minor: 1 },
        { $id: "b", document_id: "doc-1", version_major: 12, version_minor: 0 },
        { $id: "c", document_id: "doc-1", version_major: 7, version_minor: 10 },
      ],
      documents: [existingDoc],
    });

    const versions = await listDocumentVersions("doc-1");

    expect(versions.map((v) => v.$id)).toEqual(["b", "c", "a"]);
  });

  test("returns nothing for a document the caller cannot see", async () => {
    mockTables({});
    expect(await listDocumentVersions("missing")).toEqual([]);
  });
});

describe("deleteDocument", () => {
  test("removes the version rows along with the document", async () => {
    mockTables({
      document_versions: [
        { $id: "ver-11", document_id: "doc-1", version_major: 11, version_minor: 0 },
        { $id: "ver-12", document_id: "doc-1", version_major: 12, version_minor: 0 },
      ],
      documents: [existingDoc],
    });

    const result = await deleteDocument("doc-1");

    expect(result).toEqual({ data: true });
    expect(db.deleteRow).toHaveBeenCalledWith("app", "document_versions", "ver-11");
    expect(db.deleteRow).toHaveBeenCalledWith("app", "document_versions", "ver-12");
    expect(db.deleteRow).toHaveBeenCalledWith("app", "documents", "doc-1");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/admin && bun test ./src/app/\(portal\)/_actions/documents-versions.test.ts`
Expected: FAIL (`listDocumentVersions` is not exported; `createDocument` result shape differs).

- [ ] **Step 5: Rewrite `documents.ts`**

Replace the import block at the top (lines 1-38) with:

```ts
"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Campus,
  Documents,
  DocumentsCategory,
  DocumentsLanguage,
  DocumentsScope,
  DocumentsStatus,
  DocumentVersions,
} from "@repo/api/types/appwrite";
import {
  getSharePointConfig,
  SharePointService,
} from "@repo/connectors/sharepoint";
import {
  compareDocumentVersions,
  type DocumentVersion,
  formatDocumentVersion,
  parseDocumentVersion,
} from "@repo/shared/utils/document-version";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
import {
  buildDocumentFileNames,
  type DocumentLanguage,
  getDocumentsDriveId,
  PREVIOUS_VERSIONS_FOLDER,
  resolveFolderPath,
} from "@/lib/documents/sharepoint-mapping";
import {
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import {
  DOCUMENTS_PAGE_SIZE,
  type DocumentCreateFormValues,
  type DocumentMetadataFormValues,
  documentCreateSchema,
  documentMetadataSchema,
  documentVersionSchema,
} from "./schemas";
```

Replace everything from `type SharePointUploadOutcome` through the end of `uploadDocumentToSharePoint` (lines 62-108) with:

```ts
type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type SharePointFile = Awaited<ReturnType<SharePointService["uploadNewFile"]>>;

// Upper bound on history rows read per document; far above any real count.
const MAX_VERSIONS_PER_DOCUMENT = 500;

type SharePointPublishOutcome =
  | { error: string; ok: false }
  | { archived: SharePointFile; current: SharePointFile; ok: true };

/**
 * Writes one version to SharePoint: a per-version copy under "Previous
 * versions", then the document's current file (created on first upload,
 * replaced in place afterwards so its URL never changes).
 */
async function publishVersionToSharePoint(input: {
  buffer: Buffer;
  campusName: string | null;
  category: string;
  existing: { driveId: string; itemId: string } | null;
  language: DocumentLanguage;
  title: string;
  version: string;
}): Promise<SharePointPublishOutcome> {
  let driveId: string;
  let folderPath: string;
  try {
    driveId = getDocumentsDriveId();
    folderPath = resolveFolderPath(
      input.category,
      input.language,
      input.campusName
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `SharePoint is not configured: ${message}`, ok: false };
  }

  const names = buildDocumentFileNames(input.title, input.version);
  try {
    const sp = getSharePointService();
    const archived = await sp.uploadNewFile(
      driveId,
      `${folderPath}/${PREVIOUS_VERSIONS_FOLDER}`,
      names.archived,
      input.buffer
    );
    const current = input.existing
      ? await sp.replaceFileInPlace(
          input.existing.driveId,
          input.existing.itemId,
          input.buffer
        )
      : await sp.uploadNewFile(driveId, folderPath, names.current, input.buffer);
    return { archived, current, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `SharePoint upload failed: ${message}`, ok: false };
  }
}

/**
 * "Anyone with the link" URL for the current file, or null when the tenant or
 * site forbids anonymous links. Never fails the upload.
 */
async function createPublicLink(file: SharePointFile): Promise<string | null> {
  try {
    return await getSharePointService().createAnonymousViewLink(
      file.driveId,
      file.itemId
    );
  } catch {
    return null;
  }
}

async function listVersionRows(
  db: AdminDb,
  documentId: string
): Promise<DocumentVersions[]> {
  const response = await db.listRows<DocumentVersions>(
    "app",
    "document_versions",
    [Query.equal("document_id", documentId), Query.limit(MAX_VERSIONS_PER_DOCUMENT)]
  );
  return response.rows;
}

function toVersion(row: DocumentVersions): DocumentVersion {
  return { major: row.version_major, minor: row.version_minor ?? 0 };
}

/** Highest known version: history rows first, then the document's own label. */
function latestKnownVersion(
  doc: Documents,
  rows: DocumentVersions[]
): DocumentVersion | null {
  const known = rows.map(toVersion);
  const own = parseDocumentVersion(doc.version);
  if (own) {
    known.push(own);
  }
  return known.sort(compareDocumentVersions).at(-1) ?? null;
}

async function recordVersion(
  db: AdminDb,
  input: {
    documentId: string;
    file: SharePointFile;
    userId: string;
    version: DocumentVersion;
  }
): Promise<void> {
  await db.createRow("app", "document_versions", ID.unique(), {
    document_id: input.documentId,
    file_name: input.file.name,
    file_size: input.file.size,
    sharepoint_drive_id: input.file.driveId,
    sharepoint_item_id: input.file.itemId,
    uploaded_by: input.userId,
    version_major: input.version.major,
    version_minor: input.version.minor,
  });
}
```

In `listDocuments`, delete the line `Query.orderAsc("sort_order"),`.

Replace the whole `createDocument` function with:

```ts
export async function createDocument(
  metadata: DocumentCreateFormValues,
  formData: FormData
): Promise<
  | { data: string; publicLink: boolean; error?: never; sharePointError?: never }
  | { error: string; sharePointError: boolean; data?: never }
> {
  const ctx = await requireAuth();
  const validated = documentCreateSchema.safeParse(metadata);
  const version = validated.success
    ? parseDocumentVersion(validated.data.version)
    : null;
  if (!(validated.success && version)) {
    return { error: "Invalid form data", sharePointError: false };
  }

  const { campus_id, scope, category, language, title } = validated.data;

  if (scope === "national" && !ctx.roles.includes("globaladmin")) {
    return {
      error: "Only global admins can create national documents",
      sharePointError: false,
    };
  }

  const { db } = await createAdminClient();
  try {
    // National documents may keep a null campus (global admins only); campus
    // documents require a campus, and department authors their own department.
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: scope === "national",
      campusId: campus_id ?? null,
      departmentId: validated.data.department_id ?? null,
    });
    if (validated.data.status === "published") {
      assertPublishAccess(
        ctx,
        campus_id ?? null,
        validated.data.department_id ?? null
      );
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Document access denied",
      sharePointError: false,
    };
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return { error: fileCheck.error, sharePointError: false };
  }

  // The current file is named after the title, so two documents with the same
  // title, category and language would share one file (campus is checked
  // below because a null campus cannot be queried with equal()).
  const sameName = await db.listRows<Documents>("app", "documents", [
    Query.equal("title", title),
    Query.equal("category", category),
    Query.equal("language", language),
    Query.limit(25),
  ]);
  const collides = sameName.rows.some(
    (row) => (row.campus_id ?? null) === (campus_id ?? null)
  );
  if (collides) {
    return {
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    };
  }

  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());
  const campusName = await resolveCampusNameForPath(db, scope, campus_id);
  const versionLabel = formatDocumentVersion(version);

  const published = await publishVersionToSharePoint({
    buffer,
    campusName,
    category,
    existing: null,
    language,
    title,
    version: versionLabel,
  });
  if (!published.ok) {
    return { error: published.error, sharePointError: true };
  }
  const publicUrl = await createPublicLink(published.current);

  const doc = await db.upsertRow("app", "documents", "unique()", {
    title,
    description: validated.data.description ?? null,
    category: category as DocumentsCategory,
    scope: scope as DocumentsScope,
    // Canonical ownership relationships; the scalar column remains as
    // migration-era compatibility metadata only.
    campus: campus_id ?? null,
    campus_id: campus_id ?? null,
    department: validated.data.department_id ?? null,
    language: language as DocumentsLanguage,
    version: versionLabel,
    version_number: version.major,
    sharepoint_item_id: published.current.itemId,
    sharepoint_drive_id: published.current.driveId,
    sharepoint_web_url: publicUrl ?? published.current.webUrl,
    file_size: published.current.size,
    status: validated.data.status as DocumentsStatus,
    updated_by: ctx.userId,
  });
  await recordVersion(db, {
    documentId: doc.$id,
    file: published.archived,
    userId: ctx.userId,
    version,
  });

  await logAuditEvent(ctx, "document.create", {
    resourceId: doc.$id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  return { data: doc.$id, publicLink: publicUrl !== null };
}
```

In `updateDocumentMetadata`, delete these two lines from the `db.updateRow` payload: `version: validated.data.version ?? null,` and `sort_order: validated.data.sort_order,`.

Replace the whole `uploadNewVersion` function with:

```ts
export async function uploadNewVersion(
  id: string,
  versionInput: string,
  formData: FormData
): Promise<
  | { data: string; version: string; error?: never; sharePointError?: never }
  | { error: string; sharePointError: boolean; data?: never }
> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const existing = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = existing.rows[0];
  if (!doc) {
    return { error: "Document not found", sharePointError: false };
  }

  const versionOwnership = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(ctx, versionOwnership.campus, versionOwnership.department);

  const parsedInput = documentVersionSchema.safeParse(versionInput);
  const version = parsedInput.success
    ? parseDocumentVersion(parsedInput.data)
    : null;
  if (!version) {
    return {
      error: "Version must be a number like 12 or 7.1",
      sharePointError: false,
    };
  }

  const latest = latestKnownVersion(doc, await listVersionRows(db, id));
  if (latest && compareDocumentVersions(version, latest) <= 0) {
    return {
      error: `Version must be higher than the current v${formatDocumentVersion(latest)}`,
      sharePointError: false,
    };
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return { error: fileCheck.error, sharePointError: false };
  }
  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());
  const campusName = await resolveCampusNameForPath(db, doc.scope, doc.campus_id);
  const versionLabel = formatDocumentVersion(version);

  const published = await publishVersionToSharePoint({
    buffer,
    campusName,
    category: doc.category,
    existing: {
      driveId: doc.sharepoint_drive_id,
      itemId: doc.sharepoint_item_id,
    },
    language: (doc.language ?? "no") as DocumentLanguage,
    title: doc.title,
    version: versionLabel,
  });
  if (!published.ok) {
    return { error: published.error, sharePointError: true };
  }

  await recordVersion(db, {
    documentId: id,
    file: published.archived,
    userId: ctx.userId,
    version,
  });
  // sharepoint_web_url is left alone: the current item, and so its public
  // link, did not change.
  await db.updateRow("app", "documents", id, {
    version: versionLabel,
    version_number: version.major,
    file_size: published.current.size,
    updated_by: ctx.userId,
  });

  await logAuditEvent(ctx, "document.version_upload", {
    resourceId: id,
    resourceType: "document",
    payload: { version: versionLabel },
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { data: id, version: versionLabel };
}

export async function listDocumentVersions(
  id: string
): Promise<DocumentVersions[]> {
  // getDocument applies the caller's campus/department scope.
  const doc = await getDocument(id);
  if (!doc) {
    return [];
  }
  const { db } = await createAdminClient();
  const rows = await listVersionRows(db, id);
  return rows.sort((a, b) =>
    compareDocumentVersions(toVersion(b), toVersion(a))
  );
}
```

In `deleteDocument`, replace the line `await db.deleteRow("app", "documents", id);` and the NOTE comment above it with:

```ts
  // NOTE: SharePoint files are kept on purpose; only the Appwrite rows go.
  for (const versionRow of await listVersionRows(db, id)) {
    await db.deleteRow("app", "document_versions", versionRow.$id);
  }
  await db.deleteRow("app", "documents", id);
```

- [ ] **Step 6: Run the admin action tests**

Run: `cd apps/admin && bun test ./src/app/\(portal\)/_actions/documents-versions.test.ts ./src/app/\(portal\)/_actions/documents-relationships.test.ts ./src/app/\(portal\)/_actions/schemas.test.ts`
Expected: all PASS.

- [ ] **Step 7: Commit**

`document-editor-client.tsx` still calls the old signatures, so `check-types` is red until Task 6. Commit the action layer now:

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)/_actions"
git commit -m "feat(admin): store every document version and a public link"
```

---

### Task 6: Admin UI

**Files:**
- Create: `apps/admin/src/app/(portal)/_components/version-input.tsx`
- Modify: `apps/admin/src/app/(portal)/documents/[id]/_components/document-editor-client.tsx`
- Modify: `apps/admin/src/app/(portal)/documents/[id]/page.tsx`
- Modify: `apps/admin/src/app/(portal)/documents/_components/documents-list-client.tsx:189-195`
- Modify: `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json` (the `documents` block, ~lines 1030-1075)

**Interfaces:**
- Consumes: Task 5 actions and schemas; `DocumentVersions` type; `formatDocumentVersion`.
- Produces: `VersionInput({ disabled?, onBlur?, onChange, value }: { disabled?: boolean; onBlur?: () => void; onChange: (value: string) => void; value: string })`.

- [ ] **Step 1: Create the prefixed version input**

```tsx
// apps/admin/src/app/(portal)/_components/version-input.tsx
import { PortalInput } from "./portal-fields";
import { STUDIO } from "./studio";

interface VersionInputProps {
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  value: string;
}

/** Numeric version field with a fixed "v" attached, like a dialling prefix. */
export function VersionInput({
  disabled,
  onBlur,
  onChange,
  value,
}: VersionInputProps) {
  return (
    <div className="flex">
      <span
        aria-hidden="true"
        className="flex select-none items-center rounded-l-lg px-3 text-sm"
        style={{
          background: "rgba(255,255,255,0.4)",
          border: `0.5px solid ${STUDIO.rule2}`,
          borderRight: "none",
          color: STUDIO.ink3,
        }}
      >
        v
      </span>
      <PortalInput
        aria-label="Version number"
        className="rounded-l-none"
        disabled={disabled}
        inputMode="decimal"
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="12"
        value={value}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update the i18n messages**

In `packages/i18n/messages/en/adminPortal.json`, inside `documents`:
- `fields.version`: `"Version"`
- delete `fields.versionNumber` and `fields.sortOrder`
- `versionUploadHint`: `"Enter the new version number and choose the PDF. The file on SharePoint is replaced, so existing links keep working, and the earlier version stays in the history."`
- add after `versionUploadHint` (mind the comma):

```json
    "versionHistory": "Version history",
    "noVersions": "No versions recorded yet.",
    "copyLink": "Copy link",
    "linkCopied": "Link copied",
    "notPublicWarning": "Saved, but SharePoint would not create a public link. People outside BISO can still download the document from biso.no."
```

In `packages/i18n/messages/no/adminPortal.json`, the same keys:
- `fields.version`: `"Versjon"`; delete `fields.versionNumber` and `fields.sortOrder`
- `versionUploadHint`: `"Skriv inn det nye versjonsnummeret og velg PDF-en. Filen i SharePoint erstattes, så eksisterende lenker virker fortsatt, og forrige versjon blir liggende i historikken."`

```json
    "versionHistory": "Versjonshistorikk",
    "noVersions": "Ingen versjoner registrert ennå.",
    "copyLink": "Kopier lenke",
    "linkCopied": "Lenke kopiert",
    "notPublicWarning": "Lagret, men SharePoint ville ikke opprette en offentlig lenke. Personer utenfor BISO kan fortsatt laste ned dokumentet fra biso.no."
```

Verify both files parse: `python3 -c "import json; [json.load(open(f'packages/i18n/messages/{l}/adminPortal.json')) for l in ('en','no')]; print('ok')"` → `ok`.

- [ ] **Step 3: Pass versions and labels from the page**

In `documents/[id]/page.tsx`:

Change the import `import { getDocument } from "../../_actions/documents";` to:

```ts
import { getDocument, listDocumentVersions } from "../../_actions/documents";
```

Replace the `Promise.all` block with:

```ts
  const [document, campuses, versions] = await Promise.all([
    isNew ? null : getDocument(id),
    listCampuses(),
    isNew ? [] : listDocumentVersions(id),
  ]);
```

In the `labels` object, delete the `versionNumber` and `sortOrder` lines and add:

```ts
        versionHistory: t("versionHistory"),
        noVersions: t("noVersions"),
        copyLink: t("copyLink"),
        linkCopied: t("linkCopied"),
        notPublicWarning: t("notPublicWarning"),
```

Add the prop to the element: `versions={versions}` (after `lockDepartment`).

- [ ] **Step 4: Update the editor client**

In `document-editor-client.tsx`:

(a) Imports. Change the type import and schema import, and add the helper imports:

```ts
import type {
  Campus,
  Documents,
  DocumentVersions,
} from "@repo/api/types/appwrite";
import { formatDocumentVersion } from "@repo/shared/utils/document-version";
```

```ts
import { Copy, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
```

```ts
import {
  DOCUMENT_FORM_CATEGORIES,
  type DocumentMetadataFormValues,
  documentCreateSchema,
  documentMetadataSchema,
} from "@/app/(portal)/_actions/schemas";
```

```ts
import { VersionInput } from "../../../_components/version-input";
```

(b) Props: add `versions: DocumentVersions[];` to `DocumentEditorClientProps` and `versions,` to the destructured parameters.

(c) State: below `const [versionFile, setVersionFile] = …` add:

```ts
  const [nextVersion, setNextVersion] = useState("");
```

(d) `defaultValues`: replace the `version`, `version_number` and `sort_order` entries with a single line:

```ts
      version: "",
```

(e) `onSubmit`: replace the body from `const validated = …` down to the end of the `try` block's `if (isNew) { … } else { … }` with:

```ts
      const ownership = {
        campus_id: value.scope === "national" ? null : value.campus_id || null,
        department_id:
          value.scope === "national" ? null : (value.department_id ?? null),
      };

      setIsSaving(true);
      try {
        if (isNew) {
          const validated = documentCreateSchema.safeParse(value);
          if (!validated.success) {
            toast.error(
              validated.error.issues[0]?.message ?? labels.saveError
            );
            return;
          }
          if (!selectedFile) {
            toast.error("A PDF file is required");
            return;
          }

          const formData = new FormData();
          formData.append("file", selectedFile);

          const result = await createDocument(
            { ...validated.data, ...ownership },
            formData
          );

          if (result.error) {
            if (result.sharePointError) {
              toast.error(`${labels.sharepointError}: ${result.error}`, {
                duration: 8000,
              });
            } else {
              toast.error(result.error);
            }
            return;
          }
          if (result.publicLink) {
            toast.success(labels.saveSuccess);
          } else {
            toast.warning(labels.notPublicWarning, { duration: 10_000 });
          }
          router.push(`/documents/${result.data}`);
        } else {
          const validated = documentMetadataSchema.safeParse(value);
          if (!validated.success) {
            toast.error(labels.saveError);
            return;
          }
          const result = await updateDocumentMetadata(document!.$id, {
            ...validated.data,
            ...ownership,
          });
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.saveSuccess);
        }
      } finally {
        setIsSaving(false);
      }
```

(The `setIsSaving(true); try {` / `} finally { … }` lines that were already there are replaced by the ones in this block; make sure they are not duplicated.)

(f) Replace `handleVersionUpload` with:

```ts
  function handleVersionUpload() {
    if (!(versionFile && document)) {
      return;
    }
    startVersionTransition(async () => {
      const formData = new FormData();
      formData.append("file", versionFile);
      const result = await uploadNewVersion(
        document.$id,
        nextVersion,
        formData
      );
      if (result.error) {
        if (result.sharePointError) {
          toast.error(`${labels.sharepointError}: ${result.error}`, {
            duration: 8000,
          });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(`${labels.uploadSuccess} — v${result.version}`);
      setVersionFile(null);
      setNextVersion("");
      router.refresh();
    });
  }

  async function handleCopyLink() {
    if (!document) {
      return;
    }
    await navigator.clipboard.writeText(document.sharepoint_web_url);
    toast.success(labels.linkCopied);
  }
```

(g) Replace the whole `<div className="grid grid-cols-3 gap-4"> … </div>` block (the version / status / sort_order row) with:

```tsx
          <div className="grid grid-cols-2 gap-4">
            {isNew ? (
              <form.Field name="version">
                {(field) => (
                  <PortalField
                    hint="Numbers only, e.g. 12 or 7.1"
                    label={labels.version}
                    required
                  >
                    <VersionInput
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
                  </PortalField>
                )}
              </form.Field>
            ) : null}

            <form.Field name="status">
              {(field) => (
                <PortalField label={labels.status} required>
                  <PortalSelect
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value as DocumentMetadataFormValues["status"]
                      )
                    }
                    options={STATUS_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>
```

(h) In the "File on SharePoint" section, replace the `<p className="text-sm" …>Version {document.version_number}…</p>` element with:

```tsx
                  <p className="text-sm" style={{ color: STUDIO.ink2 }}>
                    {document.version ? `v${document.version}` : "—"}
                  </p>
```

Directly after the existing `<a … >{labels.viewOnSharePoint}</a>` element, add:

```tsx
                <PortalButton
                  onClick={handleCopyLink}
                  type="button"
                  variant="secondary"
                >
                  <Copy size={12} />
                  {labels.copyLink}
                </PortalButton>
```

Replace the "Upload new version" `<div className="space-y-3"> … </div>` block with:

```tsx
              {/* Upload new version */}
              <div className="space-y-3">
                <p className="text-xs" style={{ color: STUDIO.ink4 }}>
                  {labels.versionUploadHint}
                </p>
                <PortalField label={labels.version} required>
                  <VersionInput
                    disabled={isVersionUploading}
                    onChange={setNextVersion}
                    value={nextVersion}
                  />
                </PortalField>
                <PdfUploadField onChange={setVersionFile} value={versionFile} />
                {versionFile && (
                  <PortalButton
                    disabled={isVersionUploading || nextVersion.trim() === ""}
                    onClick={handleVersionUpload}
                    style={{ background: STUDIO.ink, color: STUDIO.paper }}
                    type="button"
                  >
                    {isVersionUploading ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        <Upload size={14} />
                        {labels.uploadVersion}
                      </>
                    )}
                  </PortalButton>
                )}
              </div>

              {/* Version history */}
              <div className="space-y-2">
                <h3
                  className="font-medium text-[11px] uppercase tracking-[0.06em]"
                  style={{ color: STUDIO.ink3 }}
                >
                  {labels.versionHistory}
                </h3>
                {versions.length === 0 ? (
                  <p className="text-xs" style={{ color: STUDIO.ink4 }}>
                    {labels.noVersions}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {versions.map((row) => (
                      <li
                        className="flex items-center justify-between text-sm"
                        key={row.$id}
                        style={{ color: STUDIO.ink2 }}
                      >
                        <span>
                          v
                          {formatDocumentVersion({
                            major: row.version_major,
                            minor: row.version_minor ?? 0,
                          })}
                        </span>
                        <span className="text-xs" style={{ color: STUDIO.ink4 }}>
                          {formatBytes(row.file_size)} ·{" "}
                          {new Date(row.$createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
```

- [ ] **Step 5: Update the admin list row**

In `documents-list-client.tsx`, replace lines 189-195 (the `<span>v{doc.version_number}</span>` line and the `{doc.version && ( … )}` block after it) with:

```tsx
                    <span>{doc.version ? `v${doc.version}` : "—"}</span>
```

- [ ] **Step 6: Type-check, build and test admin**

Run: `bun --filter=admin check-types`
Expected: no errors.

Run: `bun run build --filter=admin`
Expected: `✓ Compiled successfully` (this is what enforces the `"use server"` export rule).

Run: `cd apps/admin && bun test ./src`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)" packages/i18n/messages
git commit -m "feat(admin): version input, history and copyable public link for documents"
```

---

### Task 7: Web documents page

**Gate:** `DocumentVersions` type exists (same gate as Task 5).

**Files:**
- Create: `apps/web/src/lib/documents.ts`
- Test: `apps/web/src/lib/documents.test.ts`
- Modify (full rewrite): `apps/web/src/app/actions/documents.ts`
- Modify: `apps/web/src/app/api/documents/[id]/download/route.ts`
- Test: `apps/web/src/app/api/documents/[id]/download/route.test.ts` (new)
- Modify: `apps/web/src/components/documents/documents-list-client.tsx` (prop type only)
- Modify: `apps/web/src/components/documents/document-row.tsx`

**Interfaces:**
- Consumes: Task 1 helpers; `campusScopeIds` from `@/lib/campus-scope`; `Documents`, `DocumentVersions` types.
- Produces (`@/lib/documents`):
  - `interface PublicDocumentVersion { createdAt: string; fileSize: number | null; id: string; label: string }`
  - `type PublicDocument = Documents & { previousVersions: PublicDocumentVersion[] }`
  - `isDocumentVisibleForCampus(doc: Pick<Documents, "campus_id" | "scope">, campusId: string | null | undefined): boolean`
  - `sortDocumentsForDisplay<T extends Pick<Documents, "category" | "title">>(docs: T[]): T[]`
  - `attachPreviousVersions(docs: Documents[], versions: DocumentVersions[]): PublicDocument[]`
- `listPublishedDocuments(params?: { campusId?: string | null }): Promise<PublicDocument[]>`

- [ ] **Step 1: Write the failing test for the pure module**

```ts
// apps/web/src/lib/documents.test.ts
import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { NATIONAL_CAMPUS_ID } from "./campus-scope";
import {
  attachPreviousVersions,
  isDocumentVisibleForCampus,
  sortDocumentsForDisplay,
} from "./documents";

const national = { campus_id: null, scope: "national" } as Documents;
const oslo = { campus_id: "1", scope: "campus" } as Documents;
const bergen = { campus_id: "2", scope: "campus" } as Documents;
const nationalCampus = {
  campus_id: NATIONAL_CAMPUS_ID,
  scope: "campus",
} as Documents;

describe("isDocumentVisibleForCampus", () => {
  it("shows everything when all campuses are selected", () => {
    for (const selection of [null, undefined, "", "all"]) {
      for (const doc of [national, oslo, bergen, nationalCampus]) {
        expect(isDocumentVisibleForCampus(doc, selection)).toBe(true);
      }
    }
  });

  it("shows the selected campus and national documents only", () => {
    expect(isDocumentVisibleForCampus(oslo, "1")).toBe(true);
    expect(isDocumentVisibleForCampus(national, "1")).toBe(true);
    expect(isDocumentVisibleForCampus(nationalCampus, "1")).toBe(true);
    expect(isDocumentVisibleForCampus(bergen, "1")).toBe(false);
  });

  it("shows only national documents when National is selected", () => {
    expect(isDocumentVisibleForCampus(national, NATIONAL_CAMPUS_ID)).toBe(true);
    expect(isDocumentVisibleForCampus(nationalCampus, NATIONAL_CAMPUS_ID)).toBe(
      true
    );
    expect(isDocumentVisibleForCampus(oslo, NATIONAL_CAMPUS_ID)).toBe(false);
  });

  it("hides a campus-scoped document that has no campus", () => {
    const orphan = { campus_id: null, scope: "campus" } as Documents;
    expect(isDocumentVisibleForCampus(orphan, "1")).toBe(false);
  });
});

describe("sortDocumentsForDisplay", () => {
  it("orders by category, then title, without mutating the input", () => {
    const docs = [
      { category: "campus-bylaws", title: "B" },
      { category: "code-of-conduct", title: "A" },
      { category: "national-statutes", title: "Z" },
      { category: "campus-bylaws", title: "A" },
      { category: "something-new", title: "A" },
    ] as Documents[];

    const sorted = sortDocumentsForDisplay(docs);

    expect(sorted.map((d) => `${d.category}:${d.title}`)).toEqual([
      "national-statutes:Z",
      "campus-bylaws:A",
      "campus-bylaws:B",
      "code-of-conduct:A",
      "something-new:A",
    ]);
    expect(docs[0]?.title).toBe("B");
  });
});

describe("attachPreviousVersions", () => {
  const version = (
    id: string,
    documentId: string,
    major: number,
    minor = 0
  ): DocumentVersions =>
    ({
      $createdAt: "2026-01-01T00:00:00.000Z",
      $id: id,
      document_id: documentId,
      file_size: 10,
      version_major: major,
      version_minor: minor,
    }) as DocumentVersions;

  it("lists older versions newest first and leaves out the current one", () => {
    const docs = [{ $id: "doc-1", version: "12" }] as Documents[];
    const result = attachPreviousVersions(docs, [
      version("a", "doc-1", 7, 1),
      version("b", "doc-1", 12),
      version("c", "doc-1", 7, 10),
      version("d", "doc-2", 99),
    ]);

    expect(result[0]?.previousVersions.map((v) => v.label)).toEqual([
      "7.10",
      "7.1",
    ]);
    expect(result[0]?.previousVersions[0]?.id).toBe("c");
  });

  it("gives documents without history an empty list", () => {
    const docs = [{ $id: "doc-1", version: null }] as Documents[];
    expect(attachPreviousVersions(docs, [])[0]?.previousVersions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/lib/documents.test.ts`
Expected: FAIL, cannot resolve `./documents`.

- [ ] **Step 3: Write the pure module**

```ts
// apps/web/src/lib/documents.ts
import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import {
  compareDocumentVersions,
  formatDocumentVersion,
  parseDocumentVersion,
} from "@repo/shared/utils/document-version";
import { campusScopeIds } from "./campus-scope";

/**
 * Pure helpers for the public documents page (no directives, no I/O) so the
 * server action and client components can both import them.
 */

export interface PublicDocumentVersion {
  createdAt: string;
  fileSize: number | null;
  id: string;
  label: string;
}

export type PublicDocument = Documents & {
  previousVersions: PublicDocumentVersion[];
};

const CATEGORY_ORDER = [
  "national-statutes",
  "campus-bylaws",
  "code-of-conduct",
  "business-regulations",
  "communication-guidelines",
];

/**
 * National documents concern every campus, so they ride along with whichever
 * campus is selected; campus documents show only for their own campus. With
 * no campus selected, everything shows.
 */
export function isDocumentVisibleForCampus(
  doc: Pick<Documents, "campus_id" | "scope">,
  campusId: string | null | undefined
): boolean {
  const scopeIds = campusScopeIds(campusId);
  if (scopeIds === null || doc.scope === "national") {
    return true;
  }
  return doc.campus_id !== null && scopeIds.includes(doc.campus_id);
}

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function sortDocumentsForDisplay<
  T extends Pick<Documents, "category" | "title">,
>(docs: T[]): T[] {
  return [...docs].sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.title.localeCompare(b.title, "nb")
  );
}

/** Adds each document's earlier versions, newest first, excluding the current one. */
export function attachPreviousVersions(
  docs: Documents[],
  versions: DocumentVersions[]
): PublicDocument[] {
  const byDocument = new Map<string, DocumentVersions[]>();
  for (const row of versions) {
    const rows = byDocument.get(row.document_id) ?? [];
    rows.push(row);
    byDocument.set(row.document_id, rows);
  }

  return docs.map((doc) => {
    const current = parseDocumentVersion(doc.version);
    const previousVersions = (byDocument.get(doc.$id) ?? [])
      .map((row) => ({
        row,
        version: { major: row.version_major, minor: row.version_minor ?? 0 },
      }))
      .filter(
        ({ version }) =>
          !current || compareDocumentVersions(version, current) !== 0
      )
      .sort((a, b) => compareDocumentVersions(b.version, a.version))
      .map(({ row, version }) => ({
        createdAt: row.$createdAt,
        fileSize: row.file_size,
        id: row.$id,
        label: formatDocumentVersion(version),
      }));
    return { ...doc, previousVersions };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/lib/documents.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Rewrite the server action**

```ts
// apps/web/src/app/actions/documents.ts
"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import {
  attachPreviousVersions,
  isDocumentVisibleForCampus,
  type PublicDocument,
  sortDocumentsForDisplay,
} from "@/lib/documents";

// Governing documents number in the tens; these caps are only a backstop.
const MAX_DOCUMENTS = 500;
const MAX_VERSIONS = 2000;

interface ListPublishedDocumentsParams {
  campusId?: string | null;
}

export async function listPublishedDocuments(
  params: ListPublishedDocumentsParams = {}
): Promise<PublicDocument[]> {
  try {
    const { db } = await createSessionClient();

    const published = await db.listRows<Documents>("app", "documents", [
      Query.equal("status", "published"),
      Query.limit(MAX_DOCUMENTS),
    ]);
    const visible = sortDocumentsForDisplay(
      published.rows.filter((doc) =>
        isDocumentVisibleForCampus(doc, params.campusId)
      )
    );
    if (visible.length === 0) {
      return [];
    }

    // History is an enhancement: if it cannot be read, still list documents.
    let versions: DocumentVersions[] = [];
    try {
      const result = await db.listRows<DocumentVersions>(
        "app",
        "document_versions",
        [
          Query.equal(
            "document_id",
            visible.map((doc) => doc.$id)
          ),
          Query.limit(MAX_VERSIONS),
        ]
      );
      versions = result.rows;
    } catch {
      versions = [];
    }

    return attachPreviousVersions(visible, versions);
  } catch {
    return [];
  }
}
```

- [ ] **Step 6: Write the failing download-route test**

```ts
// apps/web/src/app/api/documents/[id]/download/route.test.ts
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.fn();
const downloadDocument = vi.fn();

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: { listRows } })),
}));
vi.mock("@repo/connectors/sharepoint", () => ({
  getSharePointConfig: vi.fn(() => ({})),
  SharePointService: class {
    downloadDocument = downloadDocument;
  },
}));

const { GET } = await import("./route");

const doc = {
  $id: "doc-1",
  sharepoint_drive_id: "drive-1",
  sharepoint_item_id: "current-item",
  title: "Vedtekter for BISO",
};

function request(query = ""): NextRequest {
  return { nextUrl: new URL(`https://biso.no/api/documents/doc-1/download${query}`) } as NextRequest;
}

const context = { params: Promise.resolve({ id: "doc-1" }) };

/** Routes listRows by table. */
function mockTables(tables: Record<string, Record<string, unknown>[]>): void {
  listRows.mockImplementation((_db: string, table: string) => ({
    rows: tables[table] ?? [],
  }));
}

beforeEach(() => {
  listRows.mockReset();
  downloadDocument.mockReset();
  downloadDocument.mockResolvedValue(new ArrayBuffer(4));
});

describe("GET /api/documents/[id]/download", () => {
  it("serves the current file when no version is requested", async () => {
    mockTables({ documents: [doc] });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(downloadDocument).toHaveBeenCalledWith("drive-1", "current-item");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Vedtekter for BISO.pdf"'
    );
  });

  it("serves a previous version that belongs to the document", async () => {
    mockTables({
      document_versions: [
        {
          $id: "ver-7",
          document_id: "doc-1",
          sharepoint_drive_id: "drive-1",
          sharepoint_item_id: "archived-item",
          version_major: 7,
          version_minor: 1,
        },
      ],
      documents: [doc],
    });

    const response = await GET(request("?version=ver-7"), context);

    expect(response.status).toBe(200);
    expect(downloadDocument).toHaveBeenCalledWith("drive-1", "archived-item");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Vedtekter for BISO v7.1.pdf"'
    );
  });

  it("returns 404 for a version id that is not this document's", async () => {
    mockTables({ document_versions: [], documents: [doc] });

    const response = await GET(request("?version=ver-other"), context);

    expect(response.status).toBe(404);
    expect(downloadDocument).not.toHaveBeenCalled();
  });

  it("returns 404 when the document is missing or unpublished", async () => {
    mockTables({
      document_versions: [{ $id: "ver-7", document_id: "doc-1" }],
      documents: [],
    });

    const response = await GET(request("?version=ver-7"), context);

    expect(response.status).toBe(404);
    expect(downloadDocument).not.toHaveBeenCalled();
  });
});
```

Run: `cd apps/web && bunx vitest run "src/app/api/documents/[id]/download/route.test.ts"`
Expected: FAIL on the two `?version=` cases (the route ignores the parameter).

- [ ] **Step 7: Rewrite the download route**

```ts
// apps/web/src/app/api/documents/[id]/download/route.ts
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import {
  getSharePointConfig,
  SharePointService,
} from "@repo/connectors/sharepoint";
import { formatDocumentVersion } from "@repo/shared/utils/document-version";
import { type NextRequest, NextResponse } from "next/server";

const UNSAFE_FILE_NAME_CHARS_REGEX = /[^a-z0-9\sæøå.-]/gi;

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const versionId = req.nextUrl.searchParams.get("version");

  try {
    const { db } = await createSessionClient();
    const result = await db.listRows<Documents>("app", "documents", [
      Query.equal("$id", id),
      Query.equal("status", "published"),
      Query.limit(1),
    ]);

    const doc = result.rows[0];
    if (!doc) {
      return notFound();
    }

    let driveId = doc.sharepoint_drive_id;
    let itemId = doc.sharepoint_item_id;
    let fileName = doc.title;

    if (versionId) {
      // Scoped to this published document, so a version id cannot be used to
      // reach another document's file.
      const versions = await db.listRows<DocumentVersions>(
        "app",
        "document_versions",
        [
          Query.equal("$id", versionId),
          Query.equal("document_id", id),
          Query.limit(1),
        ]
      );
      const version = versions.rows[0];
      if (!version) {
        return notFound();
      }
      driveId = version.sharepoint_drive_id;
      itemId = version.sharepoint_item_id;
      const label = formatDocumentVersion({
        major: version.version_major,
        minor: version.version_minor ?? 0,
      });
      fileName = `${doc.title} v${label}`;
    }

    const sp = new SharePointService(getSharePointConfig());
    const buffer = await sp.downloadDocument(driveId, itemId);
    const safeFileName = fileName
      .replace(UNSAFE_FILE_NAME_CHARS_REGEX, "_")
      .trim();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
```

Run: `cd apps/web && bunx vitest run "src/app/api/documents/[id]/download/route.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 8: Show the version and history in the list**

In `documents-list-client.tsx`, change the type import and the prop type:

```ts
import type { PublicDocument } from "@/lib/documents";
```

```ts
interface DocumentsListClientProps {
  documents: PublicDocument[];
}
```

(Remove the now-unused `import type { Documents } from "@repo/api/types/appwrite";`.)

In `document-row.tsx`:

(a) Replace `import type { Documents } from "@repo/api/types/appwrite";` with `import type { PublicDocument } from "@/lib/documents";`, add `ChevronDown` to the `lucide-react` import, and change `doc: Documents;` to `doc: PublicDocument;` in `DocumentRowProps`.

(b) Below `const [isHovered, setIsHovered] = useState(false);` add:

```ts
  const [showHistory, setShowHistory] = useState(false);
  const historyId = `document-history-${doc.$id}`;
```

(c) Replace the two lines `{doc.version && <span>{doc.version}</span>}` and `{doc.version && <span>·</span>}` with:

```tsx
              {doc.version && <span>v{doc.version}</span>}
              {doc.version && <span>·</span>}
```

(d) Directly after the closing `</div>` of the `relative flex flex-col gap-6 md:flex-row md:items-center` container (the one that holds the icon, content and actions), still inside the card, add:

```tsx
        {doc.previousVersions.length > 0 && (
          <div className="relative mt-4 border-white/10 border-t pt-4">
            <button
              aria-controls={historyId}
              aria-expanded={showHistory}
              className="flex items-center gap-2 text-sm transition-colors"
              onClick={() => setShowHistory((open) => !open)}
              style={{ color: "rgba(255,255,255,0.60)" }}
              type="button"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showHistory ? "rotate-180" : ""}`}
              />
              Previous versions ({doc.previousVersions.length})
            </button>
            {showHistory && (
              <ul className="mt-3 space-y-2" id={historyId}>
                {doc.previousVersions.map((version) => (
                  <li
                    className="flex items-center justify-between gap-4 text-sm"
                    key={version.id}
                    style={{ color: "rgba(255,255,255,0.60)" }}
                  >
                    <span>
                      v{version.label}
                      {version.fileSize
                        ? ` · ${formatBytes(version.fileSize)}`
                        : ""}
                      {" · "}
                      {new Date(version.createdAt).toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <a
                      className="flex items-center gap-1.5 underline-offset-4 hover:underline"
                      download
                      href={`/api/documents/${doc.$id}/download?version=${version.id}`}
                      style={{ color: "#3DA9E0" }}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
```

- [ ] **Step 9: Type-check and test web**

Run: `cd apps/web && bun run check-types`
Expected: no errors.

Run: `cd apps/web && bunx vitest run src/lib/documents.test.ts "src/app/api/documents/[id]/download/route.test.ts" src/lib/campus-scope.test.ts`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
bun x ultracite fix
git add apps/web/src
git commit -m "feat(web): show document versions with history and campus-scoped listing"
```

---

### Task 8: Documentation and full verification

**Files:**
- Modify: `apps/admin/docs/SHAREPOINT_DOCUMENTS_SETUP.md` (sections 4-8)
- Modify: `apps/docs/content/docs/admin-handbook/documents.mdx` ("Replacing or deleting a file")

- [ ] **Step 1: Update the setup guide**

In `SHAREPOINT_DOCUMENTS_SETUP.md`:

Section 4, add to the `env` block:

```env
# Drive (document library) that holds "Organisational documents". Required:
# uploads fail with a configuration error when it is missing.
SHAREPOINT_DOCUMENTS_DRIVE_ID=b!...
```

Replace section 6 ("Recommended Folder Structure in SharePoint") body with:

````markdown
The admin app writes under `Organisational documents` in the Intranet document
library and creates any missing folders itself:

```
Organisational documents/
  <Category>/[<Campus>/]<Norsk versjon | Engelsk versjon>/
    <Title>.pdf                  ← current version, replaced in place
    Previous versions/
      <Title> v12.pdf            ← one file per uploaded version
      <Title> v11.pdf
```

Category folders: `Statutes`, `Local laws` (with a campus subfolder),
`Code of Conduct`, `Authorization Matrix`, `Target Documents`,
`Business Regulations`, `Communication Guidelines`.

File names come from the document title, not from the uploaded file.
````

Replace section 7 steps 3-4 with:

```markdown
3. Enter the **version** as a number (`12` or `7.1`); the `v` is added for you
4. Select your PDF and click **Save**

The file is uploaded twice: as the current file and as a per-version copy in
`Previous versions`. A public "anyone with the link" URL is created for the
current file and shown in the editor with a **Copy link** button. To publish a
later version, open the document, enter the higher version number and upload
the new PDF.
```

Replace the section 8 paragraph that starts "When a document is uploaded or replaced via the admin app" with:

```markdown
The current file is replaced in place, so its URL and its public link never
change. Link the SharePoint page to the document once, using **Copy link** in
the admin app, and it will always open the latest version.
```

In section 9, add:

```markdown
### "SharePoint is not configured: SHAREPOINT_DOCUMENTS_DRIVE_ID is not set"

- Set `SHAREPOINT_DOCUMENTS_DRIVE_ID` to the Intranet document library's drive id

### Saved, but no public link

- The tenant or the Intranet site does not allow "Anyone" links. Enable them in
  the SharePoint admin centre, or share the `biso.no` documents page instead
```

- [ ] **Step 2: Update the admin handbook**

In `documents.mdx`, replace the paragraph starting "To **replace** a file" with:

```markdown
To **publish a new version** — for example after a general assembly adopts new local laws — open the document, enter the new version number (it must be higher than the current one) and upload the PDF. The link stays the same and now opens the new version; earlier versions remain available under "Previous versions" on biso.no and in the `Previous versions` folder in SharePoint.
```

- [ ] **Step 3: Full verification**

Run: `bun run check-types`
Expected: all packages pass.

Run: `bun run lint`
Expected: no errors.

Run: `bun run build --filter=admin`
Expected: `✓ Compiled successfully`.

Run: `cd apps/admin && bun test ./src && cd ../../packages/connectors && bun test ./src && cd ../shared && bunx vitest run && cd ../../apps/web && bunx vitest run`
Expected: all PASS.

- [ ] **Step 4: Manual check (needs the table from Task 2 pushed)**

With `bun run dev --filter=admin` and `bun run dev --filter=web`:

1. Create a draft national-statutes document, version `1`. Expect two files in SharePoint: `Statutes/Norsk versjon/<Title>.pdf` and `…/Previous versions/<Title> v1.pdf`.
2. Copy the link in the editor and open it in a private browser window. Expect the PDF without signing in.
3. Upload version `1` again → rejected. Upload `1.1` → accepted; the copied link now opens the new file.
4. Publish it; on `/documents` in web expect `v1.1` and "Previous versions (1)" with a working download.
5. Create a campus-bylaws document for one campus; select another campus in the top navigation → it disappears while the national one stays; select all campuses → both show.
6. Delete the test documents in admin and remove the test files from SharePoint by hand.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/admin/docs/SHAREPOINT_DOCUMENTS_SETUP.md apps/docs/content/docs/admin-handbook/documents.mdx
git commit -m "docs: document versioned uploads and the stable SharePoint link"
```

---

## Known gaps left for Markus

- **Category enum:** the admin form offers `authorization-matrix` and `target-documents`, but the Appwrite `documents.category` enum does not list them, so saving one fails at the database. Add the two values to the enum in Appwrite and regenerate types, or remove them from `DOCUMENT_FORM_CATEGORIES`. The folder mapping in Task 4 already covers both.
- **Production config:** set `SHAREPOINT_DOCUMENTS_DRIVE_ID` and the new `SHAREPOINT_CLIENT_SECRET` in the production environment.
- **Backfill:** the PDFs already in SharePoint are not imported as history.
