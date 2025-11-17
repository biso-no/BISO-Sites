import { Alert, AlertTitle, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";
import type { AlertElementProps } from "../../types";

export function AlertElement({
  id,
  title,
  description,
  variant = "default",
}: AlertElementProps) {
  return (
    <Alert id={id} variant={variant}>
      {variant === "destructive" ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Info className="h-4 w-4" />
      )}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

