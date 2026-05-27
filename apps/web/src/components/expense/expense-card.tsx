"use client";

import {
  type ExpenseAttachments,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Paperclip,
  Pencil,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface ExpenseCardProps {
  expense: {
    $id: string;
    description: string | null;
    total: number;
    status: ExpensesStatus;
    campus: string;
    department: string;
    $createdAt: string;
    expenseAttachments?: ExpenseAttachments[];
  };
  index?: number;
}

const statusConfig = {
  [ExpensesStatus.DRAFT]: {
    label: "Draft",
    color: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
  [ExpensesStatus.PENDING]: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: Clock,
  },
  [ExpensesStatus.SUCCESS]: {
    label: "Approved",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  [ExpensesStatus.SUBMITTED]: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CheckCircle,
  },
  [ExpensesStatus.REJECTED]: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
};

export function ExpenseCard({ expense, index = 0 }: ExpenseCardProps) {
  const config = statusConfig[expense.status];
  const StatusIcon = config.icon;
  const attachmentCount = expense.expenseAttachments?.length || 0;
  const submittedDate = new Date(expense.$createdAt).toLocaleDateString(
    "no-NO",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
  const isDraft = expense.status === ExpensesStatus.DRAFT;
  const actionHref = isDraft
    ? `/fs/new?draftId=${expense.$id}`
    : `/fs/${expense.$id}`;
  const actionLabel = isDraft ? "Continue Draft" : "View Details";
  const ActionIcon = isDraft ? Pencil : Eye;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="border-0 p-6 shadow-lg transition-shadow hover:shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="grow">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-foreground">
                {expense.description || "Expense Reimbursement"}
              </h3>
              <Badge className={config.color}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand" />
                <span>
                  {expense.campus} - {expense.department}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand" />
                <span>
                  {isDraft ? "Saved" : "Submitted"} {submittedDate}
                </span>
              </div>
              {attachmentCount > 0 && (
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-brand" />
                  <span>
                    {attachmentCount} attachment
                    {attachmentCount === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="ml-6 text-right">
            <div className="mb-1 font-bold text-2xl text-brand">
              {expense.total.toFixed(2)} NOK
            </div>
          </div>
        </div>

        <Link href={actionHref}>
          <Button
            className="border-brand-border text-brand hover:bg-brand-muted"
            size="sm"
            variant="outline"
          >
            <ActionIcon className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        </Link>
      </Card>
    </motion.div>
  );
}
