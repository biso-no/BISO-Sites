/**
 * Finago REST API — Departments
 *
 * Departments are stored as dimension elements with dimensionType=2.
 * Fetches all pages automatically using the Link header for pagination.
 */

import { finago } from "./client";
import type { components } from "./schema";

export const DEPARTMENT_DIMENSION_TYPE = 2;

export type DimensionElement = components["schemas"]["DimensionElement"];

/**
 * Fetches all department dimension elements from Finago.
 * Follows Link-header pagination automatically.
 */
export async function getDepartments(): Promise<DimensionElement[]> {
  const results: DimensionElement[] = [];
  let continuationToken: string | undefined;

  do {
    const { data, error, response } = await finago.GET(
      "/dimensions/{dimensionType}/elements",
      {
        params: {
          path: { dimensionType: DEPARTMENT_DIMENSION_TYPE },
          query: continuationToken ? { continuationToken } : undefined,
          // Authorization is required by the generated types; the client
          // middleware overwrites this with a live token before each request.
          header: { Authorization: "" },
        },
      }
    );
    console.log("Response:", response);

    if (error) {
      throw new Error(
        `[Finago] Failed to fetch departments: ${JSON.stringify(error)}`
      );
    }

    if (data) {
      results.push(...data);
    }

    continuationToken = parseNextContinuationToken(
      response.headers.get("Link")
    );
  } while (continuationToken);

  return results;
}

/**
 * Parses the `continuationToken` query parameter from a Link header's `next` relation.
 * Example header: `<https://...?continuationToken=abc>; rel="next"`
 */
const LINK_URL_REGEX = /<([^>]+)>/;
const LINK_REL_REGEX = /rel="([^"]+)"/;

function parseNextContinuationToken(
  linkHeader: string | null
): string | undefined {
  if (!linkHeader) {
    return undefined;
  }

  for (const part of linkHeader.split(",")) {
    const urlMatch = part.match(LINK_URL_REGEX);
    const relMatch = part.match(LINK_REL_REGEX);

    if (urlMatch && relMatch?.[1] === "next") {
      const url = new URL(urlMatch[1]);
      return url.searchParams.get("continuationToken") ?? undefined;
    }
  }

  return undefined;
}
