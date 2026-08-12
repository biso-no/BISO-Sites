import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("packages/api/appwrite.config.json", "utf8"));
const tables = config.tables ?? config.collections ?? [];

const expected = {
  user: ["bi_employee_id", "bi_campus_id", "bi_linked_at"],
  orders: ["membership_invoice_id", "membership_fulfilment_lock"],
};

const missing = [];
for (const [tableId, keys] of Object.entries(expected)) {
  const table = tables.find((t) => t.$id === tableId);
  if (!table) {
    missing.push(`table ${tableId}`);
    continue;
  }
  const columns = table.columns ?? table.attributes ?? [];
  for (const key of keys) {
    if (!columns.some((c) => c.key === key)) {
      missing.push(`${tableId}.${key}`);
    }
  }
}

if (missing.length > 0) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Membership schema columns present.");
