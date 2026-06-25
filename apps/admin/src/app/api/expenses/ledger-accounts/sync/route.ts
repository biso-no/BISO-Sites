import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { listAccounts } from "@repo/connectors/24sevenoffice";
import { type NextRequest, NextResponse } from "next/server";
import { requireApiGlobalAdmin } from "@/lib/api-auth";

// POST (not GET): upserts ledger_accounts rows from the 24SevenOffice chart of
// accounts. A mutation must not be triggerable by prefetch/crawlers.
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiGlobalAdmin();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { db } = await createAdminClient();
    const syncedAt = new Date().toISOString();
    const accounts = await listAccounts();

    const results = await Promise.allSettled(
      accounts
        .filter((account) => typeof account.number === "number")
        .map((account) => {
          const id = String(account.number);
          const row = {
            $id: id,
            account_number: account.number as number,
            name: account.name ?? null,
            tax_code: typeof account.taxId === "number" ? account.taxId : null,
            active: true,
            synced_at: syncedAt,
          };
          return db.upsertRow<Models.DefaultRow>(
            "app",
            "ledger_accounts",
            id,
            row
          );
        })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      success: failed === 0,
      succeeded,
      failed,
      total: accounts.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
