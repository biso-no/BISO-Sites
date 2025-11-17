import { Card as UICard } from "@repo/ui/components/ui/card";
import type { CardElementProps } from "../../types";

export function CardElement({ id, variant = "default", content }: CardElementProps) {
  return (
    <UICard id={id} variant={variant} className="p-6">
      {content?.({}) || <div className="text-center text-gray-500">Add content here</div>}
    </UICard>
  );
}

