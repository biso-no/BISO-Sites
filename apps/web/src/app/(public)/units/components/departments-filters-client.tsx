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

interface DepartmentsFiltersClientProps {
  availableTypes: string[];
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  campusId: string | null;
  type: string | null;
}

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
    <Card className="p-6 border-0 shadow-xl bg-card relative z-10">
      <div className="grid md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk etter enheter..."
            className="pl-10"
          />
        </div>

        {/* Campus Filter */}
        <Select value={selectedCampus} onValueChange={handleCampusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Velg campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Alle campuser
              </div>
            </SelectItem>
            {campuses.map((campus) => (
              <SelectItem key={campus.$id} value={campus.$id}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {campus.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger>
            <SelectValue placeholder="Velg type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                Alle typer
              </div>
            </SelectItem>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">Aktive filtre:</span>
          {searchQuery && (
            <Badge variant="outline" className="border-primary/20 text-primary">
              Søk: {searchQuery}
            </Badge>
          )}
          {selectedCampus !== "all" && (
            <Badge variant="outline" className="border-primary/20 text-primary">
              {campuses.find((c) => c.$id === selectedCampus)?.name}
            </Badge>
          )}
          {selectedType !== "all" && (
            <Badge variant="outline" className="border-primary/20 text-primary">
              {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="ml-auto"
          >
            Fjern alle
          </Button>
        </div>
      )}
    </Card>
  );
}
