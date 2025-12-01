"use client";

import type { Campus, Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { FileText, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import {
  createExpense,
  createExpenseAttachment,
  uploadExpenseAttachment,
} from "@/lib/actions/expense";
import { ExpenseReport } from "./expense-report";
import { GenerativeReceiptPreview } from "./generative-receipt-preview";
import { ReceiptWallet } from "./receipt-wallet";
import { type Receipt, useExpenseStore } from "./store";

type OcrData = {
  description?: string;
  vendor?: string;
  amount?: number;
  amountInNok?: number;
  exchangeRate?: number;
  date?: string;
  currency?: string;
};

function buildReceiptFromOcr(
  data: OcrData,
  fileName: string
): Partial<Receipt> {
  const isNok = data.currency === "NOK" || !data.currency;
  const amount = isNok
    ? (data.amount ?? 0)
    : (data.amountInNok ?? data.amount ?? 0);

  return {
    status: "ready",
    progress: 100,
    description: data.description || data.vendor || `Receipt from ${fileName}`,
    amount,
    originalAmount: data.amount ?? 0,
    exchangeRate: data.exchangeRate,
    date: data.date || new Date().toISOString().split("T")[0],
    vendor: data.vendor || "",
    currency: data.currency || "NOK",
  };
}

type ExpenseSplitViewProps = {
  campuses: Campus[];
  initialProfile: Partial<Users>;
};

export function ExpenseSplitView({
  campuses,
  initialProfile,
}: ExpenseSplitViewProps) {
  const router = useRouter();
  const store = useExpenseStore();
  const [mobileView, setMobileView] = useState<"wallet" | "report">("wallet");
  const [lastSummarizedReceipts, setLastSummarizedReceipts] = useState<string>("");

  // Auto-generate summary when receipts are ready
  useEffect(() => {
    const allReady = store.allReceiptsReady();
    const currentIds = store.receipts.map((r) => r.id).sort().join(",");

    if (
      allReady &&
      store.receipts.length > 0 &&
      currentIds !== lastSummarizedReceipts
    ) {
      const generate = async () => {
        store.setIsGeneratingSummary(true);
        try {
          const descriptions = store.receipts.map((r) => r.description);
          const response = await fetch("/api/expenses/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descriptions }),
          });
          const data = await response.json();
          if (data.success) {
            store.setDescription(data.summary);
          }
        } catch (e) {
          console.error("Failed to generate summary", e);
        } finally {
          store.setIsGeneratingSummary(false);
          setLastSummarizedReceipts(currentIds);
        }
      };
      generate();
    }
  }, [store.receipts, lastSummarizedReceipts, store.allReceiptsReady, store.setDescription, store.setIsGeneratingSummary]);

  // Initialize store
  useEffect(() => {
    store.setCampuses(campuses);
    store.setProfile(initialProfile);
  }, [campuses, initialProfile, store.setCampuses, store.setProfile]);

  // Process File Logic
  const processFile = useCallback(
    async (file: File) => {
      const tempId = uuid();
      const receipt: Receipt = {
        id: tempId,
        fileId: "",
        fileUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileType: file.type,
        status: "uploading",
        progress: 0,
        description: "",
        amount: 0,
        date: "",
        confidence: 0,
        currency: "NOK",
      };

      store.addReceipt(receipt);

      // Removed auto-selection and view switching to keep user in current context
      // store.setSelectedReceiptId(tempId);
      // setMobileView("report");

      try {
        // 1. Upload
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        store.updateReceipt(tempId, { progress: 20 });

        const uploadResult = await uploadExpenseAttachment(uploadFormData);
        if (!(uploadResult.success && uploadResult.file)) {
          throw new Error(uploadResult.error || "Upload failed");
        }

        const fileId = uploadResult.file.$id;
        const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

        store.updateReceipt(tempId, {
          fileId,
          fileUrl,
          progress: 40,
          status: "processing",
        });

        // 2. OCR
        const ocrFormData = new FormData();
        ocrFormData.append("file", file);

        const ocrResponse = await fetch("/api/expenses/ocr", {
          method: "POST",
          body: ocrFormData,
        });

        if (!ocrResponse.ok) {
          throw new Error("OCR failed");
        }

        const ocrResult = await ocrResponse.json();

        // 3. "Analyzing" Phase (Artificial delay for Generative UI feel if it was too fast)
        store.updateReceipt(tempId, { status: "analyzing", progress: 70 });

        // Simulate "thinking" time for the user to appreciate the UI
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const receiptUpdates = buildReceiptFromOcr(ocrResult.data, file.name);
        store.updateReceipt(tempId, receiptUpdates);
      } catch (error) {
        console.error(error);
        store.updateReceipt(tempId, {
          status: "error",
          error: "Failed to process receipt",
        });
        toast.error("Failed to process receipt");
      }
    },
    [store]
  );

  const handleUpload = useCallback(
    (files: File[]) => {
      files.forEach(processFile);
    },
    [processFile]
  );

  const handleSubmit = async () => {
    if (!store.isReadyToSubmit()) {
      toast.error("Please fill in all required fields");
      return;
    }

    store.setPhase("submitting");

    try {
      // Prepare payload for API
      const payload = {
        campus: store.selectedCampusId,
        department: store.selectedDepartmentId,
        bank_account: store.profile.bank_account || "",
        description: store.description,
        total: store.totalAmount(),
        prepayment_amount: 0,
        eventName: "",
        expenseAttachments: store.receipts.map((receipt) => ({
          date: receipt.date,
          url: receipt.fileId,
          amount: receipt.amount,
          description: receipt.description,
          type: receipt.fileType,
        })),
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/expenses/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (result.success && result.fetchedExpense) {
        store.setPhase("complete");
        toast.success("Expense submitted!");
        router.push(`/fs/${result.fetchedExpense.$id}`);
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Submission failed");
      store.setPhase("draft");
    }
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-gray-50 md:flex-row dark:bg-[#0B1120]">
      {/* Mobile Tab Navigation */}
      <div className="flex border-b bg-[#0B1120] text-white md:hidden">
        <Button
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-4 font-medium text-sm transition-colors",
            mobileView === "wallet" ? "bg-white/10 text-white" : "text-white/60"
          )}
          onClick={() => setMobileView("wallet")}
        >
          <Wallet className="h-4 w-4" />
          Receipts
        </Button>
        <Button
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-4 font-medium text-sm transition-colors",
            mobileView === "report" ? "bg-white/10 text-white" : "text-white/60"
          )}
          onClick={() => setMobileView("report")}
        >
          <FileText className="h-4 w-4" />
          Report
        </Button>
      </div>

      {/* Left Pane: Wallet */}
      <div
        className={cn(
          "w-full shrink-0 border-white/10 border-r bg-[#0B1120] md:w-[350px] lg:w-[400px]",
          mobileView === "wallet" ? "block" : "hidden md:block"
        )}
      >
        <ReceiptWallet
          onRemove={store.removeReceipt}
          onSelect={(id) => {
            store.setSelectedReceiptId(id);
            setMobileView("report");
          }}
          onUpload={handleUpload}
          receipts={store.receipts}
          selectedId={store.selectedReceiptId}
        />
      </div>

      {/* Right Pane: Report or Preview */}
      <div
        className={cn(
          "flex-1 bg-gray-50 dark:bg-gray-900",
          mobileView === "report" ? "block" : "hidden md:block"
        )}
      >
        {store.selectedReceiptId ? (
          <div className="relative h-full pt-16">
            <div className="absolute top-4 left-4 z-10">
              <Button
                className="rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur-md hover:bg-white/20 dark:text-white"
                onClick={() => store.setSelectedReceiptId(null)}
              >
                ← Back to Report
              </Button>
            </div>
            {store.receipts.find((r) => r.id === store.selectedReceiptId) && (
              <GenerativeReceiptPreview
                onUpdate={(updates) =>
                  store.updateReceipt(store.selectedReceiptId!, updates)
                }
                receipt={
                  store.receipts.find((r) => r.id === store.selectedReceiptId)!
                }
              />
            )}
          </div>
        ) : (
          <ExpenseReport
            campuses={store.campuses}
            description={store.description}
            isGeneratingSummary={store.isGeneratingSummary}
            isSubmitting={store.phase === "submitting"}
            onAssign={(c, d) =>
              store.setAssignment({
                campusId: c,
                departmentId: d,
                campusName: "",
                departmentName: "",
              })
            }
            onDescriptionChange={store.setDescription}
            onInsert={(afterId, receipt) =>
              store.insertReceiptAfter(afterId, receipt)
            }
            onSelect={store.setSelectedReceiptId}
            onSubmit={handleSubmit}
            onUpdate={(id, updates) => store.updateReceipt(id, updates)}
            receipts={store.receipts}
            selectedCampusId={store.selectedCampusId}
            selectedDepartmentId={store.selectedDepartmentId}
            selectedId={store.selectedReceiptId}
            totalAmount={store.totalAmount()}
            userProfile={store.profile}
          />
        )}
      </div>
    </div>
  );
}
