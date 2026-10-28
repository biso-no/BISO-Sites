import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readScreenshotConfig } from "./config";
import { buildDocsSchemaConfig } from "./schema";

const SOURCE = JSON.parse(
  readFileSync(
    join(import.meta.dir, "../../../../packages/api/appwrite.config.json"),
    "utf8"
  )
) as Record<string, unknown> & { projectId: string; tables: unknown[] };

const CONFIG = readScreenshotConfig({
  DOCS_APPWRITE_API_KEY: "docs-test-key",
  DOCS_APPWRITE_ENDPOINT: "http://localhost:8080/v1",
  DOCS_APPWRITE_PROJECT: "docs-screenshots",
});

test("targets the docs project, never the production one", () => {
  const schema = buildDocsSchemaConfig(SOURCE, CONFIG);
  expect(schema.projectId).toBe("docs-screenshots");
  expect(schema.projectId).not.toBe(SOURCE.projectId);
  expect(schema.endpoint).toBe(CONFIG.endpoint);
});

test("holds only the databases and tables", () => {
  const schema = buildDocsSchemaConfig(SOURCE, CONFIG);
  expect(Object.keys(schema).sort()).toEqual([
    "endpoint",
    "projectId",
    "projectName",
    "tables",
    "tablesDB",
  ]);
  expect(schema.tables).toEqual(SOURCE.tables);
  expect(schema.tablesDB).toEqual(SOURCE.tablesDB as unknown[]);
});

test("refuses a source without tables", () => {
  expect(() =>
    buildDocsSchemaConfig({ projectId: "x", tables: "nope" }, CONFIG)
  ).toThrow("tables");
});
