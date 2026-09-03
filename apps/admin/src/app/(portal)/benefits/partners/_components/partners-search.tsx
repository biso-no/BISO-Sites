"use client";

import { useTranslations } from "next-intl";
import { SearchToolbar } from "../../../_components/search-toolbar";
import { useUrlSearch } from "../../../_components/use-list-params";

export function PartnersSearch() {
  const tc = useTranslations("adminPortal.common");
  const [value, setValue] = useUrlSearch();

  return (
    <SearchToolbar
      defaultSearch={value}
      onSearch={setValue}
      placeholder={tc("search")}
    />
  );
}
