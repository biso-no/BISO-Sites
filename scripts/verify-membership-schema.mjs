import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("packages/api/appwrite.config.json", "utf8"));
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
      encrypt: false
    },
    {
      key: "bi_campus_id",
      type: "string",
      required: false,
      array: false,
      size: 8,
      default: null,
      encrypt: false
    },
    {
      key: "bi_linked_at",
      type: "datetime",
      required: false,
      array: false,
      default: null,
      format: ""
    }
  ],
  orders: [
    {
      key: "membership_invoice_id",
      type: "string",
      required: false,
      array: false,
      size: 64,
      default: null,
      encrypt: false
    },
    {
      key: "membership_fulfilment_lock",
      type: "integer",
      required: false,
      array: false,
      min: 0,
      max: 1000000,
      default: 0
    }
  ]
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
  console.error(`Mismatches:\n${mismatches.join("\n")}`);
  process.exit(1);
}
console.log("Membership schema columns valid.");
