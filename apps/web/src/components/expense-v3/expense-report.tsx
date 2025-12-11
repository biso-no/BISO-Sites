"use client";

import type { Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Combobox } from "@repo/ui/components/ui/combobox";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Upload,
  User,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { v4 as uuid } from "uuid";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { ProfileCompletionBanner } from "./profile-completion-banner";
import type { Receipt } from "./store";

type ReceiptRowProps = {
  receipt: Receipt;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Receipt>) => void;
  uploadingId: string | null;
  setUploadingId: (id: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

function ReceiptRow({
  receipt,
  selectedId,
  onSelect,
  onUpdate,
  uploadingId,
  setUploadingId,
  fileInputRef,
}: ReceiptRowProps) {
  const isForeign = receipt.currency && receipt.currency !== "NOK";

  return (
    <motion.tr
      animate={{
        opacity: 1,
        backgroundColor:
          selectedId === receipt.id ? "var(--highlight-bg)" : "transparent",
      }}
      className={cn(
        "group cursor-pointer transition-colors hover:bg-muted dark:hover:bg-inverted/30",
        selectedId === receipt.id
          ? "bg-sky-50 [--highlight-bg:rgba(14,165,233,0.1)] dark:bg-sky-900/10"
          : ""
      )}
      initial={{ opacity: 0 }}
      key={receipt.id}
      layout
      onClick={() => onSelect(receipt.id)}
    >
      <td className="p-0" colSpan={3}>
        <div className="flex w-full items-center border-b border-border px-0 py-4 dark:border-border/50">
          <div className="w-full max-w-[200px] px-4 md:max-w-[300px] md:px-8">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  receipt.status === "ready"
                    ? "bg-emerald-500"
                    : "animate-pulse bg-amber-500"
                )}
              />
              <div className="flex flex-col gap-0.5">
                <div className="truncate font-medium text-foreground dark:text-white">
                  {receipt.vendor || receipt.description || "Processing..."}
                </div>
                {/* Show date on mobile only */}
                <div className="block text-muted-foreground text-xs md:hidden">
                  {receipt.date || "-"}
                </div>
              </div>
            </div>
            {receipt.status === "analyzing" && (
              <div className="mt-1 ml-5 h-1 w-24 overflow-hidden rounded-full bg-muted dark:bg-inverted">
                <div className="h-full w-full animate-indeterminate bg-sky-500" />
              </div>
            )}
          </div>
          <div className="hidden flex-1 px-4 text-muted-foreground md:block">
            {receipt.date || "-"}
          </div>
          <div className="w-[150px] px-4 text-right font-medium font-mono text-foreground md:px-8 dark:text-white">
            {receipt.amount ? `${receipt.amount.toLocaleString()} NOK` : "-"}
          </div>
        </div>

        {/* Foreign Currency Warning Row */}
        {isForeign && (
          <ForeignCurrencyWarning
            fileInputRef={fileInputRef}
            onUpdate={onUpdate}
            receipt={receipt}
            setUploadingId={setUploadingId}
            uploadingId={uploadingId}
          />
        )}
      </td>
    </motion.tr>
  );
}

type ForeignCurrencyWarningProps = {
  receipt: Receipt;
  onUpdate: (id: string, updates: Partial<Receipt>) => void;
  uploadingId: string | null;
  setUploadingId: (id: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

function ForeignCurrencyWarning({
  receipt,
  onUpdate,
  uploadingId,
  setUploadingId,
  fileInputRef,
}: ForeignCurrencyWarningProps) {
  if (receipt.bankStatementId) {
    return (
      <div className="bg-amber-50/50 px-4 py-3 md:px-8 dark:bg-amber-900/10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-700 text-xs dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              Estimated from {receipt.currency} ({receipt.exchangeRate})
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 text-xs">
            <Check className="h-3 w-3" />
            <span className="max-w-[100px] truncate md:max-w-[200px]">
              {receipt.bankStatementName}
            </span>
            <Button
              className="ml-1 hover:text-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(receipt.id, {
                  bankStatementId: undefined,
                  bankStatementName: undefined,
                });
              }}
            >
              ×
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/50 px-4 py-3 md:px-8 dark:bg-amber-900/10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-700 text-xs dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            Estimated from {receipt.currency} ({receipt.exchangeRate})
          </span>
        </div>
        <Button
          className="h-7 gap-1 border-amber-200 bg-background text-amber-700 text-xs hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/50"
          disabled={uploadingId === receipt.id}
          onClick={(e) => {
            e.stopPropagation();
            setUploadingId(receipt.id);
            fileInputRef.current?.click();
          }}
          size="sm"
          variant="outline"
        >
          {uploadingId === receipt.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          Upload Statement
        </Button>
      </div>
    </div>
  );
}

