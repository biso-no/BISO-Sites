/**
 * Writes a copy of the Appwrite schema for the docs project: only the
 * databases and tables from `packages/api/appwrite.config.json`, with the
 * project id and endpoint swapped for the docs project's. Push it from the
 * folder this prints, so the Appwrite CLI never reads the production
 * `projectId`. No functions, sites, settings or buckets are copied.
 *
 * Usage (from apps/docs): bun run screenshots:schema
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT, readSchemaConfig, type SchemaConfig } from "./config";

export interface DocsSchemaConfig {
  endpoint: string;
  projectId: string;
  projectName: string;
  tables: unknown[];
  tablesDB: unknown[];
}

const PROJECT_NAME = "BISO docs screenshots";

export function buildDocsSchemaConfig(
  source: Record<string, unknown>,
  config: SchemaConfig
): DocsSchemaConfig {
  const { tables, tablesDB } = source;
  if (!(Array.isArray(tables) && Array.isArray(tablesDB))) {
    throw new Error(
      "packages/api/appwrite.config.json has no tables or tablesDB list."
    );
  }
  return {
    endpoint: config.endpoint,
    projectId: config.projectId,
    projectName: PROJECT_NAME,
    tables,
    tablesDB,
  };
}

function main(): void {
  // Only the endpoint and the project: the API key is made after this step.
  const config = readSchemaConfig({ ...process.env });
  const source = JSON.parse(
    readFileSync(join(REPO_ROOT, "packages/api/appwrite.config.json"), "utf8")
  ) as Record<string, unknown>;
  const dir = mkdtempSync(join(tmpdir(), "biso-docs-schema-"));
  writeFileSync(
    join(dir, "appwrite.config.json"),
    `${JSON.stringify(buildDocsSchemaConfig(source, config), null, 2)}\n`
  );
  process.stdout.write(
    `Wrote the docs project's schema to ${dir}/appwrite.config.json\nPush it with:\n  cd ${dir}\n  appwrite push tables --all\n`
  );
}

if (import.meta.main) {
  main();
}
