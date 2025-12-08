import { ExpenseStatus } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import {
 ArrowLeft,
 Building2,
 Calendar,
 CheckCircle,
 Clock,
 Paperclip,
 XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExpenseDetailSkeleton } from "@/components/expense/expense-skeleton";
import { getExpenseById } from "@/lib/actions/expense";

const statusConfig = {
 [ExpenseStatus.DRAFT]: {
 label: "Draft",
 color: "bg-muted text-muted-foreground border-border",
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

type ExpenseDetailsProps = {
 params: Promise<{
 id: string;
 }>;
};

async function ExpenseDetails({ expenseId }: { expenseId: string }) {
 const result = await getExpenseById(expenseId);

 if (!(result.success && result.expense)) {
 return notFound();
 }

 const expense = result.expense;
 const config = statusConfig[expense.status as ExpenseStatus];
 const StatusIcon = config.icon;

 const submittedDate = new Date(expense.$createdAt).toLocaleDateString(
 "no-NO",
 {
 year: "numeric",
 month: "long",
 day: "numeric",
 }
 );

 return (
 <>
 {/* Expense Information */}
 <Card className="border-0 p-8 shadow-lg">
 <div className="mb-6 flex items-start justify-between">
 <div>
 <h2 className="mb-2 font-bold text-3xl text-foreground">
 {expense.description || "Expense Reimbursement"}
 </h2>
 <Badge className={`${config.color}text-sm`}>
 <StatusIcon className="mr-1 h-4 w-4" />
 {config.label}
 </Badge>
 </div>
 <div className="text-right">
 <div className="font-bold text-3xl text-brand">
 {expense.total.toFixed(2)} NOK
 </div>
 <p className="mt-1 text-muted-foreground text-sm">Total Amount</p>
 </div>
 </div>

 <Separator className="my-6" />

 <div className="grid gap-6 md:grid-cols-2">
 <div>
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">Campus</h3>
 <div className="flex items-center gap-2">
 <Building2 className="h-4 w-4 text-brand" />
 <span className="text-foreground">{expense.campus}</span>
 </div>
 </div>

 <div>
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">
 Department
 </h3>
 <p className="text-foreground">{expense.department}</p>
 </div>

 <div>
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">
 Submitted Date
 </h3>
 <div className="flex items-center gap-2">
 <Calendar className="h-4 w-4 text-brand" />
 <span className="text-foreground">{submittedDate}</span>
 </div>
 </div>

 <div>
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">
 Bank Account
 </h3>
 <p className="font-mono text-foreground">{expense.bank_account}</p>
 </div>

 {expense.eventName && (
 <div className="md:col-span-2">
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">
 Event Name
 </h3>
 <p className="text-foreground">{expense.eventName}</p>
 </div>
 )}

 {expense.prepayment_amount && expense.prepayment_amount > 0 && (
 <div>
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">
 Prepayment
 </h3>
 <p className="text-foreground">
 {expense.prepayment_amount.toFixed(2)} NOK
 </p>
 </div>
 )}

 {expense.invoice_id && (
 <div>
 <h3 className="mb-2 font-semibold text-muted-foreground text-sm">
 Invoice ID
 </h3>
 <p className="font-mono text-foreground">{expense.invoice_id}</p>
 </div>
 )}
 </div>
 </Card>

 {/* Attachments */}
 {expense.expenseAttachments && expense.expenseAttachments.length > 0 && (
 <Card className="border-0 p-8 shadow-lg">
 <div className="mb-6 flex items-center gap-2">
 <Paperclip className="h-5 w-5 text-brand" />
 <h2 className="font-bold text-2xl text-foreground">
 Attachments ({expense.expenseAttachments.length})
 </h2>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 {expense.expenseAttachments.map((attachment) => (
 <Card className="border-brand-border p-4" key={attachment.$id}>
 <div className="space-y-2">
 <div>
 <h4 className="font-semibold text-muted-foreground text-sm">
 Description
 </h4>
 <p className="text-foreground">{attachment.description}</p>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <h4 className="font-semibold text-muted-foreground text-sm">
 Date
 </h4>
 <p className="text-foreground">
 {attachment.date
 ? new Date(attachment.date).toLocaleDateString(
 "no-NO"
 )
 : "N/A"}
 </p>
 </div>
 <div>
 <h4 className="font-semibold text-muted-foreground text-sm">
 Amount
 </h4>
 <p className="font-semibold text-foreground">
 {attachment.amount?.toFixed(2) || "0.00"} NOK
 </p>
 </div>
 </div>
 {attachment.url && (
 <a
 className="text-brand text-sm hover:underline"
 href={`${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${attachment.url}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`}
 rel="noopener noreferrer"
 target="_blank"
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
 <div className="min-h-screen bg-linear-to-b from-section to-background">
 {/* Header */}
 <div className="relative h-[30vh] overflow-hidden">
 <ImageWithFallback
 alt="Expense Details"
 className="object-cover"
 fill
 src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwZG9jdW1lbnRzfGVufDF8fHx8MTc2MjE2NTE0NXww&ixlib=rb-4.1.0&q=80&w=1080"
 />
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 <div className="absolute inset-0 flex items-center justify-center">
 <div className="mx-auto max-w-4xl px-4 text-center">
 <Link href="/fs">
 <button
 className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-brand"
 type="button"
 >
 <ArrowLeft className="h-5 w-5" />
 Back to Reimbursements
 </button>
 </Link>

 <h1 className="font-bold text-4xl text-white">Expense Details</h1>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="mx-auto max-w-4xl space-y-6 px-4 py-12">
 <Suspense fallback={<ExpenseDetailSkeleton />}>
 <ExpenseDetails expenseId={id} />
 </Suspense>
 </div>
 </div>
 );
}
