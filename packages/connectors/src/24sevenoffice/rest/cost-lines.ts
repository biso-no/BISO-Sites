/**
 * Finago REST API — booked cost lines with their project and department.
 */

import { finago } from "./client";
import { DEPARTMENT_DIMENSION_TYPE } from "./departments";
import { parseNextLink } from "./link-header";
import { PROJECT_DIMENSION_TYPE } from "./projects";

export interface CostLine {
  accountNumber: number;
  amount: number;
  date: string;
  departmentId: string | null;
  projectId: string | null;
  /** The project dimension's name on the line, when it carries one. */
  projectName: string | null;
}

const PAGE_LIMIT = 1000;
/** The `page` number of the Link header's `next` relation, if any. */
function nextPage(
  linkHeader: string | null,
  current: number
): number | undefined {
  const next = parseNextLink(linkHeader);
  if (!next) {
    return undefined;
  }
  const page = Number(next.searchParams.get("page"));
  if (!Number.isInteger(page) || page <= current) {
    throw new Error(
      `[Finago] Cost line paging gave an unusable next page: ${next}`
    );
  }
  return page;
}

/**
 * Booked lines on the given accounts in a date range (`to` exclusive), with
 * the project (dimension 1) and department (dimension 2) they carry. One
 * query per account, following the Link `next` page until it runs out.
 */
export async function listCostLines(input: {
  accountNumbers: number[];
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<CostLine[]> {
  const lines: CostLine[] = [];
  let skipped = 0;

  for (const accountNumber of input.accountNumbers) {
    let page: number | undefined;
    do {
      input.signal?.throwIfAborted();
      const { data, error, response } = await finago.GET("/transactionlines", {
        params: {
          header: { Authorization: "" },
          query: {
            accountNumber,
            dateFrom: input.from,
            dateTo: input.to,
            includeDimensions: true,
            limit: PAGE_LIMIT,
            ...(page ? { page } : {}),
          },
        },
        signal: input.signal,
      });
      if (error || !data) {
        throw new Error(
          `[Finago] Could not read cost lines for account ${accountNumber}: ${JSON.stringify(error)}`
        );
      }
      for (const line of data) {
        if (!line.date || line.amount === undefined || line.amount === null) {
          skipped += 1;
          continue;
        }
        const dimensions = line.dimensions ?? [];
        const idOf = (type: number) => {
          const found = dimensions.find((d) => d.dimensionType === type);
          return found ? String(found.value) : null;
        };
        lines.push({
          accountNumber: line.account?.number ?? accountNumber,
          amount: line.amount,
          date: line.date,
          departmentId: idOf(DEPARTMENT_DIMENSION_TYPE),
          projectId: idOf(PROJECT_DIMENSION_TYPE),
          projectName:
            dimensions.find((d) => d.dimensionType === PROJECT_DIMENSION_TYPE)
              ?.name ?? null,
        });
      }
      page = nextPage(response.headers.get("Link"), page ?? 1);
    } while (page);
  }

  if (skipped > 0) {
    console.debug(
      `[Finago] Skipped ${skipped} cost lines without date or amount`
    );
  }
  return lines;
}
