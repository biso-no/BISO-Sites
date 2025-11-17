import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Label } from "@repo/ui/components/ui/label";
import type { SelectElementProps } from "../../types";

export function SelectElement({
  id,
  label,
  placeholder = "Select an option",
  options,
}: SelectElementProps) {
  if (options.length === 0) {
    return (
      <div id={id} className="text-center text-gray-500 p-6 border rounded-lg">
        Add options in the settings
      </div>
    );
  }

  return (
    <div id={id} className="space-y-2">
      {label && <Label htmlFor={`select-${id}`}>{label}</Label>}
      <Select>
        <SelectTrigger id={`select-${id}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