type ExpenseReportProps = {
  receipts: Receipt[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Receipt>) => void;
  onInsert: (afterId: string, receipt: Receipt) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  totalAmount: number;
  campuses: any[];
  selectedCampusId: string;
  selectedDepartmentId: string;
  onAssign: (campusId: string, departmentId: string) => void;
  userProfile: Partial<Users>;
  onProfileUpdate: (profile: Partial<Users>) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  isGeneratingSummary: boolean;
};

export function ExpenseReport({
  receipts,
  selectedId,
  onSelect,
  onUpdate,
  onInsert,
  onSubmit,
  isSubmitting,
  totalAmount,
  campuses,
  selectedCampusId,
  selectedDepartmentId,
  onAssign,
  userProfile,
  onProfileUpdate,
  description,
  onDescriptionChange,
  isGeneratingSummary,
}: ExpenseReportProps) {
  const today = format(new Date(), "MMMM d, yyyy");

  // Generate a stable draft number that doesn't change on re-renders
  const draftNumber = useMemo(() => Math.floor(Math.random() * 10_000), []);

  // Find departments for selected campus
  const selectedCampus = campuses.find((c) => c.$id === selectedCampusId);
  const departments = selectedCampus?.departments || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handleBankStatementUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    receiptId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingId(receiptId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadExpenseAttachment(formData);
      if (result.success && result.file) {
        const parentReceipt = receipts.find((r) => r.id === receiptId);
        const fileId = result.file.$id;
        const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

        // 1. Mark parent as verified
        onUpdate(receiptId, {
          bankStatementId: fileId,
          bankStatementName: file.name,
          bankStatementType: file.type,
        });

        // 2. Insert new receipt for the statement
        const statementReceipt: Receipt = {
          id: uuid(),
          fileId,
          fileUrl,
          fileName: file.name,
          fileType: file.type,
          status: "ready",
          progress: 100,
          description: `Bank Statement for: ${parentReceipt?.vendor || parentReceipt?.description || "Receipt"}`,
          amount: 0,
          date: parentReceipt?.date || new Date().toISOString().split("T")[0],
          confidence: 1,
          currency: "NOK",
        };

        onInsert(receiptId, statementReceipt);

        toast.success("Bank statement uploaded and added to list");
      } else {
        toast.error("Upload failed");
      }
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <ScrollArea className="flex h-full flex-col bg-muted/50 p-4 md:p-8 dark:bg-inverted/50">
      <div>
        <input
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) =>
            uploadingId && handleBankStatementUpload(e, uploadingId)
          }
          ref={fileInputRef}
          type="file"
        />

        {/* Paper Document Effect */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-xl dark:bg-card dark:shadow-2xl dark:shadow-black/40"
          initial={{ opacity: 0, y: 20 }}
        >
          {/* Document Header */}
          <div className="border-b border-border p-6 md:p-8">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row">
              <div>
                <h1 className="font-bold text-2xl text-foreground tracking-tight md:text-3xl dark:text-white">
                  Expense Report
                </h1>
                <p className="text-muted-foreground">{today}</p>
              </div>
              <div className="rounded-full bg-muted px-4 py-1.5 font-medium text-muted-foreground text-sm">
                Draft #{draftNumber}
              </div>
            </div>

            {/* User & Assignment Info */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm dark:text-white">
                      {userProfile?.name || "Unknown User"}
                    </p>
                    <p className="text-xs">{userProfile?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm dark:text-white">
                      Reimbursement
                    </p>
                    <p className="font-mono text-xs">
                      {userProfile?.bank_account || "No bank account connected"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg bg-muted p-4 dark:bg-inverted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
                  <Building2 className="h-3 w-3" />
                  Cost Allocation
                </div>

                <div className="grid gap-2">
                  <Select
                    onValueChange={(val) => onAssign(val, "")}
                    value={selectedCampusId}
                  >
                    <SelectTrigger className="h-9 border-border bg-background dark:border-border dark:bg-inverted">
                      <SelectValue placeholder="Select Campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {campuses.map((campus) => (
                        <SelectItem key={campus.$id} value={campus.$id}>
                          {campus.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Combobox
                    defaultValue={selectedDepartmentId}
                    disabled={!selectedCampusId}
                    items={departments.map((dept: any) => ({
                      value: dept.$id,
                      label: dept.Name,
                    }))}
                    name="department"
                    onValueChange={(val) => onAssign(selectedCampusId, val)}
                  />
                </div>
              </div>
            </div>

            {/* Profile Completion Banner */}
            <ProfileCompletionBanner
              onProfileUpdate={onProfileUpdate}
              userProfile={userProfile}
            />

            {/* Description / Summary */}
            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between">
                <label className="font-medium text-foreground text-sm">
                  Description
                </label>
                {isGeneratingSummary && (
                  <div className="flex items-center gap-2 text-sky-500 text-xs animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI Generating Summary...
                  </div>
                )}
              </div>
              <Textarea
                className="min-h-[80px] resize-none border-border bg-muted text-sm focus:bg-background dark:border-border dark:bg-inverted/50 dark:focus:bg-inverted"
                disabled={isGeneratingSummary}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Brief description of the expenses (e.g. 'Cabintrip with the unit')..."
                value={description}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="flex-1 overflow-y-auto bg-card p-0 dark:bg-card">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground dark:bg-inverted/50">
                <tr>
                  <th className="px-4 py-3 font-medium md:px-8">
                    Item Description
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right font-medium md:px-8">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-gray-800">
                {receipts.length === 0 ? (
                  <tr>
                    <td
                      className="py-12 text-center text-muted-foreground"
                      colSpan={3}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="h-8 w-8 opacity-20" />
                        <p>No receipts added yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  receipts.map((receipt) => (
                    <ReceiptRow
                      fileInputRef={fileInputRef}
                      key={receipt.id}
                      onSelect={onSelect}
                      onUpdate={onUpdate}
                      receipt={receipt}
                      selectedId={selectedId}
                      setUploadingId={setUploadingId}
                      uploadingId={uploadingId}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Totals */}
          <div className="border-t border-border bg-muted p-6 md:p-8 dark:bg-inverted/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="text-muted-foreground">
                <p className="text-sm">
                  {receipts.length}{" "}
                  {receipts.length === 1 ? "receipt" : "receipts"} attached
                </p>
              </div>
              <div className="flex items-end justify-between md:block md:text-right">
                <p className="text-muted-foreground text-sm">
                  Total Reimbursement
                </p>
                <p className="font-bold text-2xl text-foreground tracking-tight md:text-3xl dark:text-white">
                  {totalAmount.toLocaleString()}{" "}
                  <span className="text-muted-foreground text-lg">NOK</span>
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto md:min-w-[200px] dark:bg-background dark:text-brand-dark dark:hover:bg-background/90"
                disabled={
                  isSubmitting ||
                  receipts.length === 0 ||
                  !selectedCampusId ||
                  !selectedDepartmentId
                }
                onClick={onSubmit}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Expense
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </ScrollArea>
  );
}
