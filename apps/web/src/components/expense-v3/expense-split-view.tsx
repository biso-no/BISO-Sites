"use client";

import type {
  Campus,
  ExpenseAttachments,
  Expenses,
  Users,
} from "@repo/api/types/appwrite";
import { defaultCostTypeSlugForCategory } from "@repo/shared/utils/expense-cost-types";
import { Button } from "@repo/ui/components/ui/button";
import { Combobox } from "@repo/ui/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight, Building2, Check, FileText, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { apiClient } from "@/lib/api-client";
import { ExpenseReport } from "./expense-report";
import { GenerativeReceiptPreview } from "./generative-receipt-preview";
import { ReceiptWallet } from "./receipt-wallet";
import { type Receipt, useExpenseStore } from "./store";

interface OcrData {
  address?: null | string;
  amount?: null | number;
  amountInNok?: null | number;
  category?:
    | "meal"
    | "travel"
    | "accommodation"
    | "supplies"
    | "event-materials"
    | "fee"
    | "other"
    | null;
  city?: null | string;
  country?: null | string;
  currency?: null | string;
  date?: null | string;
  description?: null | string;
  documentType?: "receipt" | "bank-statement" | null;
  exchangeRate?: null | number;
  purchaseContext?: null | string;
  vendor?: null | string;
}

function normalizeVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function vendorsOverlap(a: string, b: string): boolean {
  if (!(a && b)) {
    return false;
  }
  const na = normalizeVendor(a);
  const nb = normalizeVendor(b);
  if (!(na && nb)) {
    return false;
  }

  // Exact or full-string substring match
  if (na === nb || na.includes(nb) || nb.includes(na)) {
    return true;
  }

  // Word-level prefix match — handles plurals/possessives like "kungsan" vs "kungsans"
  const wordsA = na.split(" ").filter((w) => w.length > 2);
  const wordsB = nb.split(" ").filter((w) => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) {
    return false;
  }

  const matched = wordsA.filter((wa) =>
    wordsB.some((wb) => wa.startsWith(wb) || wb.startsWith(wa))
  );

  // Require at least half the words from the shorter name to match
  return (
    matched.length >=
    Math.max(1, Math.ceil(Math.min(wordsA.length, wordsB.length) / 2))
  );
}

function formatCategory(category?: string): string {
  if (!category) {
    return "Receipt";
  }
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildAccountingDescription(data: OcrData, fileName: string): string {
  if (data.purchaseContext) {
    return data.purchaseContext;
  }

  if (data.category && data.city) {
    return `${formatCategory(data.category)} receipt, ${data.city}`;
  }

  if (data.category) {
    return `${formatCategory(data.category)} receipt`;
  }

  return data.description || data.vendor || `Receipt from ${fileName}`;
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
    description: buildAccountingDescription(data, fileName),
    amount,
    originalAmount: data.amount ?? 0,
    exchangeRate: data.exchangeRate ?? undefined,
    date: data.date || new Date().toISOString().split("T")[0],
    vendor: data.vendor || "",
    currency: data.currency || "NOK",
    documentType: data.documentType ?? undefined,
    location: data.address ?? undefined,
    city: data.city ?? undefined,
    country: data.country ?? undefined,
    category: data.category ?? undefined,
    purchaseContext: data.purchaseContext ?? undefined,
  };
}

interface AssignmentGateProps {
  campuses: Campus[];
  onAssign: (campusId: string, departmentId: string) => void;
  onContinue: () => void;
  selectedCampusId: string;
  selectedDepartmentId: string;
}

