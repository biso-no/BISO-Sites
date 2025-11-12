"use client";

import React, { Suspense } from 'react';
import { Expense } from "@/lib/types/expense";
import { motion } from 'motion/react';
import { 
  CalendarIcon, Receipt, Building2, 
  BanknoteIcon as Bank, FileText, User,
  CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading skeleton component for the expense details
const ExpenseDetailsSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
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
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    submitted: {
      icon: CheckCircle2,
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    default: {
      icon: AlertCircle,
      className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.default;
  const Icon = config.icon;

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "px-3 py-1 capitalize flex items-center gap-1.5 text-sm font-medium",
        config.className
      )}
    >
      <Icon className="h-4 w-4" />
      {status}
    </Badge>
  );
};

const InfoItem = ({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number | null;
}) => (
  <motion.div 
    className="space-y-2"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="font-medium text-lg">{value || 'N/A'}</div>
  </motion.div>
);

export function AdminExpenseDetails({
  expenseData,
}: {
  expenseData: Expense;
}) {
  return (
    <Suspense fallback={<ExpenseDetailsSkeleton />}>
      <motion.div 
        className="container mx-auto py-6 max-w-4xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold">Expense Details</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  Reference ID: {expenseData.$id}
                </div>
              </div>
              <StatusBadge status={expenseData.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {/* Basic Information */}
            <motion.div 
              className="grid gap-6 md:grid-cols-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <InfoItem icon={Building2} label="Campus" value={expenseData.campus} />
              <InfoItem icon={FileText} label="Department" value={expenseData.department} />
              <InfoItem icon={Bank} label="Bank Account" value={expenseData.bank_account} />
              <InfoItem icon={Receipt} label="Invoice ID" value={`#${expenseData.invoice_id}`} />
            </motion.div>

            {/* Financial Details */}
            <motion.div 
              className="grid gap-6 md:grid-cols-2 p-6 bg-linear-to-br from-muted/30 to-muted/10 rounded-xl shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                <div className="text-3xl font-bold text-primary">
                  {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                    .format(Number(expenseData.total))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Prepayment Amount</span>
                <div className="text-3xl font-bold text-muted-foreground">
                  {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                    .format(Number(expenseData.prepayment_amount))}
                </div>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <span className="text-sm font-medium text-muted-foreground">Description</span>
              <div className="p-4 bg-muted/30 rounded-lg text-lg">
                {expenseData.description}
              </div>
            </motion.div>

            {/* User Information */}
            <motion.div 
              className="p-4 bg-muted/30 rounded-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 }}
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <User className="h-5 w-5" />
                <span className="font-medium">Submitted By</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-medium">
                  {expenseData.user?.name || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {expenseData.user?.$id || 'N/A'}
                </div>
              </div>
            </motion.div>

            {/* Submission Date */}
            <motion.div 
              className="flex items-center gap-2 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1 }}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Submitted on {new Date(expenseData.$createdAt).toLocaleDateString('sv-SE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </Suspense>
  );
}