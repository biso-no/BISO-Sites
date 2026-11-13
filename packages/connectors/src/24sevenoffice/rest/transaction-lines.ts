/**
 * Finago REST API — reading posted transaction lines back.
 */

import { finago } from "./client";

export interface PostedTransactionLine {
  accountNumber: number | null;
  amount: number;
  comment: string | null;
  /** `YYYY-MM-DD` the line was posted on. */
  date: string;
  dimensions: { dimensionType: number; name: string; value: string }[];
  /** The accounting period the line landed in (its period's end date). */
  periodDate: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_LENGTH = "YYYY-MM-DD".length;

function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS)
    .toISOString()
    .slice(0, DATE_LENGTH);
}

/**
 * The lines of one transaction. Finago requires a date range, so the caller
 * passes the first and last date the lines can have (both inclusive).
 */
export async function listTransactionLines(params: {
  firstDate: string;
  lastDate: string;
  transactionId: string;
}): Promise<PostedTransactionLine[]> {
  const { data, error } = await finago.GET("/transactionlines", {
    params: {
      header: { Authorization: "" },
      query: {
        dateFrom: params.firstDate,
        dateTo: dayAfter(params.lastDate),
        includeDimensions: true,
        transactionId: params.transactionId,
      },
    },
  });
  if (error || !data) {
    throw new Error(
      `[Finago] Could not read transaction lines: ${JSON.stringify(error)}`
    );
  }
  return data.map((line) => ({
    accountNumber: line.account?.number ?? null,
    amount: line.amount ?? 0,
    comment: line.comment ?? null,
    date: line.date ?? "",
    dimensions: (line.dimensions ?? []).map((dimension) => ({
      dimensionType: dimension.dimensionType,
      name: dimension.name,
      value: String(dimension.value),
    })),
    periodDate: line.periodDate ?? null,
  }));
}
