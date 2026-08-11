import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

interface AppwriteColumn {
  key: string;
  onDelete?: string;
  relatedTable?: string;
  twoWay?: boolean;
  twoWayKey?: string;
  type: string;
}

interface AppwriteTable {
  $id: string;
  $permissions?: string[];
  columns?: AppwriteColumn[];
}

interface AppwriteBucket {
  $id: string;
  $permissions?: string[];
  allowedFileExtensions?: string[];
  maximumFileSize?: number;
}

interface AppwriteConfig {
  buckets: AppwriteBucket[];
  tables: AppwriteTable[];
}

const BROAD_CREATE_PERMISSIONS = new Set(['create("any")', 'create("users")']);

// Live drift observed 2026-08-11: the user profile table still grants
// create("users") even though this repo only creates profile rows through the
// admin client. The external mobile app may rely on it, so removal needs an
// owner check there before the grant is dropped and this exception deleted.
const KNOWN_BROAD_CREATE_EXCEPTIONS = new Set(['user: create("users")']);

const MAX_BUCKET_FILE_SIZE_BYTES = 100_000_000;

const REQUIRED_MEDIA_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "mp4",
  "webm",
  "mov",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "pdf",
  "txt",
  "csv",
  "zip",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
] as const;

function loadConfig(): AppwriteConfig {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, "appwrite.config.json"), "utf8")
  ) as AppwriteConfig;
}

const REQUIRED_OWNERSHIP_RELATIONSHIPS = [
  ["pages", "campus", "campus"],
  ["pages", "department", "departments"],
  ["campus_benefits", "campus", "campus"],
  ["campus_benefits", "department", "departments"],
  ["announcements", "campus", "campus"],
  ["announcements", "department", "departments"],
  ["documents", "campus", "campus"],
  ["documents", "department", "departments"],
] as const;

const REQUIRED_TRANSLATION_RELATIONSHIPS = [
  ["events", "translation_refs", "content_translations"],
  ["news", "translation_refs", "content_translations"],
  ["webshop_products", "translation_refs", "content_translations"],
  ["campus_benefits", "contentTranslations", "content_translations"],
  ["pages", "translation_refs", "page_translations"],
] as const;

function findColumn(
  config: AppwriteConfig,
  tableId: string,
  key: string
): AppwriteColumn | undefined {
  const table = config.tables.find((candidate) => candidate.$id === tableId);
  return table?.columns?.find((column) => column.key === key);
}

describe("content ownership relationships", () => {
  test.each(
    REQUIRED_OWNERSHIP_RELATIONSHIPS
  )("%s.%s is a two-way setNull relationship to %s", (tableId, key, relatedTable) => {
    const column = findColumn(loadConfig(), tableId, key);

    expect(column, `${tableId}.${key}`).toBeDefined();
    expect(column?.type, `${tableId}.${key}`).toBe("relationship");
    expect(column?.relatedTable, `${tableId}.${key}`).toBe(relatedTable);
    expect(column?.twoWay, `${tableId}.${key}`).toBe(true);
    expect(column?.onDelete, `${tableId}.${key}`).toBe("setNull");
  });
});

describe("content translation relationships", () => {
  test.each(
    REQUIRED_TRANSLATION_RELATIONSHIPS
  )("%s.%s cascades to %s", (tableId, key, relatedTable) => {
    const column = findColumn(loadConfig(), tableId, key);

    expect(column, `${tableId}.${key}`).toBeDefined();
    expect(column?.type, `${tableId}.${key}`).toBe("relationship");
    expect(column?.relatedTable, `${tableId}.${key}`).toBe(relatedTable);
    expect(column?.twoWay, `${tableId}.${key}`).toBe(true);
    expect(column?.onDelete, `${tableId}.${key}`).toBe("cascade");
  });

  test("jobs.translations is a one-way cascade relationship", () => {
    const column = findColumn(loadConfig(), "jobs", "translations");

    expect(column).toBeDefined();
    expect(column?.type).toBe("relationship");
    expect(column?.relatedTable).toBe("content_translations");
    expect(column?.twoWay).toBe(false);
    expect(column?.onDelete).toBe("cascade");
  });
});

describe("appwrite collection permissions", () => {
  test("do not grant broad collection-level creates", () => {
    const config = loadConfig();

    const offenders = config.tables
      .flatMap((table) =>
        (table.$permissions ?? [])
          .filter((permission) => BROAD_CREATE_PERMISSIONS.has(permission))
          .map((permission) => `${table.$id}: ${permission}`)
      )
      .filter((offender) => !KNOWN_BROAD_CREATE_EXCEPTIONS.has(offender));

    expect(offenders).toEqual([]);
  });
});

describe("appwrite bucket permissions", () => {
  test("do not grant broad bucket-level creates", () => {
    const config = loadConfig();

    const offenders = config.buckets.flatMap((bucket) =>
      (bucket.$permissions ?? [])
        .filter((permission) => BROAD_CREATE_PERMISSIONS.has(permission))
        .map((permission) => `${bucket.$id}: ${permission}`)
    );

    expect(offenders).toEqual([]);
  });

  test("user-upload buckets constrain extension and size", () => {
    const config = loadConfig();

    for (const bucketId of ["resumes", "expenses"]) {
      const bucket = config.buckets.find((b) => b.$id === bucketId);
      expect(bucket, bucketId).toBeDefined();
      expect(bucket?.allowedFileExtensions?.length, bucketId).toBeGreaterThan(
        0
      );
      expect(bucket?.maximumFileSize, bucketId).toBeLessThan(
        MAX_BUCKET_FILE_SIZE_BYTES
      );
    }
  });

  test("media bucket supports every approved publishing extension", () => {
    const config = loadConfig();
    const mediaBucket = config.buckets.find((bucket) => bucket.$id === "media");

    expect(mediaBucket).toBeDefined();
    for (const extension of REQUIRED_MEDIA_EXTENSIONS) {
      expect(mediaBucket?.allowedFileExtensions, extension).toContain(
        extension
      );
    }
  });
});
