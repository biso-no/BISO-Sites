import { Separator } from "@repo/ui/components/ui/separator";
import type { SeparatorElementProps } from "../../types";

export function SeparatorElement({
  id,
  orientation = "horizontal",
}: SeparatorElementProps) {
  return <Separator id={id} orientation={orientation} />;
}

