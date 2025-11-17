import { Badge } from "@repo/ui/components/ui/badge";
import type { BadgeElementProps } from "../../types";

export function BadgeElement({ id, text, variant = "default" }: BadgeElementProps) {
  return (
    <div id={id}>
      <Badge variant={variant}>{text}</Badge>
    </div>
  );
}

