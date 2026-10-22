/**
 * Migrate the legacy benefit data (campus_data `_nb` lists and the old
 * campus_benefits rows) to the benefits-studio shape. Dry run by default: it
 * only reads, then writes `plan.json` (carries redemption codes, gitignored)
 * and `review.md` (never contains codes) to the output directory. Apply only
 * writes what an approved plan.json says, and is safe to re-run.
 *
 * What apply overwrites:
 *   - A row it makes public gets its whole permission list replaced with
 *     `['read("any")']`. That is right for today's rows, which only carry
 *     `read("team:biso-members")`; a row with other permissions would lose them.
 *   - A re-run after editors have changed migrated benefits in the new admin
 *     resets them: every created row back to the plan's title, status
 *     (published), section, order, category, partner, redemption type (none),
 *     featured flag and public permissions; every updated row back to the
 *     plan's section, category, partner and order; and every planned partner
 *     to active with the plan's name and logo. Re-run only before editors
 *     start.
 *   - A planned row that was deleted outside the plan is skipped (with its
 *     code) and counted as `skippedMissing`.
 *
 * Usage (from packages/shared):
 *   bun run migrate:benefits                                  # dry run
 *   bun run migrate:benefits --out <dir>                      # custom output dir
 *   bun run migrate:benefits --apply --plan <path to plan.json>
 * (`bun run migrate:benefits -- --apply --plan <path>` works too.)
 *
 * Go-live order: follow the release runbook in
 * docs/superpowers/benefits-studio-go-live.md, the only order to use. Re-run
 * the dry run if the benefits changed since the last one.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AppwriteException, Client, Query, TablesDB } from "node-appwrite";
import {
  type CampusDataInput,
  type ExistingBenefitInput,
  planBenefitMigration,
  renderMigrationReview,
  summarizeMigrationPlan,
  validateMigrationPlan,
} from "../utils/benefit-migration";
import {
  applyBenefitMigration,
  InvalidMigrationPlanError,
  type MigrationWriter,
  parseMigrationPlanJson,
} from "../utils/benefit-migration-apply";

const DATABASE_ID = "app";
const PAGE_SIZE = 100;
const NOT_FOUND = 404;
/** Fixed on purpose: a JSON parse error can quote the file (codes). */
const INVALID_PLAN_JSON = "plan.json er ikke gyldig JSON";
const DEFAULT_OUT_DIR = join(
  import.meta.dirname,
  "../../../.superpowers/benefits-migration"
);

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!(endpoint && project && apiKey)) {
  console.error(
    "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, and APPWRITE_API_KEY."
  );
  process.exit(2);
}

const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);

const args = process.argv.slice(2).filter((arg) => arg !== "--");

function flagValue(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function listAll<T>(tableId: string): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  while (true) {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
    });
    all.push(...(rows as unknown as T[]));
    const last = rows.at(-1);
    if (rows.length < PAGE_SIZE || !last) {
      return all;
    }
    cursor = last.$id;
  }
}

async function dryRun(): Promise<void> {
  const outDir = resolve(flagValue("--out") ?? DEFAULT_OUT_DIR);
  const campusData = await listAll<CampusDataInput>("campus_data");
  const benefits = await listAll<ExistingBenefitInput>("campus_benefits");

  const plan = planBenefitMigration({
    benefits,
    campusData,
    generatedAt: new Date().toISOString(),
  });
  const problems = validateMigrationPlan(plan);

  await mkdir(outDir, { recursive: true });
  const planPath = join(outDir, "plan.json");
  const reviewPath = join(outDir, "review.md");
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(reviewPath, renderMigrationReview(plan));

  const summary = summarizeMigrationPlan(plan);
  console.log("Mode: dry-run");
  console.log(
    `Read ${campusData.length} campus_data rows and ${benefits.length} campus_benefits rows`
  );
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: ${value}`);
  }
  console.log(`Plan:   ${planPath}`);
  console.log(`Review: ${reviewPath}`);

  if (problems.length > 0) {
    console.error("Plan has problems:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === NOT_FOUND;
}

function createWriter(): MigrationWriter {
  return {
    async deleteRow(table, rowId) {
      try {
        await db.deleteRow({ databaseId: DATABASE_ID, tableId: table, rowId });
        return "deleted";
      } catch (error) {
        if (isNotFound(error)) {
          return "missing";
        }
        throw error;
      }
    },
    async updateRow(table, rowId, data, permissions) {
      try {
        await db.updateRow({
          databaseId: DATABASE_ID,
          tableId: table,
          rowId,
          data,
          ...(permissions ? { permissions } : {}),
        });
        return "updated";
      } catch (error) {
        if (isNotFound(error)) {
          return "missing";
        }
        throw error;
      }
    },
    async upsertRow(table, rowId, data, permissions) {
      await db.upsertRow({
        databaseId: DATABASE_ID,
        tableId: table,
        rowId,
        data,
        ...(permissions ? { permissions } : {}),
      });
    },
  };
}

async function apply(): Promise<void> {
  const planPath = flagValue("--plan");
  if (!planPath) {
    console.error(
      "Usage: bun run migrate:benefits --apply --plan <path to plan.json>"
    );
    process.exit(1);
  }
  const plan = parseMigrationPlanJson(
    await readFile(resolve(planPath), "utf8")
  );
  if (!plan) {
    console.error(INVALID_PLAN_JSON);
    process.exit(1);
  }
  try {
    const result = await applyBenefitMigration(plan, createWriter());
    console.log("Mode: APPLY");
    for (const [key, value] of Object.entries(result)) {
      console.log(`${key}: ${value}`);
    }
  } catch (error) {
    if (error instanceof InvalidMigrationPlanError) {
      console.error(error.message);
      for (const problem of error.problems) {
        console.error(`  - ${problem}`);
      }
      process.exit(1);
    }
    throw error;
  }
}

try {
  await (args.includes("--apply") ? apply() : dryRun());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
