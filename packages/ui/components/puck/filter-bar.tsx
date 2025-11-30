"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export type FilterItem = {
  label: string;
  value: string;
};

export type FilterBarProps = {
  categories?: FilterItem[];
  showSearch?: boolean;
  categoryParam?: string;
  searchParam?: string;
  title?: string;
};

function FilterBarContent({
  categories = [],
  showSearch = true,
  categoryParam = "category",
  searchParam = "q",
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get(categoryParam) || "All";
  const currentSearch = searchParams.get(searchParam) || "";

  const updateParams = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "All") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="sticky top-20 z-40 border-gray-100 border-b bg-white/95 shadow-sm backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Categories */}
          {categories.length > 0 && (
            <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-2 md:w-auto md:pb-0">
              <Button
                className={cn(
                  "whitespace-nowrap",
                  currentCategory === "All"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => updateParams(categoryParam, "All")}
                size="sm"
                variant={currentCategory === "All" ? "default" : "outline"}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  className={cn(
                    "whitespace-nowrap",
                    currentCategory === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                  key={cat.value}
                  onClick={() => updateParams(categoryParam, cat.value)}
                  size="sm"
                  variant={
                    currentCategory === cat.value ? "default" : "outline"
                  }
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          )}

          {/* Search */}
          {showSearch && (
            <div className="relative w-full md:max-w-xs">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-10 pr-9 pl-9"
                onChange={(e) => updateParams(searchParam, e.target.value)}
                placeholder="Search..."
                type="text"
                value={currentSearch}
              />
              {currentSearch && (
                <button
                  type="button"
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                  onClick={() => updateParams(searchParam, null)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FilterBar(props: FilterBarProps) {
  return (
    <Suspense
      fallback={<div className="h-20 w-full animate-pulse bg-gray-50" />}
    >
      <FilterBarContent {...props} />
    </Suspense>
  );
}
