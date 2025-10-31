'use client'
import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { format } from "date-fns";
import {
  Receipt,
  Building,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  ArrowLeft,
  Download,
  Map,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from '@repo/ui/lib/utils';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export function ExpenseDetailsView({ expense }) {
  const router = useRouter();

  const handleBack = () => {
    router.push("/expenses");
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white p-6">
      <motion.div 
        className="max-w-4xl mx-auto space-y-6"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        {/* Header Section */}
        <motion.div variants={fadeInUp} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-semibold">Expense Details</h1>
          </div>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </Button>
        </motion.div>

        {/* Main Info Card */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader className="border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Summary</CardTitle>
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium",
                  expense.status === "submitted" 
                    ? "bg-blue-50 text-blue-700 border border-blue-200" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                )}>
                  {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <InfoItem 
                  icon={<Building className="text-gray-500" />}
                  label="Department"
                  value={expense.department}
                />
                <InfoItem 
                  icon={<Map className="text-gray-500" />}
                  label="Campus"
                  value={expense.campus}
                />
                <InfoItem 
                  icon={<CreditCard className="text-gray-500" />}
                  label="Bank Account"
                  value={expense.bank_account}
                />
              </div>
              <div className="space-y-4">
                <InfoItem 
                  icon={<CalendarDays className="text-gray-500" />}
                  label="Submitted Date"
                  value={format(new Date(expense.$createdAt), "PPP")}
                />
                <InfoItem 
                  icon={<DollarSign className="text-gray-500" />}
                  label="Total Amount"
                  value={`${expense.total.toFixed(2)} NOK`}
                  highlighted
                />
                {expense.prepayment_amount > 0 && (
                  <InfoItem 
                    icon={<DollarSign className="text-gray-500" />}
                    label="Prepayment"
                    value={`${expense.prepayment_amount.toFixed(2)} NOK`}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Attachments Section */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-xl">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {expense.expense_attachments?.map((attachment, index) => (
                  <motion.div 
                    key={index}
                    variants={fadeInUp}
                    className="group"
                  >
                    <Card className="transition-all duration-200 hover:shadow-md">
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                        <InfoItem 
                          icon={<Receipt className="text-gray-500" />}
                          label="Description"
                          value={attachment.description}
                        />
                        <InfoItem 
                          icon={<DollarSign className="text-gray-500" />}
                          label="Amount"
                          value={`${attachment.amount.toFixed(2)} NOK`}
                        />
                        <div className="flex justify-between items-center md:justify-end">
                          <Button 
                            variant="outline"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            asChild
                          >
                            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                              <FileText className="mr-2 h-4 w-4" />
                              View Receipt
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Description Section if available */}
        {expense.description && (
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-xl">Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-gray-600">{expense.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function InfoItem({ icon, label, value, highlighted = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <p className={cn(
          "font-medium",
          highlighted ? "text-lg text-primary" : "text-gray-900"
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default ExpenseDetailsView;