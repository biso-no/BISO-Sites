"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { useCampus } from "./context/campus";
import { Campus } from "@repo/api/types/appwrite";

type SelectCampusProps = {
  campuses: Campus[];
  placeholder?: string;
  className?: string;
};

export const SelectCampus = ({ placeholder = "Velg campus", className }: SelectCampusProps) => {
  const { campuses, activeCampusId, selectCampus, loading } = useCampus();

  const handleValueChange = async (value: string) => {
    await selectCampus(value);
  };

  // During SSR and initial hydration, don't set a value to avoid mismatch
  // Handle "all campuses" selection
  const selectValue = activeCampusId ?? "all";

  return (
    <Select value={selectValue} onValueChange={handleValueChange} disabled={loading}>
      <SelectTrigger className={className} aria-label="Velg campus">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Campuses</SelectItem>
        {campuses.map((campus) => (
          <SelectItem key={campus.$id} value={campus.$id}>
            {campus.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
