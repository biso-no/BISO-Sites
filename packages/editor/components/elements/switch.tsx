import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";
import type { SwitchElementProps } from "../../types";

export function SwitchElement({
  id,
  label,
  checked = false,
}: SwitchElementProps) {
  return (
    <div id={id} className="flex items-center space-x-2">
      <Switch id={`switch-${id}`} defaultChecked={checked} />
      <Label htmlFor={`switch-${id}`} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

