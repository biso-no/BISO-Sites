import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import type { InputElementProps } from "../../types";

export function InputElement({
  id,
  label,
  placeholder = "",
  type = "text",
}: InputElementProps) {
  return (
    <div id={id} className="space-y-2">
      {label && <Label htmlFor={`input-${id}`}>{label}</Label>}
      <Input id={`input-${id}`} type={type} placeholder={placeholder} />
    </div>
  );
}

