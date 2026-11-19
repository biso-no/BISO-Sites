/**
 * Finago REST API — booked cost lines with their project and department.
 */

import { finago } from "./client";
import { DEPARTMENT_DIMENSION_TYPE } from "./departments";
import { PROJECT_DIMENSION_TYPE } from "./projects";

export interface CostLine {
  accountNumber: number;
  amount: number;
  date: string;
  departmentId: string | null;
  projectId: string | null;
}

const PAGE_LIMIT = 1000;
const LINK_URL_REGEX = /<([^>]+)>/;
const LINK_REL_REGEX = /rel="?next"?/;

/** The `page` query value of the Link header's `next` relation, if any. */
function nextPage(linkHeader: string | null): number | undefined {
  if (!linkHeader) {
    return undefined;
  }
  for (const part of linkHeader.split(",")) {
    if (!LINK_REL_REGEX.test(part)) {
      continue;
    }
    const url = part.match(LINK_URL_REGEX)?.[1];
    const page = url ? new URL(url).searchParams.get("page") : null;
    return page ? Number(page) : undefined;
  }
  return undefined;
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

  for (const accountNumber of input.accountNumbers) {
    let page: number | undefined;
    do {
      if (input.signal?.aborted) {
        return lines;
      }
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
        const dimensions = line.dimensions ?? [];
        const idOf = (type: number) => {
          const found = dimensions.find((d) => d.dimensionType === type);
          return found ? String(found.value) : null;
        };
        lines.push({
          accountNumber: line.account?.number ?? accountNumber,
          amount: line.amount ?? 0,
          date: line.date ?? "",
          departmentId: idOf(DEPARTMENT_DIMENSION_TYPE),
          projectId: idOf(PROJECT_DIMENSION_TYPE),
        });
      }
      page = nextPage(response.headers.get("Link"));
    } while (page);
  }

  return lines;
}
