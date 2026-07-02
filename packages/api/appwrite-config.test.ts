import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

interface AppwriteTable {
  $id: string;
  $permissions?: string[];
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

const MAX_BUCKET_FILE_SIZE_BYTES = 100_000_000;

function loadConfig(): AppwriteConfig {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, "appwrite.config.json"), "utf8")
  ) as AppwriteConfig;
}

describe("appwrite collection permissions", () => {
  test("do not grant broad collection-level creates", () => {
    const config = loadConfig();

    const offenders = config.tables.flatMap((table) =>
      (table.$permissions ?? [])
        .filter((permission) => BROAD_CREATE_PERMISSIONS.has(permission))
        .map((permission) => `${table.$id}: ${permission}`)
    );

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
});
