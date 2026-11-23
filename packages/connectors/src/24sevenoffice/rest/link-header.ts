/**
 * Finago REST API — Link header paging.
 */

const LINK_URL_REGEX = /<([^>]+)>/;
const LINK_REL_REGEX = /rel="?([^";,\s]+)"?/;

/** The URL of the Link header's `next` relation, or null when there is none. */
export function parseNextLink(linkHeader: string | null): URL | null {
  if (!linkHeader) {
    return null;
  }
  for (const part of linkHeader.split(",")) {
    const url = part.match(LINK_URL_REGEX)?.[1];
    if (url && part.match(LINK_REL_REGEX)?.[1] === "next") {
      return new URL(url);
    }
  }
  return null;
}
