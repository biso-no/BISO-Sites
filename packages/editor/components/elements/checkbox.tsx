import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import type { CheckboxElementProps } from "../../types";

export function CheckboxElement({
  id,
  label,
  checked = false,
}: CheckboxElementProps) {
  return (
    <div id={id} className="flex items-center space-x-2">
      <Checkbox id={`checkbox-${id}`} defaultChecked={checked} />
      <Label htmlFor={`checkbox-${id}`} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

