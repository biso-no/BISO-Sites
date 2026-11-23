import {
  type QuickSearchResponse,
  SEARCH_GROUPS,
  type SearchGroup,
  type SearchHit,
} from "@repo/shared/search/response";

export const QUICK_SEARCH_LISTBOX_ID = "quick-search-listbox";
/** The option id of the "Show all N results" row. */
export const SHOW_ALL_OPTION_ID = "show-all";

/**
 * The DOM id of an option, for `aria-activedescendant`. Scoped by the listbox
 * so two quick searches on one page cannot share an id.
 */
export function optionDomId(listboxId: string, id: string): string {
  return `${listboxId}-opt-${id}`;
}

export interface QuickOption {
  href: string;
  id: string;
}

export interface QuickSection {
  count: number;
  group: SearchGroup;
  hits: SearchHit[];
}

/** `/search?q=…` for the trimmed query. */
export function searchHref(query: string): string {
  return `/search?${new URLSearchParams({ q: query.trim() }).toString()}`;
}

/** The groups that have rows to show, in SEARCH_GROUPS order. */
export function sectionsOf(response: QuickSearchResponse): QuickSection[] {
  const bestId = response.best?.id;
  return SEARCH_GROUPS.flatMap((group) => {
    const hits = response.groups[group].filter((hit) => hit.id !== bestId);
    return hits.length > 0
      ? [{ count: response.counts[group], group, hits }]
      : [];
  });
}

/**
 * Every selectable row in display order: the best match, the groups in
 * SEARCH_GROUPS order, then "Show all". Arrow keys walk this list; nothing is
 * selectable when nothing matched.
 */
export function quickOptions(
  response: QuickSearchResponse,
  query: string
): QuickOption[] {
  if (response.total === 0) {
    return [];
  }
  const options: QuickOption[] = [];
  if (response.best) {
    options.push({ href: response.best.url, id: response.best.id });
  }
  for (const section of sectionsOf(response)) {
    for (const hit of section.hits) {
      options.push({ href: hit.url, id: hit.id });
    }
  }
  options.push({ href: searchHref(query), id: SHOW_ALL_OPTION_ID });
  return options;
}
