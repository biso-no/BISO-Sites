"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Filter, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type NewsFiltersProps = {
  categories: string[];
  selectedCategory: string;
  searchQuery: string;
};

export function NewsFilters({
  categories,
  selectedCategory,
  searchQuery,
}: NewsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const updateFilters = (category?: string, search?: string) => {
    const params = new URLSearchParams(searchParams);

    if (category !== undefined) {
      if (category === "All") {
        params.delete("category");
      } else {
        params.set("category", category);
      }
    }

    if (search !== undefined) {
      if (search === "") {
        params.delete("search");
      } else {
        params.set("search", search);
      }
    }

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters(undefined, localSearch);
  };

  const handleCategoryChange = (category: string) => {
    updateFilters(category, undefined);
  };

  const clearSearch = () => {
    setLocalSearch("");
    updateFilters(undefined, "");
  };

  return (
    <div className="sticky top-20 z-40 border-gray-100 border-b bg-white/95 shadow-lg backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Search */}
          <form
            className="relative w-full md:w-96"
            onSubmit={handleSearchSubmit}
          >
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-5 w-5 text-gray-400" />
            <Input
              className="w-full border-[#3DA9E0]/20 pr-10 pl-10 focus:border-[#3DA9E0]"
              disabled={isPending}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search articles..."
              type="text"
              value={localSearch}
            />
            {localSearch && (
              <button
                className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 transition-colors hover:text-gray-600"
                disabled={isPending}
                onClick={clearSearch}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Filter className="h-5 w-5 text-[#001731]" />
            {categories.map((category) => (
              <Button
                className={
                  selectedCategory === category
                    ? "border-0 bg-[#3DA9E0] text-white hover:bg-[#3DA9E0]/90"
                    : "border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                }
                disabled={isPending}
                key={category}
                onClick={() => handleCategoryChange(category)}
                size="sm"
                variant={selectedCategory === category ? "default" : "outline"}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {isPending && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#3DA9E0] border-t-transparent" />
              <span className="text-sm">Loading articles...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
