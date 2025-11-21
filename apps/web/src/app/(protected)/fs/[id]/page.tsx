import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, Paperclip, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { ImageWithFallback } from "@repo/ui/components/image";
import { getExpenseById } from "@/lib/actions/expense";
import { ExpenseStatus } from "@repo/api/types/appwrite";
import { ExpenseDetailSkeleton } from "@/components/expense/expense-skeleton";

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

interface ExpenseDetailsProps {
  params: Promise<{
    id: string;
  }>;
}

async function ExpenseDetails({ expenseId }: { expenseId: string }) {
  const result = await getExpenseById(expenseId);

  if (!result.success || !result.expense) {
    return notFound();
  }

  const expense = result.expense;
  const config = statusConfig[expense.status as ExpenseStatus];
  const StatusIcon = config.icon;

  const submittedDate = new Date(expense.$createdAt).toLocaleDateString("no-NO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Expense Information */}
      <Card className="p-8 border-0 shadow-lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {expense.description || "Expense Reimbursement"}
            </h2>
            <Badge className={config.color + " text-sm"}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {config.label}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#3DA9E0]">
              {expense.total.toFixed(2)} NOK
            </div>
            <p className="text-sm text-gray-500 mt-1">Total Amount</p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Campus</h3>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#3DA9E0]" />
              <span className="text-gray-900">{expense.campus}</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Department</h3>
            <p className="text-gray-900">{expense.department}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Submitted Date</h3>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3DA9E0]" />
              <span className="text-gray-900">{submittedDate}</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Bank Account</h3>
            <p className="text-gray-900 font-mono">{expense.bank_account}</p>
          </div>

          {expense.eventName && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Event Name</h3>
              <p className="text-gray-900">{expense.eventName}</p>
            </div>
          )}

          {expense.prepayment_amount && expense.prepayment_amount > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Prepayment</h3>
              <p className="text-gray-900">{expense.prepayment_amount.toFixed(2)} NOK</p>
            </div>
          )}

          {expense.invoice_id && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Invoice ID</h3>
              <p className="text-gray-900 font-mono">{expense.invoice_id}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Attachments */}
      {expense.expenseAttachments && expense.expenseAttachments.length > 0 && (
        <Card className="p-8 border-0 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Paperclip className="w-5 h-5 text-[#3DA9E0]" />
            <h2 className="text-2xl font-bold text-gray-900">
              Attachments ({expense.expenseAttachments.length})
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {expense.expenseAttachments.map((attachment) => (
              <Card key={attachment.$id} className="p-4 border-[#3DA9E0]/20">
                <div className="space-y-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Description</h4>
                    <p className="text-gray-900">{attachment.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500">Date</h4>
                      <p className="text-gray-900">
                        {attachment.date
                          ? new Date(attachment.date).toLocaleDateString("no-NO")
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500">Amount</h4>
                      <p className="text-gray-900 font-semibold">
                        {attachment.amount?.toFixed(2) || "0.00"} NOK
                      </p>
                    </div>
                  </div>
                  {attachment.url && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${attachment.url}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3DA9E0] hover:underline text-sm"
                    >
                      View Receipt →
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

export default async function ExpenseViewPage({ params }: ExpenseDetailsProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="relative h-[30vh] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwZG9jdW1lbnRzfGVufDF8fHx8MTc2MjE2NTE0NXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Expense Details"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <Link href="/fs">
              <button className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Back to Reimbursements
              </button>
            </Link>

            <h1 className="text-4xl font-bold text-white">Expense Details</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Suspense fallback={<ExpenseDetailSkeleton />}>
          <ExpenseDetails expenseId={id} />
        </Suspense>
      </div>
    </div>
  );
}

