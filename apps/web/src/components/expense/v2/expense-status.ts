import { ExpensesStatus } from "@repo/api/types/appwrite";
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import type { PillTone } from "@/components/ui/pill";

/**
 * One vocabulary for the seven reimbursement states.
 *
 * The label, colour and icon for each state were written out three times — in
 * `expense-card.tsx`, in `fs/[id]/page.tsx` and again inside `expense-v3` — each
 * with its own hand-picked palette classes (`bg-yellow-100 text-yellow-700`,
 * `bg-emerald-100 …`). Two of those copies had already drifted. This is the
 * copy the two in-scope surfaces share; `expense-v3` is out of scope for
 * RD-028 and keeps its own until it is opened.
 *
 * RD-032: the label moved to `expenses.status.*` in `packages/i18n`. What
 * stays here is what cannot live in a message bundle — the tone and the icon.
 */
export interface ExpenseStatusVisual {
  Icon: LucideIcon;
  /** Key under the `expenses.status` namespace. */
  key: string;
  tone: PillTone;
}

export const EXPENSE_STATUS: Record<ExpensesStatus, ExpenseStatusVisual> = {
  [ExpensesStatus.DRAFT]: { key: "draft", tone: "neutral", Icon: Clock },
  [ExpensesStatus.PENDING]: { key: "pending", tone: "warning", Icon: Clock },
  [ExpensesStatus.SUBMITTED]: {
    key: "submitted",
    tone: "accent",
    Icon: CheckCircle2,
  },
  [ExpensesStatus.APPROVED]: {
    key: "approved",
    tone: "success",
    Icon: CheckCircle2,
  },
  [ExpensesStatus.SUCCESS]: {
    key: "success",
    tone: "success",
    Icon: CheckCircle2,
  },
  [ExpensesStatus.REJECTED]: {
    key: "rejected",
    tone: "danger",
    Icon: XCircle,
  },
  [ExpensesStatus.FAILED]: {
    key: "failed",
    tone: "danger",
    Icon: CircleAlert,
  },
};

/** Never returns undefined: an unknown status renders as its own raw value. */
export function expenseStatusVisual(status: string): ExpenseStatusVisual {
  return (
    EXPENSE_STATUS[status as ExpensesStatus] ?? {
      key: "pending",
      tone: "neutral" as const,
      Icon: CircleAlert,
    }
  );
}
