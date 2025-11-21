"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Filter, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCampus } from "@/components/context/campus";

type DepartmentsFiltersClientProps = {
  availableTypes: string[];
  onFilterChange: (filters: FilterState) => void;
};

export type FilterState = {
  search: string;
  campusId: string | null;
  type: string | null;
};

export function DepartmentsFiltersClient({
  availableTypes,
  onFilterChange,
}: DepartmentsFiltersClientProps) {
  const { campuses, activeCampusId, selectCampus } = useCampus();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampus, setSelectedCampus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Initialize campus filter from context
  useEffect(() => {
    if (activeCampusId) {
      setSelectedCampus(activeCampusId);
    }
  }, [activeCampusId]);

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({
      search: searchQuery,
      campusId: selectedCampus === "all" ? null : selectedCampus,
      type: selectedType === "all" ? null : selectedType,
    });
  }, [searchQuery, selectedCampus, selectedType, onFilterChange]);

  const handleCampusChange = (value: string) => {
    setSelectedCampus(value);
    if (value !== "all") {
      selectCampus(value);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCampus("all");
    setSelectedType("all");
  };

  const hasActiveFilters =
    searchQuery || selectedCampus !== "all" || selectedType !== "all";

  return (
    <Card className="relative z-10 border-0 bg-card p-6 shadow-xl">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Search */}
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-5 w-5 transform text-muted-foreground" />
          <Input
            className="pl-10"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk etter enheter..."
            value={searchQuery}
          />
        </div>

        {/* Campus Filter */}
        <Select onValueChange={handleCampusChange} value={selectedCampus}>
          <SelectTrigger>
            <SelectValue placeholder="Velg campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Alle campuser
              </div>
            </SelectItem>
            {campuses.map((campus) => (
              <SelectItem key={campus.$id} value={campus.$id}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {campus.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select onValueChange={setSelectedType} value={selectedType}>
          <SelectTrigger>
            <SelectValue placeholder="Velg type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Alle typer
              </div>
            </SelectItem>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 flex items-center gap-2 border-border border-t pt-4">
          <span className="text-muted-foreground text-sm">Aktive filtre:</span>
          {searchQuery && (
            <Badge className="border-primary/20 text-primary" variant="outline">
              Søk: {searchQuery}
            </Badge>
          )}
          {selectedCampus !== "all" && (
            <Badge className="border-primary/20 text-primary" variant="outline">
              {campuses.find((c) => c.$id === selectedCampus)?.name}
            </Badge>
          )}
          {selectedType !== "all" && (
            <Badge className="border-primary/20 text-primary" variant="outline">
              {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
            </Badge>
          )}
          <Button
            className="ml-auto"
            onClick={clearAllFilters}
            size="sm"
            variant="ghost"
          >
            Fjern alle
          </Button>
        </div>
      )}
    </Card>
  );
}
