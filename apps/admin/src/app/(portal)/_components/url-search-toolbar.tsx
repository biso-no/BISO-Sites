"use client";

import { useTranslations } from "next-intl";
import { SearchToolbar } from "./search-toolbar";
import { useUrlSearch } from "./use-list-params";

interface UrlSearchToolbarProps {
  placeholder?: string;
}

/**
 * Search box bound to the `?q=` URL param via `useUrlSearch`. Shared by every
 * list surface that just needs a debounced text search with no extra filter
 * chips — `benefits`, `benefits/partners`, and `departments` today.
 */
export function UrlSearchToolbar({ placeholder }: UrlSearchToolbarProps) {
  const tc = useTranslations("adminPortal.common");
  const [value, setValue] = useUrlSearch();

  return (
    <SearchToolbar
      defaultSearch={value}
      onSearch={setValue}
      placeholder={placeholder ?? tc("search")}
    />
  );
}
