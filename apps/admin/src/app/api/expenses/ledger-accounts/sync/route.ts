import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import { requireApiAccountingAdmin } from "@/lib/api-auth";
import { syncLedgerAccounts } from "@/lib/finago/ledger-accounts-sync";

// POST (not GET): upserts ledger_accounts rows from the 24SevenOffice chart of
// accounts. A mutation must not be triggerable by prefetch/crawlers.
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiAccountingAdmin();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { db } = await createAdminClient();
    const result = await syncLedgerAccounts(db);
    return NextResponse.json({ success: result.failed === 0, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
