"use client";

import { ExpenseStatus } from "@repo/api/types/appwrite";
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
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface ExpenseCardProps {
  expense: {
    $id: string;
    description: string | null;
    total: number;
    status: ExpenseStatus;
    campus: string;
    department: string;
    $createdAt: string;
    expenseAttachments?: any[];
  };
  index?: number;
}

const statusConfig = {
  [ExpenseStatus.DRAFT]: {
    label: "Draft",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: Clock,
  },
  [ExpenseStatus.PENDING]: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: Clock,
  },
  [ExpenseStatus.SUCCESS]: {
    label: "Approved",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  [ExpenseStatus.SUBMITTED]: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CheckCircle,
  },
  [ExpenseStatus.REJECTED]: {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="grow">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-gray-900">
                {expense.description || "Expense Reimbursement"}
              </h3>
              <Badge className={config.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#3DA9E0]" />
                <span>
                  {expense.campus} - {expense.department}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                <span>Submitted {submittedDate}</span>
              </div>
              {attachmentCount > 0 && (
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#3DA9E0]" />
                  <span>
                    {attachmentCount} attachment
                    {attachmentCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right ml-6">
            <div className="text-2xl font-bold text-[#3DA9E0] mb-1">
              {expense.total.toFixed(2)} NOK
            </div>
          </div>
        </div>

        <Link href={`/fs/${expense.$id}`}>
          <Button
            variant="outline"
            size="sm"
            className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </Link>
      </Card>
    </motion.div>
  );
}
