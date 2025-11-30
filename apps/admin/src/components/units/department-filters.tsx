"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Switch } from "@repo/ui/components/ui/switch";
import { Check, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FilterState } from "@/lib/hooks/use-departments-filter";

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

type DepartmentFiltersProps = {
  filters: FilterState;
  isPending: boolean;
  updateFilter: (key: keyof FilterState, value: any) => void;
  resetFilters: () => void;
  setSearchTerm: (term: string) => void;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
};

type FilterControlsProps = {
  filters: FilterState;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
  updateFilter: (key: keyof FilterState, value: unknown) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  isPending: boolean;
};

type MobileFiltersProps = FilterControlsProps & {
  showMobileFilters: boolean;
  setShowMobileFilters: (value: boolean) => void;
};

type ActiveFiltersProps = {
  filters: FilterState;
  campuses: Array<{ id: string; name: string }>;
  clearSearch: () => void;
  updateFilter: (key: keyof FilterState, value: unknown) => void;
};

function DesktopFilters({
  filters,
  campuses,
  types,
  updateFilter,
  resetFilters,
  activeFilterCount,
  isPending,
}: FilterControlsProps) {
  return (
    <div className="hidden gap-3 md:flex">
      <Select
        disabled={isPending}
        onValueChange={(value) => {
          updateFilter("campus_id", value === "all" ? undefined : value);
        }}
        value={filters.campus_id || "all"}
      >
        <SelectTrigger className="h-11 w-[180px] border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/50">
          <SelectValue placeholder="All Campuses">
            {filters.campus_id
              ? campuses.find((c) => c.id === filters.campus_id)?.name ||
                "All Campuses"
              : "All Campuses"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Campuses</SelectItem>
          {campuses.map((campus) => (
            <SelectItem key={campus.id} value={campus.id}>
              {campus.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        disabled={isPending}
        onValueChange={(value) => {
          updateFilter("type", value === "all" ? undefined : value);
        }}
        value={filters.type || "all"}
      >
        <SelectTrigger className="h-11 w-[180px] border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/50">
          <SelectValue placeholder="All Types">
            {filters.type
              ? filters.type.charAt(0).toUpperCase() + filters.type.slice(1)
              : "All Types"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {types.map((type) => (
            <SelectItem key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="flex h-11 gap-2 border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
            disabled={isPending}
            variant="outline"
          >
            <Filter size={16} />
            Status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-border/50 bg-card/95 backdrop-blur-md"
        >
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex cursor-pointer gap-2"
            onClick={() => updateFilter("active", undefined)}
          >
            {filters.active === undefined && (
              <Check className="text-primary" size={16} />
            )}
            <span className={filters.active === undefined ? "font-medium" : ""}>
              All
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex cursor-pointer gap-2"
            onClick={() => updateFilter("active", true)}
          >
            {filters.active === true && (
              <Check className="text-primary" size={16} />
            )}
            <span className={filters.active === true ? "font-medium" : ""}>
              Active
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex cursor-pointer gap-2"
            onClick={() => updateFilter("active", false)}
          >
            {filters.active === false && (
              <Check className="text-primary" size={16} />
            )}
            <span className={filters.active === false ? "font-medium" : ""}>
              Inactive
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {(activeFilterCount > 0 || filters.searchTerm) && (
        <Button
          className="h-11 gap-2 transition-all duration-300 hover:bg-destructive/10 hover:text-destructive"
          disabled={isPending}
          onClick={resetFilters}
          variant="ghost"
        >
          <X size={16} />
          Reset Filters
        </Button>
      )}
    </div>
  );
}

function MobileFilters({
  filters,
  campuses,
  types,
  updateFilter,
  resetFilters,
  activeFilterCount,
  showMobileFilters,
  setShowMobileFilters,
  isPending,
}: MobileFiltersProps) {
  return (
    <div className="flex justify-end md:hidden">
      <Sheet onOpenChange={setShowMobileFilters} open={showMobileFilters}>
        <SheetTrigger asChild>
          <Button
            className="relative gap-2"
            disabled={isPending}
            variant="outline"
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-6">
            <div className="space-y-3">
              <Label>Status</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer" htmlFor="active-filter">
                    Show only active departments
                  </Label>
                  <Switch
                    checked={filters.active === true}
                    disabled={isPending}
                    id="active-filter"
                    onCheckedChange={(checked) =>
                      updateFilter("active", checked ? true : undefined)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer" htmlFor="inactive-filter">
                    Show only inactive departments
                  </Label>
                  <Switch
                    checked={filters.active === false}
                    disabled={isPending}
                    id="inactive-filter"
                    onCheckedChange={(checked) =>
                      updateFilter("active", checked ? false : undefined)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Campus</Label>
              <Select
                disabled={isPending}
                onValueChange={(value) => {
                  updateFilter(
                    "campus_id",
                    value === "all" ? undefined : value
                  );
                  setShowMobileFilters(false);
                }}
                value={filters.campus_id || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Campuses">
                    {filters.campus_id
                      ? campuses.find((c) => c.id === filters.campus_id)
                          ?.name || "All Campuses"
                      : "All Campuses"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campuses</SelectItem>
                  {campuses.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                      {campus.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Department Type</Label>
              <Select
                disabled={isPending}
                onValueChange={(value) => {
                  updateFilter("type", value === "all" ? undefined : value);
                  setShowMobileFilters(false);
                }}
                value={filters.type || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types">
                    {filters.type
                      ? filters.type.charAt(0).toUpperCase() +
                        filters.type.slice(1)
                      : "All Types"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="gap-4 sm:justify-between">
            <Button
              className="w-full sm:w-auto"
              disabled={isPending}
              onClick={resetFilters}
              variant="outline"
            >
              Reset All
            </Button>
            <SheetClose asChild>
              <Button className="w-full sm:w-auto" disabled={isPending}>
                Apply Filters
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ActiveFilters({
  filters,
  campuses,
  clearSearch,
  updateFilter,
}: ActiveFiltersProps) {
  const { campus_id: campusId } = filters;
  return (
    <>
      {filters.searchTerm && (
        <div className="group flex items-center gap-2 rounded-full border border-primary/20 bg-linear-to-r from-primary/10 to-accent/10 px-4 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
          <span className="font-medium">
            Search: <span className="text-primary">{filters.searchTerm}</span>
          </span>
          <button
            className="text-muted-foreground transition-colors duration-300 hover:scale-110 hover:text-destructive"
            onClick={clearSearch}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {campusId && (
        <div className="group flex items-center gap-2 rounded-full border border-blue-500/20 bg-linear-to-r from-blue-500/10 to-blue-600/10 px-4 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
          <span className="font-medium">
            Campus:{" "}
            <span className="text-blue-600">
              {campuses.find((c) => c.id === campusId)?.name}
            </span>
          </span>
          <button
            className="text-muted-foreground transition-colors duration-300 hover:scale-110 hover:text-destructive"
            onClick={() => updateFilter("campus_id", undefined)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {filters.type && (
        <div className="group flex items-center gap-2 rounded-full border border-purple-500/20 bg-linear-to-r from-purple-500/10 to-purple-600/10 px-4 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
          <span className="font-medium">
            Type: <span className="text-purple-600">{filters.type}</span>
          </span>
          <button
            className="text-muted-foreground transition-colors duration-300 hover:scale-110 hover:text-destructive"
            onClick={() => updateFilter("type", undefined)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {filters.active !== undefined && filters.active !== true && (
        <div className="group flex items-center gap-2 rounded-full border border-amber-500/20 bg-linear-to-r from-amber-500/10 to-amber-600/10 px-4 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
          <span className="font-medium">
            Status:{" "}
            <span className="text-amber-600">
              {filters.active ? "Active" : "Inactive"}
            </span>
          </span>
          <button
            className="text-muted-foreground transition-colors duration-300 hover:scale-110 hover:text-destructive"
            onClick={() => updateFilter("active", true)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}

export function DepartmentFilters({
  filters,
  isPending,
  updateFilter,
  resetFilters,
  setSearchTerm,
  campuses,
  types,
}: DepartmentFiltersProps) {
  const [searchInputValue, setSearchInputValue] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Debounce the search input value
  const debouncedSearchValue = useDebounce(searchInputValue, 300);

  // Update local search input when filters change
  useEffect(() => {
    setSearchInputValue(filters.searchTerm || "");
  }, [filters.searchTerm]);

  // Effect to update parent component with debounced value
  useEffect(() => {
    // Only update if the value actually changed
    if (debouncedSearchValue !== filters.searchTerm) {
      setSearchTerm(debouncedSearchValue);
    }
  }, [debouncedSearchValue, setSearchTerm, filters.searchTerm]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  };

  const clearSearch = () => {
    setSearchInputValue("");
    // Immediate clear without waiting for debounce
    setSearchTerm("");
  };

  // Count active filters (excluding search term)
  const activeFilterCount = [
    filters.active !== undefined && filters.active !== true,
    filters.campus_id !== undefined,
    filters.type !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Premium Glass Search Bar */}
        <div className="group relative grow">
          <Input
            className="h-11 border-border/50 bg-card/60 pr-10 pl-11 backdrop-blur-sm transition-all duration-300 focus:border-primary/50 focus:shadow-lg focus:shadow-primary/10"
            disabled={isPending}
            onChange={handleSearchInput}
            placeholder="Search departments..."
            value={searchInputValue}
          />
          <Search className="-translate-y-1/2 absolute top-1/2 left-3.5 h-4 w-4 text-muted-foreground transition-colors duration-300 group-focus-within:text-primary" />
          {searchInputValue && (
            <button
              className="-translate-y-1/2 absolute top-1/2 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-destructive/20 hover:text-destructive"
              disabled={isPending}
              onClick={clearSearch}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <DesktopFilters
          activeFilterCount={activeFilterCount}
          campuses={campuses}
          filters={filters}
          isPending={isPending}
          resetFilters={resetFilters}
          types={types}
          updateFilter={updateFilter}
        />

        <MobileFilters
          activeFilterCount={activeFilterCount}
          campuses={campuses}
          filters={filters}
          isPending={isPending}
          resetFilters={resetFilters}
          setShowMobileFilters={setShowMobileFilters}
          showMobileFilters={showMobileFilters}
          types={types}
          updateFilter={updateFilter}
        />
      </div>

      {/* Active Filters Display - Premium Pills */}
      {(activeFilterCount > 0 || filters.searchTerm) && (
        <div className="fade-in-50 slide-in-from-top-2 flex animate-in flex-wrap gap-2">
          <ActiveFilters
            campuses={campuses}
            clearSearch={clearSearch}
            filters={filters}
            updateFilter={updateFilter}
          />
        </div>
      )}
    </div>
  );
}
