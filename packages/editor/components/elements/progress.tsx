import { Progress } from "@repo/ui/components/ui/progress";
import type { ProgressElementProps } from "../../types";

export function ProgressElement({
  id,
  value,
  max = 100,
  showLabel = true,
}: ProgressElementProps) {
  const percentage = (value / max) * 100;

  return (
    <div id={id} className="space-y-2">
      <Progress value={percentage} />
      {showLabel && (
        <div className="text-sm text-gray-600 text-right">
          {value} / {max}
        </div>
      )}
    </div>
  );
}

