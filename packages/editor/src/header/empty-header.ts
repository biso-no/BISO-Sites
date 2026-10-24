import type { PageHeader } from "../editor/types";

/**
 * A new page header: plain, with no media, links or copy beyond its title.
 * Pure, so the normalizer and the admin's page templates can use it.
 */
export function emptyHeader(title = ""): PageHeader {
  return {
    buttons: [],
    crumbs: [],
    eyebrow: "",
    lede: "",
    title,
    variant: "plain",
  };
}
