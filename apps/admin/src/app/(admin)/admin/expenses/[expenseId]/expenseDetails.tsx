"use client";

import type { Expenses } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  AlertCircle,
  BanknoteIcon as Bank,
  Building2,
  CalendarIcon,
  CheckCircle2,
  Clock,
  FileText,
  Receipt,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

// Loading skeleton component for the expense details
const ExpenseDetailsSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      {[...new Array(4)].map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components are not used for rendering content
<div className="space-y-2" key={i}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-48" />
        </div>
      ))}
    </div>
    <Skeleton className="h-32 w-full" />
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    pending: {
      icon: Clock,
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    submitted: {
      icon: CheckCircle2,
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    default: {
      icon: AlertCircle,
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.default;
  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 font-medium text-sm capitalize",
        config.className
      )}
      variant="secondary"
    >
      <Icon className="h-4 w-4" />
      {status}
    </Badge>
  );
};

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
}) => (
  <motion.div
    animate={{ opacity: 1, y: 0 }}
    className="space-y-2"
    initial={{ opacity: 0, y: 20 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="font-medium text-sm">{label}</span>
    </div>
    <div className="font-medium text-lg">{value || "N/A"}</div>
  </motion.div>
);

export function AdminExpenseDetails({
  expenseData,
}: {
  expenseData: Expenses;
}) {
  return (
    <Suspense fallback={<ExpenseDetailsSkeleton />}>
      <motion.div
        animate={{ opacity: 1 }}
        className="container mx-auto max-w-4xl py-6"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-panel shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-bold text-2xl">
                  Expense Details
                </CardTitle>
                <div className="mt-1 text-muted-foreground text-sm">
                  Reference ID: {expenseData.$id}
                </div>
              </div>
              <StatusBadge status={expenseData.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {/* Basic Information */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 md:grid-cols-2"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <InfoItem
                icon={Building2}
                label="Campus"
                value={expenseData.campusRel.name}
              />
              <InfoItem
                icon={FileText}
                label="Department"
                value={expenseData.departmentRel.Name}
              />
              <InfoItem
                icon={Bank}
                label="Bank Account"
                value={expenseData.bank_account}
              />
              <InfoItem
                icon={Receipt}
                label="Invoice ID"
                value={`#${expenseData.invoice_id}`}
              />
            </motion.div>

            {/* Financial Details */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 rounded-xl bg-linear-to-br from-muted/30 to-muted/10 p-6 shadow-sm md:grid-cols-2"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm">
                  Total Amount
                </span>
                <div className="font-bold text-3xl text-primary">
                  {new Intl.NumberFormat("sv-SE", {
                    style: "currency",
                    currency: "SEK",
                  }).format(Number(expenseData.total))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm">
                  Prepayment Amount
                </span>
                <div className="font-bold text-3xl text-muted-foreground">
                  {new Intl.NumberFormat("sv-SE", {
                    style: "currency",
                    currency: "SEK",
                  }).format(Number(expenseData.prepayment_amount))}
                </div>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <span className="font-medium text-muted-foreground text-sm">
                Description
              </span>
              <div className="rounded-lg bg-muted/30 p-4 text-lg">
                {expenseData.description}
              </div>
            </motion.div>

            {/* User Information */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-muted/30 p-4"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, delay: 0.8 }}
            >
              <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                <User className="h-5 w-5" />
                <span className="font-medium">Submitted By</span>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-lg">
                  {expenseData.user?.name || "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">
                  {expenseData.user?.$id || "N/A"}
                </div>
              </div>
            </motion.div>

            {/* Submission Date */}
            <motion.div
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 1 }}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>
                Submitted on{" "}
                {new Date(expenseData.$createdAt).toLocaleDateString("sv-SE", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </Suspense>
  );
}
