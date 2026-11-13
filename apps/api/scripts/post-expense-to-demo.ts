/**
 * Books one real expense into the DEMO Finago company, to test the booking
 * without touching production's ledger. It runs the same code as the live
 * booking (receipt lines, booking dates, the merged PDF, dimensions and the
 * closed-period fallback) but writes nothing to Appwrite, so the expense keeps
 * its status and can still be booked for real later.
 *
 * Run from anywhere:
 *   bun --env-file=apps/api/.env.local apps/api/scripts/post-expense-to-demo.ts --list
 *   bun --env-file=apps/api/.env.local apps/api/scripts/post-expense-to-demo.ts <expenseId>
 *
 * The script points both the REST and the SOAP API at DEMO itself and refuses
 * to post unless both report a company whose name ends in "(DEMO)".
 */
import path from "node:path";

const DEMO_REST_ORG_ID = "628779637070457";
const DEMO_SOAP_IDENTITY_ID = "2ae8da79-0002-403b-a0df-0001007c0007";
const DEMO_NAME_SUFFIX = "(DEMO)";
const LIST_LIMIT = 25;

// Set before the connector is loaded, so no call can reach production.
process.env.TFSO_REST_ORG_ID = DEMO_REST_ORG_ID;
process.env.TFSO_SOAP_IDENTITY_ID = DEMO_SOAP_IDENTITY_ID;
// The cover page reads `public/logo.png` relative to the app.
process.chdir(path.join(import.meta.dirname, ".."));

const { Query } = await import("@repo/api");
const { createAdminClient } = await import("@repo/api/server");
const {
  getOrganizationName,
  getSessionCompanyName,
  getValidSession,
  listTransactionLines,
} = await import("@repo/connectors/24sevenoffice");
const { reimbursementNumber } = await import(
  "@repo/shared/utils/reimbursement-number"
);
const { buildAndPostLedgerTransaction, loadExpenseForPosting } = await import(
  "../src/lib/expense-posting"
);

type ExpenseRow = Awaited<ReturnType<typeof loadExpenseForPosting>>;

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function assertDemo(): Promise<void> {
  const restName = await getOrganizationName();
  const soapName = await getSessionCompanyName(await getValidSession());
  console.log(`REST company: ${restName}`);
  console.log(`SOAP company: ${soapName}`);
  if (!restName?.endsWith(DEMO_NAME_SUFFIX)) {
    fail(
      `REST is not logged in to a DEMO company (${restName}). Nothing posted.`
    );
  }
  if (!soapName?.endsWith(DEMO_NAME_SUFFIX)) {
    fail(
      `SOAP is not logged in to a DEMO company (${soapName}). Nothing posted.`
    );
  }
}

async function listExpenses(): Promise<void> {
  const { db } = await createAdminClient();
  const { rows } = await db.listRows<ExpenseRow>("app", "expense", [
    Query.select([
      "$id",
      "$sequence",
      "$createdAt",
      "status",
      "total",
      "departmentRel.Id",
      "departmentRel.Name",
      "campusRel.name",
    ]),
    Query.orderDesc("$createdAt"),
    Query.limit(LIST_LIMIT),
  ]);
  for (const row of rows) {
    console.log(
      [
        row.$id,
        reimbursementNumber(row.$sequence),
        row.status,
        `${row.total} kr`,
        `${row.departmentRel?.Name ?? "?"} (dimension ${row.departmentRel?.Id ?? "?"})`,
        row.campusRel?.name ?? "",
      ].join("  |  ")
    );
  }
}

async function postToDemo(expenseId: string): Promise<void> {
  await assertDemo();

  const { db, storage } = await createAdminClient();
  const expense = await loadExpenseForPosting(db, expenseId);
  console.log(
    `\nExpense ${expense.$id} — ${reimbursementNumber(expense.$sequence)}, status ${expense.status}, ${expense.total} kr`
  );
  console.log(
    `Department ${expense.departmentRel?.Name} (dimension ${expense.departmentRel?.Id ?? "none"}), campus ${expense.campus}`
  );
  for (const att of expense.expenseAttachments ?? []) {
    console.log(
      `  receipt ${att.$id}: date ${att.date?.slice(0, 10) ?? "none"}, ${att.amount ?? 0} kr, account ${att.account_number ?? "from type"}, "${att.description ?? ""}"`
    );
  }

  console.log("\nPosting to DEMO…");
  const { builtShifts, posted, receipts } = await buildAndPostLedgerTransaction(
    db,
    storage,
    expense
  );
  console.log(`\n✓ Posted. Transaction id ${posted.transactionId}`);

  const shifts = [...builtShifts, ...posted.shifts];
  for (const shift of shifts) {
    console.log(
      `  date moved for ${shift.ref ?? "?"}: ${shift.from || "none"} → ${shift.to} (${shift.reason})`
    );
  }

  const dates = receipts
    .map((line) => line.date)
    .concat(shifts.map((shift) => shift.to))
    .filter((date): date is string => Boolean(date))
    .sort();
  let lines: Awaited<ReturnType<typeof listTransactionLines>>;
  try {
    lines = await listTransactionLines({
      firstDate: dates[0] ?? "",
      lastDate: dates.at(-1) ?? "",
      transactionId: posted.transactionId,
    });
  } catch (error) {
    // The posting already succeeded; only the read-back failed.
    console.error(
      `\nPosted, but the lines could not be read back. Look up transaction ${posted.transactionId} in DEMO.`,
      error
    );
    return;
  }
  console.log(`\nLines in DEMO (${lines.length}):`);
  for (const line of lines) {
    const dims = line.dimensions
      .map((dim) => `${dim.dimensionType}=${dim.value}`)
      .join(" ");
    console.log(
      `  ${line.date}  period ${line.periodDate}  account ${line.accountNumber}  ${line.amount.toFixed(2)}  ${dims}  ${line.comment ?? ""}`
    );
  }
  console.log("\nNothing was written to Appwrite; the expense is unchanged.");
}

const arg = process.argv[2];
if (!arg) {
  fail("Pass an expense id, or --list to see recent expenses.");
}
if (arg === "--list") {
  await listExpenses();
} else {
  await postToDemo(arg);
}
