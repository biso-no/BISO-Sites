import { Textarea } from "@repo/ui/components/ui/textarea";
import { Label } from "@repo/ui/components/ui/label";
import type { TextareaElementProps } from "../../types";

export function TextareaElement({
  id,
  label,
  placeholder = "",
  rows = 4,
}: TextareaElementProps) {
  return (
    <div id={id} className="space-y-2">
      {label && <Label htmlFor={`textarea-${id}`}>{label}</Label>}
      <Textarea id={`textarea-${id}`} placeholder={placeholder} rows={rows} />
    </div>
  );
}

