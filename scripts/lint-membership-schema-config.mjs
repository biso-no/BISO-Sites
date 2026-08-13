/**
 * Config lint for the membership purchase schema additions.
 *
 * IMPORTANT — this is NOT a post-push check. It reads
 * `packages/api/appwrite.config.json` only (the local file this branch
 * edited) and never contacts Appwrite, so it cannot tell you whether
 * `appwrite push tables` has been run, succeeded, or targeted the right
 * project. Passing here only means "the column specs this branch wrote to
 * the local config file are internally consistent with each other" — nothing
 * about the live schema. Renamed from `verify-membership-schema.mjs`, which
 * claimed to be exactly the post-push verification it cannot perform.
 *
 * For a real post-push check, list the columns on the live tables instead
 * (requires the Appwrite CLI logged in against the target project):
 *
 *   appwrite tables-db list-columns --database-id app --table-id user --json
 *   appwrite tables-db list-columns --database-id app --table-id orders --json
 *
 * ...and confirm bi_employee_id / bi_campus_id / bi_linked_at appear on
 * `user`, and membership_invoice_id / membership_fulfilment_lock appear on
 * `orders`.
 */
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync("packages/api/appwrite.config.json", "utf8")
);
const tables = config.tables;

const expected = {
  user: [
    {
      key: "bi_employee_id",
      type: "string",
      required: false,
      array: false,
      size: 32,
      default: null,
      encrypt: false,
    },
    {
      key: "bi_campus_id",
      type: "string",
      required: false,
      array: false,
      size: 8,
      default: null,
      encrypt: false,
    },
    {
      key: "bi_linked_at",
      type: "datetime",
      required: false,
      array: false,
      default: null,
      format: "",
    },
  ],
  orders: [
    {
      key: "membership_invoice_id",
      type: "string",
      required: false,
      array: false,
      size: 64,
      default: null,
      encrypt: false,
    },
    {
      key: "membership_fulfilment_lock",
      type: "integer",
      required: false,
      array: false,
      min: 0,
      max: 1_000_000,
      default: 0,
    },
  ],
};

const mismatches = [];

for (const [tableId, expectedColumns] of Object.entries(expected)) {
  const table = tables.find((t) => t.$id === tableId);
  if (!table) {
    mismatches.push(`table ${tableId}`);
    continue;
  }

  const columns = table.columns;
  for (const expectedCol of expectedColumns) {
    const actualCol = columns.find((c) => c.key === expectedCol.key);
    if (!actualCol) {
      mismatches.push(`${tableId}.${expectedCol.key} missing`);
      continue;
    }

    // Check all expected fields
    for (const [field, expectedValue] of Object.entries(expectedCol)) {
      const actualValue = actualCol[field];
      if (actualValue !== expectedValue) {
        mismatches.push(
          `${tableId}.${expectedCol.key}.${field}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        );
      }
    }
  }
}

if (mismatches.length > 0) {
  console.error(
    `Config lint failed (local file only):\n${mismatches.join("\n")}`
  );
  process.exit(1);
}
console.log(
  "Membership schema config lint passed — packages/api/appwrite.config.json only. " +
    "This does NOT confirm anything was pushed to Appwrite; see the header comment for the real post-push check."
);
