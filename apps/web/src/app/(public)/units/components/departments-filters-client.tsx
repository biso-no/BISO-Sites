"use client";

import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
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
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useCampus } from "@/components/context/campus";

interface DepartmentsFiltersClientProps {
  availableCategories: UnitCategory[];
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  campusId: string | null;
  category: UnitCategory | null;
  search: string;
}

export function DepartmentsFiltersClient({
  availableCategories,
  onFilterChange,
}: DepartmentsFiltersClientProps) {
  // Category labels live in the shared `jobs.filters` bundle so the units page
  // and the jobs page name the same categories identically.
  const t = useTranslations("jobs");
  const { campuses, activeCampusId, selectCampus } = useCampus();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampus, setSelectedCampus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
      category:
        selectedCategory === "all" ? null : (selectedCategory as UnitCategory),
    });
  }, [searchQuery, selectedCampus, selectedCategory, onFilterChange]);

  const handleCampusChange = (value: string) => {
    setSelectedCampus(value);
    if (value !== "all") {
      selectCampus(value);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCampus("all");
    setSelectedCategory("all");
  };

  const hasActiveFilters =
    searchQuery || selectedCampus !== "all" || selectedCategory !== "all";

  return (
    <Card className="relative z-10 border-0 bg-card p-6 shadow-xl">
      <div
        className={
          availableCategories.length > 0
            ? "grid gap-4 md:grid-cols-3"
            : "grid gap-4 md:grid-cols-2"
        }
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-muted-foreground" />
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

        {/* Category filter — hidden while no unit has a usable category */}
        {availableCategories.length > 0 && (
          <Select onValueChange={setSelectedCategory} value={selectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t("filters.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  {t("filters.all")}
                </div>
              </SelectItem>
              {availableCategories.map((value) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    {t(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[value]}`)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
          {selectedCategory !== "all" && (
            <Badge className="border-primary/20 text-primary" variant="outline">
              {t(
                `filters.${UNIT_CATEGORY_MESSAGE_KEYS[selectedCategory as UnitCategory]}`
              )}
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
