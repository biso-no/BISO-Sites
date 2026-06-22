import { Card } from "@repo/ui/components/ui/card";
import { Ban } from "lucide-react";

/**
 * Shown when the `expenses_module` feature flag is off — the reimbursements
 * feature has been paused platform-wide by an administrator.
 */
export function ExpensesUnavailable() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <Card className="border-0 p-12 text-center shadow-lg">
        <Ban className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 font-semibold text-foreground text-xl">
          Reimbursements are temporarily unavailable
        </h3>
        <p className="text-muted-foreground">
          This feature has been paused by an administrator. Please check back
          later.
        </p>
      </Card>
    </div>
  );
}
