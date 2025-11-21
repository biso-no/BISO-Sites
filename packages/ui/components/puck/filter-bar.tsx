"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

export interface FilterItem {
  label: string;
  value: string;
}

export interface FilterBarProps {
  categories?: FilterItem[];
  showSearch?: boolean;
  categoryParam?: string;
  searchParam?: string;
  title?: string;
}

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
    <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
              <Button
                variant={currentCategory === "All" ? "default" : "outline"}
                size="sm"
                onClick={() => updateParams(categoryParam, "All")}
                className={cn(
                  "whitespace-nowrap",
                  currentCategory === "All" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.value}
                  variant={currentCategory === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateParams(categoryParam, cat.value)}
                  className={cn(
                    "whitespace-nowrap",
                    currentCategory === cat.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          )}

          {/* Search */}
          {showSearch && (
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={currentSearch}
                onChange={(e) => updateParams(searchParam, e.target.value)}
                className="pl-9 pr-9 h-10"
              />
              {currentSearch && (
                <button
                  onClick={() => updateParams(searchParam, null)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
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
    <Suspense fallback={<div className="h-20 w-full bg-gray-50 animate-pulse" />}>
      <FilterBarContent {...props} />
    </Suspense>
  );
}
