import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

interface AppwriteColumn {
  default?: unknown;
  elements?: string[];
  key: string;
  onDelete?: string;
  relatedTable?: string;
  required?: boolean;
  size?: number;
  twoWay?: boolean;
  twoWayKey?: string;
  type: string;
}

interface AppwriteIndex {
  columns?: string[];
  key: string;
  type: string;
}

interface AppwriteTable {
  $id: string;
  $permissions?: string[];
  columns?: AppwriteColumn[];
  indexes?: AppwriteIndex[];
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

const MEDIA_MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024;

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

  test("one locale per content item is enforced by a unique index", () => {
    const contentTranslations = loadConfig().tables.find(
      (table) => table.$id === "content_translations"
    );

    expect(contentTranslations?.indexes).toContainEqual(
      expect.objectContaining({
        columns: ["content_type", "content_id", "locale"],
        key: "uniq_content_locale",
        type: "unique",
      })
    );
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

  test("media bucket takes the admin's 250 MB video limit", () => {
    // apps/admin/src/lib/upload-buckets.ts: video goes up to 250 MiB, sent
    // in chunks; Appwrite refuses a total over the bucket's own limit.
    const mediaBucket = loadConfig().buckets.find(
      (bucket) => bucket.$id === "media"
    );

    expect(mediaBucket?.maximumFileSize).toBe(MEDIA_MAX_FILE_SIZE_BYTES);
  });
});

describe("expense booking history", () => {
  test("expense_events is server-written and readable only by the Operations Unit", () => {
    const table = loadConfig().tables.find((t) => t.$id === "expense_events");
    expect(table).toBeDefined();
    expect(table?.$permissions).toEqual([
      'read("team:sg-app-dept-operationsunit")',
    ]);
    expect(table?.columns?.map((c) => c.key)).toEqual(
      expect.arrayContaining(["expense_id", "actor_kind", "action", "note"])
    );
    expect(table?.indexes?.some((i) => i.columns?.[0] === "expense_id")).toBe(
      true
    );
  });

  test("expense_attachments records the date each line was booked on", () => {
    const table = loadConfig().tables.find(
      (t) => t.$id === "expense_attachments"
    );
    const column = table?.columns?.find((c) => c.key === "booked_date");
    expect(column?.type).toBe("datetime");
  });
});

describe("expense AI schema", () => {
  const OPS_READ = ['read("team:sg-app-dept-operationsunit")'];
  const findTable = (id: string) =>
    loadConfig().tables.find((t) => t.$id === id);
  const columnKeys = (id: string) => findTable(id)?.columns?.map((c) => c.key);

  test("expense_receipt_scans is server-only with a unique file_hash index", () => {
    const table = findTable("expense_receipt_scans");
    expect(table).toBeDefined();
    expect(table?.$permissions).toEqual(OPS_READ);
    expect(columnKeys("expense_receipt_scans")).toEqual(
      expect.arrayContaining(["file_hash", "result", "model"])
    );
    expect(
      table?.indexes?.some(
        (i) => i.type === "unique" && i.columns?.[0] === "file_hash"
      )
    ).toBe(true);
  });

  test("expense_type_examples is server-only and indexed by vendor_key", () => {
    const table = findTable("expense_type_examples");
    expect(table).toBeDefined();
    expect(table?.$permissions).toEqual(OPS_READ);
    expect(columnKeys("expense_type_examples")).toEqual(
      expect.arrayContaining([
        "vendor_key",
        "ai_cost_type",
        "final_cost_type",
        "account_number",
        "source",
      ])
    );
    expect(table?.indexes?.some((i) => i.columns?.[0] === "vendor_key")).toBe(
      true
    );
  });

  test("expense_attachments carries the AI classification fields", () => {
    expect(columnKeys("expense_attachments")).toEqual(
      expect.arrayContaining([
        "file_hash",
        "expense_id",
        "ai_cost_type",
        "type_source",
        "account_source",
        "receipt_issues",
      ])
    );
    expect(
      findTable("expense_attachments")?.indexes?.some(
        (i) => i.columns?.[0] === "file_hash"
      )
    ).toBe(true);
  });

  test("expense carries occasion, event and approver hints", () => {
    expect(columnKeys("expense")).toEqual(
      expect.arrayContaining(["occasion", "event_id", "approver_hints"])
    );
  });

  test("expense_cost_types has a Norwegian label and an occasion flag", () => {
    expect(columnKeys("expense_cost_types")).toEqual(
      expect.arrayContaining(["label_no", "ask_occasion"])
    );
  });
});

describe("approver directory schema", () => {
  const findTable = (id: string) =>
    loadConfig().tables.find((t) => t.$id === id);
  const findColumn = (table: string, key: string) =>
    findTable(table)?.columns?.find((c) => c.key === key);

  test("expense_approvers is server-only with a unique key index", () => {
    const table = findTable("expense_approvers");
    expect(table).toBeDefined();
    expect(table?.$permissions).toEqual([
      'read("team:sg-app-dept-operationsunit")',
    ]);
    expect(
      table?.indexes?.some(
        (i) => i.type === "unique" && i.columns?.[0] === "key"
      )
    ).toBe(true);
  });

  test("expense_approvals.approver_role includes president", () => {
    expect(
      findColumn("expense_approvals", "approver_role")?.elements
    ).toContain("president");
  });

  test("expense_approvals records the directory key", () => {
    expect(findColumn("expense_approvals", "directory_key")).toBeDefined();
  });

  test("expense_approvals.approver_email holds any email address", () => {
    expect(findColumn("expense_approvals", "approver_email")?.size).toBe(320);
  });

  test("expense records controller submissions", () => {
    expect(findColumn("expense", "submitter_is_controller")?.type).toBe(
      "boolean"
    );
  });
});

describe("admin expenses schema", () => {
  const findTable = (id: string) =>
    loadConfig().tables.find((t) => t.$id === id);
  const findColumn = (table: string, key: string) =>
    findTable(table)?.columns?.find((c) => c.key === key);
  const hasKeyIndex = (table: string, key: string, columns: string[]) =>
    findTable(table)?.indexes?.some(
      (i) =>
        i.key === key &&
        i.type === "key" &&
        JSON.stringify(i.columns) === JSON.stringify(columns)
    ) ?? false;

  test("expense_approvals records who decided and on whose behalf", () => {
    const email = findColumn("expense_approvals", "decided_by_email");
    expect(email?.type).toBe("string");
    expect(email?.size).toBe(320);
    expect(email?.required).toBe(false);
    const onBehalf = findColumn("expense_approvals", "on_behalf");
    expect(onBehalf?.type).toBe("boolean");
    expect(onBehalf?.required).toBe(false);
    expect(onBehalf?.default).toBe(false);
    expect(
      hasKeyIndex("expense_approvals", "idx_approver_email", ["approver_email"])
    ).toBe(true);
  });

  test("expense has campus and department list indexes", () => {
    expect(hasKeyIndex("expense", "idx_campus", ["campus"])).toBe(true);
    expect(hasKeyIndex("expense", "idx_department", ["department"])).toBe(true);
  });

  test("expense_approvers has email and campus-role indexes", () => {
    expect(hasKeyIndex("expense_approvers", "idx_email", ["email"])).toBe(true);
    expect(
      hasKeyIndex("expense_approvers", "idx_campus_role", ["campus_id", "role"])
    ).toBe(true);
  });

  test("expense_events.action includes booking_retried", () => {
    expect(findColumn("expense_events", "action")?.elements).toContain(
      "booking_retried"
    );
  });
});