function AssignmentGate({
  campuses,
  selectedCampusId,
  selectedDepartmentId,
  onAssign,
  onContinue,
}: AssignmentGateProps) {
  const selectedCampus = campuses.find(
    (campus) => campus.$id === selectedCampusId
  );
  const departments = (selectedCampus?.departments ?? []).filter(
    (department) => department.active !== false
  );
  const canContinue = Boolean(selectedCampusId && selectedDepartmentId);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4 dark:bg-inverted">
      <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-xl dark:bg-card">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-2xl text-foreground tracking-tight dark:text-white">
              Choose cost allocation
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Select campus and department before uploading receipts so AI can
              write a clearer accounting description.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Select
            onValueChange={(campusId) => onAssign(campusId, "")}
            value={selectedCampusId}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select campus" />
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
            items={departments.map((department) => ({
              value: department.$id,
              label: department.Name,
            }))}
            name="department"
            onValueChange={(departmentId) =>
              onAssign(selectedCampusId, departmentId)
            }
          />
        </div>

        {canContinue && (
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-700 text-sm dark:text-emerald-300">
            <Check className="h-4 w-4" />
            <span>
              {selectedCampus?.name} -{" "}
              {
                departments.find(
                  (department) => department.$id === selectedDepartmentId
                )?.Name
              }
            </span>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            className="gap-2"
            disabled={!canContinue}
            onClick={onContinue}
            size="lg"
          >
            Continue to upload
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ExpenseSplitViewProps {
  campuses: Campus[];
  initialDraft?: InitialExpenseDraft | null;
  initialProfile: Partial<Users>;
  /** When false the AI/OCR receipt scan is skipped; manual entry still works. */
  ocrEnabled?: boolean;
}

type InitialExpenseDraft = Pick<
  Expenses,
  | "$id"
  | "bank_account"
  | "campus"
  | "department"
  | "description"
  | "expenseAttachments"
  | "total"
>;

function buildStorageViewUrl(fileId: string): string {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  // The .env.example files use NEXT_PUBLIC_APPWRITE_PROJECT, but the
  // operations docs still document NEXT_PUBLIC_APPWRITE_PROJECT_ID.
  // Support either to avoid breaking deployments that followed the docs.
  const project =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT ||
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  if (!(endpoint && project)) {
    return "";
  }

  return `${endpoint}/storage/buckets/expenses/files/${fileId}/view?project=${project}`;
}

function buildReceiptFromAttachment(
  attachment: ExpenseAttachments
): Receipt | null {
  if (!attachment.url) {
    return null;
  }

  return {
    id: attachment.$id,
    fileId: attachment.url,
    fileUrl: buildStorageViewUrl(attachment.url),
    fileName: attachment.description || "Receipt",
    fileType: attachment.type,
    status: "ready",
    progress: 100,
    description: attachment.description || "",
    amount: attachment.amount ?? 0,
    date: attachment.date
      ? new Date(attachment.date).toISOString().split("T")[0]
      : "",
    confidence: 1,
    currency: "NOK",
    // Restore the saved cost type so resuming a draft keeps the chosen GL
    // mapping instead of falling back to the default on the next save/submit.
    costType: attachment.cost_type ?? undefined,
  };
}

export function ExpenseSplitView({
  campuses,
  initialDraft,
  initialProfile,
  ocrEnabled = true,
}: ExpenseSplitViewProps) {
  const router = useRouter();
  const store = useExpenseStore();
  const [mobileView, setMobileView] = useState<"wallet" | "report">("wallet");
  const [lastSummarizedReceipts, setLastSummarizedReceipts] =
    useState<string>("");
  const skipNextSummaryRef = useRef(Boolean(initialDraft));

  const handleAssign = useCallback(
    (campusId: string, departmentId: string) => {
      const campus = store.campuses.find((item) => item.$id === campusId);
      const department = campus?.departments?.find(
        (item) => item.$id === departmentId
      );

      store.setAssignment({
        campusId,
        departmentId,
        campusName: campus?.name ?? "",
        departmentName: department?.Name ?? "",
      });
    },
    [store]
  );

  // Auto-generate summary when receipts are ready
  useEffect(() => {
    const allReady = store.allReceiptsReady();
    const currentIds = store.receipts
      .map((receipt) => ({
        amount: receipt.amount,
        category: receipt.category,
        city: receipt.city,
        country: receipt.country,
        currency: receipt.currency,
        date: receipt.date,
        description: receipt.description,
        documentType: receipt.documentType,
        id: receipt.id,
        purchaseContext: receipt.purchaseContext,
        vendor: receipt.vendor,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const summaryKey = JSON.stringify({
      assignment: {
        campusId: store.selectedCampusId,
        campusName: store.selectedCampusName,
        departmentId: store.selectedDepartmentId,
        departmentName: store.selectedDepartmentName,
      },
      receipts: currentIds,
    });

    if (
      allReady &&
      store.receipts.length > 0 &&
      store.selectedCampusId &&
      store.selectedDepartmentId &&
      summaryKey !== lastSummarizedReceipts
    ) {
      if (skipNextSummaryRef.current) {
        skipNextSummaryRef.current = false;
        setLastSummarizedReceipts(summaryKey);
        return;
      }

      const generate = async () => {
        store.setIsGeneratingSummary(true);
        try {
          const data = await apiClient.fetch<{
            success: boolean;
            summary: string;
          }>("/api/expenses/summary", {
            method: "POST",
            body: {
              assignment: {
                campusId: store.selectedCampusId,
                campusName: store.selectedCampusName,
                departmentId: store.selectedDepartmentId,
                departmentName: store.selectedDepartmentName,
              },
              receipts: store.receipts.map((receipt) => ({
                amount: receipt.amount,
                category: receipt.category,
                city: receipt.city,
                country: receipt.country,
                currency: receipt.currency,
                date: receipt.date,
                description: receipt.description,
                documentType: receipt.documentType,
                purchaseContext: receipt.purchaseContext,
                vendor: receipt.vendor,
              })),
            },
          });
          if (data.success) {
            store.setDescription(data.summary);
          }
        } catch (e) {
          console.error("Failed to generate summary", e);
        } finally {
          store.setIsGeneratingSummary(false);
          setLastSummarizedReceipts(summaryKey);
        }
      };
      generate();
    }
  }, [
    store.receipts,
    store.selectedCampusId,
    store.selectedCampusName,
    store.selectedDepartmentId,
    store.selectedDepartmentName,
    lastSummarizedReceipts,
    store.allReceiptsReady,
    store.setDescription,
    store.setIsGeneratingSummary,
  ]);

  // Initialize store and hydrate draft data when the user continues a saved draft.
  useEffect(() => {
    store.reset();
    store.setCampuses(campuses);
    store.setProfile(initialProfile);

    if (!initialDraft) {
      skipNextSummaryRef.current = false;
      return;
    }

    skipNextSummaryRef.current = true;

    const campus = campuses.find((item) => item.$id === initialDraft.campus);
    const department = campus?.departments?.find(
      (item) => item.$id === initialDraft.department
    );

    store.setExpenseId(initialDraft.$id);
    store.setAssignment({
      campusId: initialDraft.campus,
      campusName: campus?.name ?? "",
      departmentId: initialDraft.department,
      departmentName: department?.Name ?? "",
    });
    store.setDescription(initialDraft.description ?? "");

    for (const receipt of initialDraft.expenseAttachments
      .map(buildReceiptFromAttachment)
      .filter((receipt): receipt is Receipt => receipt !== null)) {
      store.addReceipt(receipt);
    }
  }, [
    campuses,
    initialDraft,
    initialProfile,
    store.addReceipt,
    store.reset,
    store.setAssignment,
    store.setCampuses,
    store.setDescription,
    store.setExpenseId,
    store.setProfile,
  ]);

  // Process File Logic
  const processFile = useCallback(
    async (
      file: File,
      presetId?: string
    ): Promise<{ id: string; ocrData: OcrData } | null> => {
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
        const fileUrl =
          uploadResult.file.viewUrl ||
          `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

        store.updateReceipt(tempId, {
          fileId,
          fileUrl,
          progress: 40,
          status: "processing",
        });

        // Kill switch: when receipt scanning is disabled, the file is still
        // attached but skips OCR — the user fills in the details manually.
        if (!ocrEnabled) {
          store.updateReceipt(tempId, { progress: 100, status: "ready" });
          return null;
        }

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
    [store, ocrEnabled]
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

      if (statements.length === 0 || receipts.length === 0) {
        return;
      }

      const currentReceipts = useExpenseStore.getState().receipts;

      for (const stmt of statements) {
        const match = receipts.find((r) =>
          vendorsOverlap(r.ocrData.vendor ?? "", stmt.ocrData.vendor ?? "")
        );
        if (!match) {
          continue;
        }

        const stmtReceipt = currentReceipts.find((r) => r.id === stmt.id);
        const parentReceipt = currentReceipts.find((r) => r.id === match.id);
        if (!(stmtReceipt && parentReceipt)) {
          continue;
        }

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
      if (!(store.selectedCampusId && store.selectedDepartmentId)) {
        toast.error("Select campus and department before uploading receipts");
        return;
      }

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
    [
      processFile,
      reconcileBatch,
      store.selectedCampusId,
      store.selectedDepartmentId,
    ]
  );

  const hasReceiptsInProgress = () =>
    store.receipts.some((receipt) => receipt.status !== "ready");

  const buildExpensePayload = () => ({
    ...(store.expenseId ? { expenseId: store.expenseId } : {}),
    campus: store.selectedCampusId,
    department: store.selectedDepartmentId,
    bank_account: store.profile.bank_account || "",
    description: store.description,
    total: store.totalAmount(),
    prepayment_amount: 0,
    eventName: "",
    submitter_is_financial_manager: store.submitterIsFinancialManager,
    expenseAttachments: store.receipts.map((receipt, index) => ({
      date: receipt.date,
      url: receipt.fileId,
      amount: receipt.amount,
      description: receipt.description,
      type: receipt.fileType,
      cost_type:
        receipt.costType ?? defaultCostTypeSlugForCategory(receipt.category),
      sort_order: index,
    })),
  });

  const handleSaveDraft = async () => {
    if (!(store.selectedCampusId && store.selectedDepartmentId)) {
      toast.error("Select campus and department before saving a draft");
      return;
    }

    if (!store.profile.bank_account) {
      toast.error("Add a bank account before saving a draft");
      return;
    }

    if (hasReceiptsInProgress()) {
      toast.error("Wait for receipt processing to finish before saving");
      return;
    }

    store.setPhase("saving");

    try {
      const result = await apiClient.fetch<{
        success: boolean;
        draft?: { $id: string };
        error?: string;
      }>("/api/expenses/draft", {
        method: "POST",
        body: buildExpensePayload(),
      });

      if (result.success && result.draft) {
        store.setExpenseId(result.draft.$id);
        toast.success("Draft saved");
      } else {
        throw new Error(result.error || "Failed to save draft");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save draft");
    } finally {
      store.setPhase("draft");
    }
  };

  const handleSubmit = async () => {
    if (!store.isReadyToSubmit()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (hasReceiptsInProgress()) {
      toast.error("Wait for receipt processing to finish before submitting");
      return;
    }

    store.setPhase("submitting");

    try {
      const result = await apiClient.fetch<{
        success: boolean;
        fetchedExpense?: { $id: string };
        error?: string;
      }>("/api/expenses/submit", {
        method: "POST",
        body: buildExpensePayload(),
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

  const hasAssignment = Boolean(
    store.selectedCampusId && store.selectedDepartmentId
  );

  if (!hasAssignment) {
    return (
      <AssignmentGate
        campuses={store.campuses}
        onAssign={handleAssign}
        onContinue={() => setMobileView("wallet")}
        selectedCampusId={store.selectedCampusId}
        selectedDepartmentId={store.selectedDepartmentId}
      />
    );
  }

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
            isSavingDraft={store.phase === "saving"}
            isSubmitting={store.phase === "submitting"}
            onAssign={handleAssign}
            onDescriptionChange={store.setDescription}
            onInsert={(afterId, receipt) =>
              store.insertReceiptAfter(afterId, receipt)
            }
            onProfileUpdate={store.setProfile}
            onSaveDraft={handleSaveDraft}
            onSelect={store.setSelectedReceiptId}
            onSubmit={handleSubmit}
            onSubmitterIsFinancialManagerChange={
              store.setSubmitterIsFinancialManager
            }
            onUpdate={(id, updates) => store.updateReceipt(id, updates)}
            receipts={store.receipts}
            selectedCampusId={store.selectedCampusId}
            selectedDepartmentId={store.selectedDepartmentId}
            selectedId={store.selectedReceiptId}
            submitterIsFinancialManager={store.submitterIsFinancialManager}
            totalAmount={store.totalAmount()}
            userProfile={store.profile}
          />
        )}
      </div>
    </div>
  );
}
