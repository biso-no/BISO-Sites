import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface AppwriteTable {
  $id: string;
  $permissions?: string[];
}

interface AppwriteConfig {
  tables: AppwriteTable[];
}

const BROAD_CREATE_PERMISSIONS = new Set(['create("any")', 'create("users")']);

describe("appwrite collection permissions", () => {
  test("do not grant broad collection-level creates", () => {
    const config = JSON.parse(
      readFileSync(join(import.meta.dir, "appwrite.config.json"), "utf8")
    ) as AppwriteConfig;

    const offenders = config.tables.flatMap((table) =>
      (table.$permissions ?? [])
        .filter((permission) => BROAD_CREATE_PERMISSIONS.has(permission))
        .map((permission) => `${table.$id}: ${permission}`)
    );

    expect(offenders).toEqual([]);
  });
});
