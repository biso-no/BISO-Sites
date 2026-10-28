import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readSchemaConfig } from "./config";
import { buildDocsSchemaConfig } from "./schema";

const SOURCE = JSON.parse(
  readFileSync(
    join(import.meta.dir, "../../../../packages/api/appwrite.config.json"),
    "utf8"
  )
) as Record<string, unknown> & { projectId: string; tables: unknown[] };

// No API key: the schema is pushed before the key is made (README step 2).
const SCHEMA_ENV = {
  DOCS_APPWRITE_ENDPOINT: "http://localhost:8080/v1",
  DOCS_APPWRITE_PROJECT: "docs-screenshots",
};

const CONFIG = readSchemaConfig(SCHEMA_ENV);

test("the schema step needs only the endpoint and the project", () => {
  expect(CONFIG).toEqual({
    endpoint: SCHEMA_ENV.DOCS_APPWRITE_ENDPOINT,
    projectId: SCHEMA_ENV.DOCS_APPWRITE_PROJECT,
  });
});

test("the schema step still requires the endpoint and the project", () => {
  expect(() =>
    readSchemaConfig({ ...SCHEMA_ENV, DOCS_APPWRITE_ENDPOINT: " " })
  ).toThrow("DOCS_APPWRITE_ENDPOINT");
  expect(() =>
    readSchemaConfig({ ...SCHEMA_ENV, DOCS_APPWRITE_PROJECT: undefined })
  ).toThrow("DOCS_APPWRITE_PROJECT");
});

test("the schema step refuses the production project in any case or with spaces", () => {
  for (const variant of [
    SOURCE.projectId,
    SOURCE.projectId.toUpperCase(),
    `  ${SOURCE.projectId}\t`,
  ]) {
    expect(() =>
      readSchemaConfig({ ...SCHEMA_ENV, DOCS_APPWRITE_PROJECT: variant })
    ).toThrow("production");
  }
});

test("the schema step refuses a project an app is set up with", () => {
  for (const key of [
    "APPWRITE_PROJECT_ID",
    "NEXT_PUBLIC_APPWRITE_PROJECT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  ]) {
    expect(() =>
      readSchemaConfig({
        ...SCHEMA_ENV,
        [key]: ` ${SCHEMA_ENV.DOCS_APPWRITE_PROJECT.toUpperCase()} `,
      })
    ).toThrow(key);
  }
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
