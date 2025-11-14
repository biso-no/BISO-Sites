"use client";

import { useEffect, useState } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Button } from '@repo/ui/components/ui/button';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@repo/ui/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@repo/ui/components/ui/dropdown-menu';
import { Search, Filter, X, SlidersHorizontal, Check } from 'lucide-react';
import { FilterState } from '@/lib/hooks/use-departments-filter';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter,
  SheetClose
} from '@repo/ui/components/ui/sheet';

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
  types
}: DepartmentFiltersProps) {
  const [searchInputValue, setSearchInputValue] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Debounce the search input value
  const debouncedSearchValue = useDebounce(searchInputValue, 300);
  
  // Update local search input when filters change
  useEffect(() => {
    setSearchInputValue(filters.searchTerm || '');
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
    setSearchInputValue('');
    // Immediate clear without waiting for debounce
    setSearchTerm('');
  };
  
  // Count active filters (excluding search term)
  const activeFilterCount = [
    filters.active !== undefined && filters.active !== true,
    filters.campus_id !== undefined,
    filters.type !== undefined
  ].filter(Boolean).length;
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Bar */}
        <div className="relative grow">
          <Input
            value={searchInputValue}
            onChange={handleSearchInput}
            placeholder="Search departments..."
            className="pl-10 pr-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searchInputValue && (
            <button 
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        
        {/* Desktop Filters */}
        <div className="hidden md:flex gap-3">
          {/* Campus Filter */}
          <Select 
            value={filters.campus_id || "all"} 
            onValueChange={(value) => {
              updateFilter('campus_id', value === "all" ? undefined : value);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Campuses">
                {filters.campus_id 
                  ? campuses.find(c => c.id === filters.campus_id)?.name || "All Campuses"
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
              updateFilter('type', value === "all" ? undefined : value);
            }}
          >
            <SelectTrigger className="w-[180px]">
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
              <Button variant="outline" className="flex gap-2">
                <Filter size={16} />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="flex gap-2 cursor-pointer"
                onClick={() => updateFilter('active', undefined)}
              >
                {filters.active === undefined && <Check size={16} />}
                <span className={filters.active === undefined ? "font-medium" : ""}>All</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex gap-2 cursor-pointer"
                onClick={() => updateFilter('active', true)}
              >
                {filters.active === true && <Check size={16} />}
                <span className={filters.active === true ? "font-medium" : ""}>Active</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex gap-2 cursor-pointer"
                onClick={() => updateFilter('active', false)}
              >
                {filters.active === false && <Check size={16} />}
                <span className={filters.active === false ? "font-medium" : ""}>Inactive</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset Filters Button */}
          {(activeFilterCount > 0 || filters.searchTerm) && (
            <Button 
              variant="ghost" 
              onClick={resetFilters}
              className="gap-2"
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
                      <Label htmlFor="active-filter" className="cursor-pointer">Show only active departments</Label>
                      <Switch 
                        id="active-filter" 
                        checked={filters.active === true}
                        onCheckedChange={(checked) => updateFilter('active', checked ? true : undefined)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="inactive-filter" className="cursor-pointer">Show only inactive departments</Label>
                      <Switch 
                        id="inactive-filter" 
                        checked={filters.active === false}
                        onCheckedChange={(checked) => updateFilter('active', checked ? false : undefined)}
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
                      updateFilter('campus_id', value === "all" ? undefined : value);
                      setShowMobileFilters(false);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Campuses">
                        {filters.campus_id 
                          ? campuses.find(c => c.id === filters.campus_id)?.name || "All Campuses"
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
                      updateFilter('type', value === "all" ? undefined : value);
                      setShowMobileFilters(false);
                    }}
                  >
                    <SelectTrigger>
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
      
      {/* Active Filters Display */}
      {(activeFilterCount > 0 || filters.searchTerm) && (
        <div className="flex flex-wrap gap-2 animate-in fade-in">
          {filters.searchTerm && (
            <div className="bg-muted rounded-full px-3 py-1 text-sm flex items-center gap-2">
              <span>Search: {filters.searchTerm}</span>
              <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          )}
          
          {filters.campus_id && (
            <div className="bg-muted rounded-full px-3 py-1 text-sm flex items-center gap-2">
              <span>Campus: {campuses.find(c => c.id === filters.campus_id)?.name}</span>
              <button 
                onClick={() => updateFilter('campus_id', undefined)} 
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          {filters.type && (
            <div className="bg-muted rounded-full px-3 py-1 text-sm flex items-center gap-2">
              <span>Type: {filters.type}</span>
              <button 
                onClick={() => updateFilter('type', undefined)} 
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          {filters.active !== undefined && filters.active !== true && (
            <div className="bg-muted rounded-full px-3 py-1 text-sm flex items-center gap-2">
              <span>Status: {filters.active ? 'Active' : 'Inactive'}</span>
              <button 
                onClick={() => updateFilter('active', true)} 
                className="text-muted-foreground hover:text-foreground"
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