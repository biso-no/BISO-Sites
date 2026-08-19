import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createDb, loadDepartments, loadUserIdsByEmail } from "../src/appwrite";
import { parseCsv, toCsv } from "../src/transform/csv";
import {
  AUTO_ACCEPT_CONFIDENCE,
  matchDepartment,
  preserveUnseenResolvedRows,
} from "../src/transform/departments";
import { departmentMappingKey, transformJob } from "../src/transform/jobs";
import { transformOrder } from "../src/transform/orders";
import { transformProduct } from "../src/transform/products";
import type { RejectRow } from "../src/types";

const root = new URL("../", import.meta.url).pathname;
const snapshots = `${root}snapshots/`;
const mappings = `${root}mappings/`;
const reports = `${root}reports/`;
await mkdir(mappings, { recursive: true });
await mkdir(reports, { recursive: true });

const readSnapshot = async <T>(name: string): Promise<T[]> => {
  const path = `${snapshots}${name}.json`;
  if (!existsSync(path)) {
    console.log(`  (no ${name} snapshot — run extract first)`);
    return [];
  }
  return JSON.parse(await readFile(path, "utf8")) as T[];
};

const writeRejects = async (
  name: string,
  rejects: RejectRow[]
): Promise<void> => {
  if (rejects.length === 0) {
    return;
  }
  await writeFile(
    `${reports}${name}-rejects.csv`,
    toCsv(
      rejects.map((r) => ({
        label: r.label,
        reason: r.reason,
        source_id: String(r.sourceId),
      })),
      ["source_id", "label", "reason"]
    )
  );
  console.log(`  ${rejects.length} rejected → reports/${name}-rejects.csv`);
};

const db = createDb();
const departments = await loadDepartments(db);
console.log(`Loaded ${departments.length} departments from Appwrite`);

// ---- Department mapping review file -------------------------------------
const mappingPath = `${mappings}departments.csv`;
const resolved = new Map<string, string>();
const previousMappingRows = new Map<string, Record<string, string>>();
if (existsSync(mappingPath)) {
  for (const row of parseCsv(await readFile(mappingPath, "utf8"))) {
    const key = departmentMappingKey(row.wp_campus_id ?? "", row.wp_name ?? "");
    previousMappingRows.set(key, row);
    if (row.resolved_id) {
      resolved.set(key, row.resolved_id);
    }
  }
  console.log(`Loaded ${resolved.size} human-resolved department mappings`);
}

// ---- Jobs ----------------------------------------------------------------
const jobSnapshots =
  await readSnapshot<Parameters<typeof transformJob>[0]>("jobs");
const jobResults = jobSnapshots.map((job) =>
  transformJob(job, departments, resolved)
);
const jobs = jobResults.flatMap((r) => (r.job ? [r.job] : []));
await writeRejects(
  "jobs",
  jobResults.flatMap((r) => (r.reject ? [r.reject] : []))
);

// Rebuild the review file from every distinct (campus, department) pair seen.
const seen = new Map<string, { campusId: string; name: string }>();
for (const job of jobSnapshots) {
  const campusId = String(
    jobResults.find((r) => r.job?.rowId === `wpjob${job.id}`)?.job?.row
      .campus_id ?? ""
  );
  const name = job.department?.[0];
  if (campusId && name) {
    seen.set(departmentMappingKey(campusId, name), { campusId, name });
  }
}
const currentMappingRows = [...seen.values()].map((entry) => {
  const key = departmentMappingKey(entry.campusId, entry.name);
  const match = matchDepartment(entry.name, entry.campusId, departments);
  return {
    confidence: match.confidence.toFixed(2),
    resolved_id: resolved.get(key) ?? "",
    suggested_id:
      match.confidence >= AUTO_ACCEPT_CONFIDENCE
        ? (match.departmentId ?? "")
        : "",
    suggested_name: match.matchedName ?? "",
    wp_campus_id: entry.campusId,
    wp_name: entry.name,
  };
});
// A pair reviewed in a previous run but absent from this snapshot (a
// narrower --since window, or the pair simply didn't recur) would otherwise
// silently lose its hand-entered resolved_id here.
const mappingRows = preserveUnseenResolvedRows(
  currentMappingRows,
  previousMappingRows,
  new Set(seen.keys())
);
mappingRows.sort((a, b) => Number(a.confidence) - Number(b.confidence));
await writeFile(
  mappingPath,
  toCsv(mappingRows, [
    "wp_name",
    "wp_campus_id",
    "suggested_id",
    "suggested_name",
    "confidence",
    "resolved_id",
  ])
);
const unresolved = mappingRows.filter(
  (row) => !(row.resolved_id || row.suggested_id)
).length;
console.log(
  `Jobs: ${jobs.length} transformed; ${unresolved} department names need review in mappings/departments.csv`
);

// ---- Products ------------------------------------------------------------
const productSnapshots =
  await readSnapshot<Parameters<typeof transformProduct>[0]>("products");
const productResults = productSnapshots.map(transformProduct);
const products = productResults.flatMap((r) => (r.product ? [r.product] : []));
await writeRejects(
  "products",
  productResults.flatMap((r) => (r.reject ? [r.reject] : []))
);
console.log(`Products: ${products.length} transformed`);

// ---- Orders --------------------------------------------------------------
const orderSnapshots =
  await readSnapshot<Parameters<typeof transformOrder>[0]>("orders");
let orders: Array<{ row: Record<string, unknown>; rowId: string }> = [];
if (orderSnapshots.length > 0) {
  const userIds = await loadUserIdsByEmail(db);
  const orderResults = orderSnapshots.map((order) =>
    transformOrder(order, userIds)
  );
  orders = orderResults.flatMap((r) => ("row" in r ? [r] : []));
  await writeRejects(
    "orders",
    orderResults.flatMap((r) => ("reject" in r ? [r.reject] : []))
  );
  console.log(`Orders: ${orders.length} transformed`);
}

// ---- Warnings ------------------------------------------------------------
const warnings = [
  ...jobResults.flatMap((r) => r.warnings),
  ...productResults.flatMap((r) => r.warnings),
];
if (warnings.length > 0) {
  await writeFile(`${reports}warnings.txt`, `${warnings.join("\n")}\n`);
  console.log(`${warnings.length} warnings → reports/warnings.txt`);
}

await writeFile(
  `${snapshots}transformed.json`,
  JSON.stringify({ jobs, orders, products }, null, 2)
);
console.log("Wrote snapshots/transformed.json");
