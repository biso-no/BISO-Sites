"use client";

import type { Campus, Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { FileText, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { apiClient } from "@/lib/api-client";
import { ExpenseReport } from "./expense-report";
import { GenerativeReceiptPreview } from "./generative-receipt-preview";
import { ReceiptWallet } from "./receipt-wallet";
import { type Receipt, useExpenseStore } from "./store";

interface OcrData {
  amount?: number;
  amountInNok?: number;
  currency?: string;
  date?: string;
  description?: string;
  documentType?: "receipt" | "bank-statement";
  exchangeRate?: number;
  vendor?: string;
}

function normalizeVendor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function vendorsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeVendor(a);
  const nb = normalizeVendor(b);
  if (!na || !nb) return false;

  // Exact or full-string substring match
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // Word-level prefix match — handles plurals/possessives like "kungsan" vs "kungsans"
  const wordsA = na.split(" ").filter((w) => w.length > 2);
  const wordsB = nb.split(" ").filter((w) => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const matched = wordsA.filter((wa) =>
    wordsB.some((wb) => wa.startsWith(wb) || wb.startsWith(wa))
  );

  // Require at least half the words from the shorter name to match
  return matched.length >= Math.max(1, Math.ceil(Math.min(wordsA.length, wordsB.length) / 2));
}

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

interface ExpenseSplitViewProps {
  campuses: Campus[];
  initialProfile: Partial<Users>;
}

export function ExpenseSplitView({
  campuses,
  initialProfile,
}: ExpenseSplitViewProps) {
  const router = useRouter();
  const store = useExpenseStore();
  const [mobileView, setMobileView] = useState<"wallet" | "report">("wallet");
  const [lastSummarizedReceipts, setLastSummarizedReceipts] =
    useState<string>("");

  // Auto-generate summary when receipts are ready
  useEffect(() => {
    const allReady = store.allReceiptsReady();
    const currentIds = store.receipts
      .map((r) => r.id)
      .sort()
      .join(",");

    if (
      allReady &&
      store.receipts.length > 0 &&
      currentIds !== lastSummarizedReceipts
    ) {
      const generate = async () => {
        store.setIsGeneratingSummary(true);
        try {
          const descriptions = store.receipts.map((r) => r.description);
          const data = await apiClient.fetch<{
            success: boolean;
            summary: string;
          }>("/api/expenses/summary", {
            method: "POST",
            body: { descriptions },
          });
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
  }, [
    store.receipts,
    lastSummarizedReceipts,
    store.allReceiptsReady,
    store.setDescription,
    store.setIsGeneratingSummary,
  ]);

  // Reset store on mount to clear stale receipts/state from previous sessions
  useEffect(() => {
    store.reset();
  }, [store.reset]);

  // Initialize store
  useEffect(() => {
    store.setCampuses(campuses);
    store.setProfile(initialProfile);
  }, [campuses, initialProfile, store.setCampuses, store.setProfile]);

  // Process File Logic
  const processFile = useCallback(
    async (file: File, presetId?: string): Promise<{ id: string; ocrData: OcrData } | null> => {
      const tempId = presetId ?? uuid();
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

        // 2. OCR — race against a 30s timeout so the receipt never hangs in "processing"
        const ocrFormData = new FormData();
        ocrFormData.append("file", file);

        const ocrResult = await Promise.race([
          apiClient.fetchFormData<{
            success: boolean;
            data: OcrData;
          }>("/api/expenses/ocr", {
            method: "POST",
            body: ocrFormData,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("OCR timed out")), 30_000)
          ),
        ]);

        if (!(ocrResult.success && ocrResult.data)) {
          throw new Error("OCR processing returned no data");
        }

        // 3. "Analyzing" Phase (Artificial delay for Generative UI feel if it was too fast)
        store.updateReceipt(tempId, { status: "analyzing", progress: 70 });

        // Simulate "thinking" time for the user to appreciate the UI
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const receiptUpdates = buildReceiptFromOcr(ocrResult.data, file.name);
        store.updateReceipt(tempId, receiptUpdates);
        return { id: tempId, ocrData: ocrResult.data };
      } catch (error) {
        console.error(error);
        store.updateReceipt(tempId, {
          status: "error",
          error: "Failed to process receipt",
        });
        toast.error("Failed to process receipt");
        return null;
      }
    },
    [store]
  );

  const reconcileBatch = useCallback(
    (results: Array<{ id: string; ocrData: OcrData } | null>) => {
      const valid = results.filter(
        (r): r is { id: string; ocrData: OcrData } => r !== null
      );

      const statements = valid.filter(
        (r) => r.ocrData.documentType === "bank-statement"
      );
      const receipts = valid.filter(
        (r) => r.ocrData.documentType !== "bank-statement"
      );

      if (statements.length === 0 || receipts.length === 0) return;

      const currentReceipts = useExpenseStore.getState().receipts;

      for (const stmt of statements) {
        const match = receipts.find((r) =>
          vendorsOverlap(r.ocrData.vendor ?? "", stmt.ocrData.vendor ?? "")
        );
        if (!match) continue;

        const stmtReceipt = currentReceipts.find((r) => r.id === stmt.id);
        const parentReceipt = currentReceipts.find((r) => r.id === match.id);
        if (!stmtReceipt || !parentReceipt) continue;

        const nokAmount = Math.abs(stmtReceipt.amount);

        store.updateReceipt(match.id, {
          bankStatementId: stmtReceipt.fileId,
          bankStatementName: stmtReceipt.fileName,
          bankStatementType: stmtReceipt.fileType,
          ...(nokAmount > 0 && { amount: nokAmount }),
        });

        store.updateReceipt(stmt.id, {
          parentId: match.id,
          amount: 0,
          description: `Bank Statement for: ${parentReceipt.vendor || parentReceipt.description || "Receipt"}`,
        });

        toast.success(
          `Bank statement linked to ${parentReceipt.vendor || "receipt"}`
        );
      }
    },
    [store]
  );

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 1) {
        processFile(files[0]);
        return;
      }
      // Multi-file: assign IDs upfront so reconciliation can reference them
      const batchIds = files.map(() => uuid());
      Promise.all(files.map((file, i) => processFile(file, batchIds[i]))).then(
        reconcileBatch
      );
    },
    [processFile, reconcileBatch]
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

      const result = await apiClient.fetch<{
        success: boolean;
        fetchedExpense?: { $id: string };
        error?: string;
      }>("/api/expenses/submit", {
        method: "POST",
        body: payload,
      });

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
    <div className="flex min-h-dvh w-full flex-col bg-background md:h-dvh md:flex-row md:overflow-hidden">
      {/* Mobile Tab Navigation */}
      <div className="flex border-border border-b bg-card md:hidden dark:bg-card">
        <Button
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-none border-transparent border-b-2 py-4 font-medium text-sm transition-colors",
            mobileView === "wallet"
              ? "bg-muted text-foreground dark:bg-background/10 dark:text-white"
              : "text-muted-foreground hover:bg-muted/60 dark:text-white/70 dark:hover:bg-background/5"
          )}
          onClick={() => setMobileView("wallet")}
          variant="ghost"
        >
          <Wallet className="h-4 w-4" />
          Receipts
        </Button>
        <Button
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-none border-transparent border-b-2 py-4 font-medium text-sm transition-colors",
            mobileView === "report"
              ? "bg-muted text-foreground dark:bg-background/10 dark:text-white"
              : "text-muted-foreground hover:bg-muted/60 dark:text-white/70 dark:hover:bg-background/5"
          )}
          onClick={() => setMobileView("report")}
          variant="ghost"
        >
          <FileText className="h-4 w-4" />
          Report
        </Button>
      </div>

      {/* Left Pane: Wallet */}
      <div
        className={cn(
          "w-full shrink-0 border-border border-r bg-card md:max-h-dvh md:w-[350px] md:overflow-y-auto lg:w-[400px] dark:border-white/10 dark:bg-card",
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
          "flex-1 bg-muted/50 md:overflow-y-auto dark:bg-inverted",
          mobileView === "report" ? "block" : "hidden md:block"
        )}
      >
        {store.selectedReceiptId ? (
          <div className="relative h-full pt-16">
            <div className="absolute top-4 left-4 z-10">
              <Button
                className="rounded-full bg-muted px-4 py-2 text-foreground text-sm backdrop-blur-md hover:bg-muted/80 dark:bg-background/10 dark:text-white dark:hover:bg-background/20"
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
            onProfileUpdate={store.setProfile}
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
