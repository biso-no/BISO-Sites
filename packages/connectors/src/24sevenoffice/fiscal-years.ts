/**
 * 24SevenOffice fiscal years (SOAP `TransactionService.GetFiscalYears`).
 *
 * Only the SOAP service reports whether a year is locked; the REST
 * `/fiscalperiods` endpoint has no lock flag.
 */
import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

export interface FiscalYearLock {
  isLocked: boolean;
  /** `YYYY-MM-DD`. */
  startingDate: string;
}

interface RawFiscalYear {
  EndingDate?: Date | string | null;
  IsLocked?: boolean | string | null;
  StartingDate?: Date | string | null;
}

export interface GetFiscalYearsResult {
  GetFiscalYearsResult?: {
    FiscalYear?: RawFiscalYear | RawFiscalYear[] | null;
  } | null;
}

const DATE_LENGTH = "YYYY-MM-DD".length;

function toDateString(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, DATE_LENGTH);
  }
  if (typeof value === "string" && value.length >= DATE_LENGTH) {
    return value.slice(0, DATE_LENGTH);
  }
  return null;
}

export function parseFiscalYears(
  result: GetFiscalYearsResult | null | undefined
): FiscalYearLock[] {
  const raw = result?.GetFiscalYearsResult?.FiscalYear;
  let list: RawFiscalYear[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw) {
    list = [raw];
  }

  const years: FiscalYearLock[] = [];
  for (const year of list) {
    const startingDate = toDateString(year.StartingDate);
    if (startingDate === null) {
      continue;
    }
    years.push({
      isLocked: year.IsLocked === true || year.IsLocked === "true",
      startingDate,
    });
  }
  return years.sort((a, b) => a.startingDate.localeCompare(b.startingDate));
}

// Replace with REST /fiscalperiods once Finago returns a lock flag there.
export async function getFiscalYearLocks(): Promise<FiscalYearLock[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("transaction", session);
  const [result] = (await client.GetFiscalYearsAsync({})) as [
    GetFiscalYearsResult,
  ];
  return parseFiscalYears(result);
}
