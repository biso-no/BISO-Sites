/**
 * Finago REST API: monthly accounting periods.
 *
 * Read-only. The endpoint has no lock flag; year locks come from SOAP
 * (see `../fiscal-years`).
 */

import { finago } from "./client";
import type { components } from "./schema";

export interface FiscalPeriod {
  /** `YYYY-MM-DD`. */
  endingDate: string;
  /** `YYYY-MM-DD`. */
  startingDate: string;
}

/** Keeps the monthly `Period` rows that have both dates, oldest first. */
export function toFiscalPeriods(
  rows: components["schemas"]["AccountingPeriod"][]
): FiscalPeriod[] {
  const periods: FiscalPeriod[] = [];
  for (const row of rows) {
    if (row.type === "Period" && row.startingDate && row.endingDate) {
      periods.push({
        endingDate: row.endingDate,
        startingDate: row.startingDate,
      });
    }
  }
  return periods.sort((a, b) => a.startingDate.localeCompare(b.startingDate));
}

export async function listFiscalPeriods(): Promise<FiscalPeriod[]> {
  const { data, error } = await finago.GET("/fiscalperiods", {
    params: { query: { type: "Period" }, header: { Authorization: "" } },
  });

  if (error) {
    throw new Error(
      `[Finago] list fiscal periods failed: ${JSON.stringify(error)}`
    );
  }

  return toFiscalPeriods(data ?? []);
}
