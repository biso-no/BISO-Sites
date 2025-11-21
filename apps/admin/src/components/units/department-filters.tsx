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

interface DepartmentFiltersProps {
  filters: FilterState;
  isPending: boolean;
  updateFilter: (key: keyof FilterState, value: any) => void;
  resetFilters: () => void;
  setSearchTerm: (term: string) => void;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
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
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Premium Glass Search Bar */}
        <div className="relative grow group">
          <Input
            value={searchInputValue}
            onChange={handleSearchInput}
            placeholder="Search departments..."
            className="pl-11 pr-10 h-11 bg-card/60 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
          {searchInputValue && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted/80 backdrop-blur-sm flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-all duration-300 hover:scale-110"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Desktop Filters - Premium Style */}
        <div className="hidden md:flex gap-3">
          {/* Campus Filter */}
          <Select
            value={filters.campus_id || "all"}
            onValueChange={(value) => {
              updateFilter("campus_id", value === "all" ? undefined : value);
            }}
          >
            <SelectTrigger className="w-[180px] h-11 bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300">
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

          {/* Type Filter */}
          <Select
            value={filters.type || "all"}
            onValueChange={(value) => {
              updateFilter("type", value === "all" ? undefined : value);
            }}
          >
            <SelectTrigger className="w-[180px] h-11 bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300">
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

          {/* Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex gap-2 h-11 bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/50 hover:bg-card/80 transition-all duration-300"
              >
                <Filter size={16} />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-card/95 backdrop-blur-md border-border/50"
            >
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex gap-2 cursor-pointer"
                onClick={() => updateFilter("active", undefined)}
              >
                {filters.active === undefined && (
                  <Check size={16} className="text-primary" />
                )}
                <span
                  className={filters.active === undefined ? "font-medium" : ""}
                >
                  All
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex gap-2 cursor-pointer"
                onClick={() => updateFilter("active", true)}
              >
                {filters.active === true && (
                  <Check size={16} className="text-primary" />
                )}
                <span className={filters.active === true ? "font-medium" : ""}>
                  Active
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex gap-2 cursor-pointer"
                onClick={() => updateFilter("active", false)}
              >
                {filters.active === false && (
                  <Check size={16} className="text-primary" />
                )}
                <span className={filters.active === false ? "font-medium" : ""}>
                  Inactive
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset Filters Button */}
          {(activeFilterCount > 0 || filters.searchTerm) && (
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="gap-2 h-11 hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
            >
              <X size={16} />
              Reset Filters
            </Button>
          )}
        </div>

        {/* Mobile Filters Button */}
        <div className="md:hidden flex justify-end">
          <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 relative">
                <SlidersHorizontal size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>

              <div className="py-6 space-y-6">
                {/* Mobile Status Filter */}
                <div className="space-y-3">
                  <Label>Status</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="active-filter" className="cursor-pointer">
                        Show only active departments
                      </Label>
                      <Switch
                        id="active-filter"
                        checked={filters.active === true}
                        onCheckedChange={(checked) =>
                          updateFilter("active", checked ? true : undefined)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="inactive-filter"
                        className="cursor-pointer"
                      >
                        Show only inactive departments
                      </Label>
                      <Switch
                        id="inactive-filter"
                        checked={filters.active === false}
                        onCheckedChange={(checked) =>
                          updateFilter("active", checked ? false : undefined)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Campus Filter */}
                <div className="space-y-3">
                  <Label>Campus</Label>
                  <Select
                    value={filters.campus_id || "all"}
                    onValueChange={(value) => {
                      updateFilter(
                        "campus_id",
                        value === "all" ? undefined : value
                      );
                      setShowMobileFilters(false);
                    }}
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

                {/* Mobile Type Filter */}
                <div className="space-y-3">
                  <Label>Department Type</Label>
                  <Select
                    value={filters.type || "all"}
                    onValueChange={(value) => {
                      updateFilter("type", value === "all" ? undefined : value);
                      setShowMobileFilters(false);
                    }}
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

              <SheetFooter className="sm:justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="w-full sm:w-auto"
                >
                  Reset All
                </Button>
                <SheetClose asChild>
                  <Button className="w-full sm:w-auto">Apply Filters</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Active Filters Display - Premium Pills */}
      {(activeFilterCount > 0 || filters.searchTerm) && (
        <div className="flex flex-wrap gap-2 animate-in fade-in-50 slide-in-from-top-2">
          {filters.searchTerm && (
            <div className="bg-linear-to-r from-primary/10 to-accent/10 backdrop-blur-sm border border-primary/20 rounded-full px-4 py-2 text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-300 group">
              <span className="font-medium">
                Search:{" "}
                <span className="text-primary">{filters.searchTerm}</span>
              </span>
              <button
                onClick={clearSearch}
                className="text-muted-foreground hover:text-destructive transition-colors duration-300 hover:scale-110"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {filters.campus_id && (
            <div className="bg-linear-to-r from-blue-500/10 to-blue-600/10 backdrop-blur-sm border border-blue-500/20 rounded-full px-4 py-2 text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-300 group">
              <span className="font-medium">
                Campus:{" "}
                <span className="text-blue-600">
                  {campuses.find((c) => c.id === filters.campus_id)?.name}
                </span>
              </span>
              <button
                onClick={() => updateFilter("campus_id", undefined)}
                className="text-muted-foreground hover:text-destructive transition-colors duration-300 hover:scale-110"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {filters.type && (
            <div className="bg-linear-to-r from-purple-500/10 to-purple-600/10 backdrop-blur-sm border border-purple-500/20 rounded-full px-4 py-2 text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-300 group">
              <span className="font-medium">
                Type: <span className="text-purple-600">{filters.type}</span>
              </span>
              <button
                onClick={() => updateFilter("type", undefined)}
                className="text-muted-foreground hover:text-destructive transition-colors duration-300 hover:scale-110"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {filters.active !== undefined && filters.active !== true && (
            <div className="bg-linear-to-r from-amber-500/10 to-amber-600/10 backdrop-blur-sm border border-amber-500/20 rounded-full px-4 py-2 text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-300 group">
              <span className="font-medium">
                Status:{" "}
                <span className="text-amber-600">
                  {filters.active ? "Active" : "Inactive"}
                </span>
              </span>
              <button
                onClick={() => updateFilter("active", true)}
                className="text-muted-foreground hover:text-destructive transition-colors duration-300 hover:scale-110"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
