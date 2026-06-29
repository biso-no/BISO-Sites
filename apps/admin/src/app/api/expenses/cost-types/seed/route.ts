import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { DEFAULT_EXPENSE_COST_TYPES } from "@repo/shared/utils/expense-cost-types";
import { type NextRequest, NextResponse } from "next/server";
import { requireApiGlobalAdmin } from "@/lib/api-auth";

// POST: idempotently seeds the expense_cost_types table with the in-code default
// cost types (keyed by slug). Accounting can edit the rows afterwards.
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiGlobalAdmin();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { db } = await createAdminClient();

    const results = await Promise.allSettled(
      DEFAULT_EXPENSE_COST_TYPES.map((costType, index) => {
        const row = {
          $id: costType.slug,
          label: costType.label,
          slug: costType.slug,
          description: costType.description ?? null,
          ocr_category: costType.ocrCategory ?? null,
          account_number: costType.accountNumber,
          tax_code: costType.taxCode ?? null,
          campus_id: null,
          sort_order: index,
          active: true,
        };
        return db.upsertRow<Models.DefaultRow>(
          "app",
          "expense_cost_types",
          costType.slug,
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
      total: DEFAULT_EXPENSE_COST_TYPES.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
