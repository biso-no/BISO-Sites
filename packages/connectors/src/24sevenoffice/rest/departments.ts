/**
 * Finago REST API — Departments
 *
 * Departments are stored as dimension elements with dimensionType=2.
 * Fetches all pages automatically using the Link header for pagination.
 */

import { finago } from "./client";
import { parseNextLink } from "./link-header";
import type { components } from "./schema";

export const DEPARTMENT_DIMENSION_TYPE = 2;
/** Campus dimension type; element values are the app's campus ids "1".."5". */
export const CAMPUS_DIMENSION_TYPE = 101;

export type DimensionElement = components["schemas"]["DimensionElement"];

/**
 * Fetches all (active) elements of one dimension type from Finago.
 * Follows Link-header pagination automatically.
 */
export async function listDimensionElements(
  dimensionType: number
): Promise<DimensionElement[]> {
  const results: DimensionElement[] = [];
  let continuationToken: string | undefined;

  do {
    const { data, error, response } = await finago.GET(
      "/dimensions/{dimensionType}/elements",
      {
        params: {
          path: { dimensionType },
          query: continuationToken ? { continuationToken } : undefined,
          // Authorization is required by the generated types; the client
          // middleware overwrites this with a live token before each request.
          header: { Authorization: "" },
        },
      }
    );

    if (error) {
      throw new Error(
        `[Finago] Failed to fetch dimension ${dimensionType} elements: ${JSON.stringify(error)}`
      );
    }

    if (!data) {
      throw new Error(
        `[Finago] Dimension ${dimensionType} elements came back without data`
      );
    }
    results.push(...data);

    const next = parseNextLink(response.headers.get("Link"));
    const nextToken = next?.searchParams.get("continuationToken") ?? undefined;
    if (next && (!nextToken || nextToken === continuationToken)) {
      throw new Error(
        `[Finago] Dimension ${dimensionType} paging gave no new continuation token`
      );
    }
    continuationToken = nextToken;
  } while (continuationToken);

  return results;
}

/** Fetches all department dimension elements from Finago. */
export function getDepartments(): Promise<DimensionElement[]> {
  return listDimensionElements(DEPARTMENT_DIMENSION_TYPE);
}
