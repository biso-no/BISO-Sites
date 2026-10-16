"use client";

import type {
  Campus,
  ExpenseAttachments,
  Expenses,
  Users,
} from "@repo/api/types/appwrite";
import { trackEvent } from "@repo/shared/utils/analytics";
import { defaultCostTypeSlugForCategory } from "@repo/shared/utils/expense-cost-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, ArrowRight, Check, FileText, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { apiClient } from "@/lib/api-client";
import { DepartmentCombobox } from "./department-combobox";
import { ExpenseReport } from "./expense-report";
import {
  fieldLabelClass,
  primaryActionClass,
  secondaryActionClass,
  selectContentClass,
  selectItemClass,
  selectTriggerClass,
} from "./form-styles";
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
  const t = useTranslations("expenses");
  const campusFieldId = useId();
  const departmentFieldId = useId();
  const selectedCampus = campuses.find(
    (campus) => campus.$id === selectedCampusId
  );
  const departments = (selectedCampus?.departments ?? []).filter(
    (department) => department.active !== false
  );
  const canContinue = Boolean(selectedCampusId && selectedDepartmentId);

  // The composer's first step, drawn as the redesign's centred status panel:
  // a bordered surface, the page's only <h1>, labelled fields, one CTA.
  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-surface-sunken p-4">
      <div className="w-full max-w-xl rounded-biso-md border border-edge bg-surface-raised p-6 sm:p-10">
        <h1 className="type-display-sm break-words text-ink">
          {t("composer.gate.title")}
        </h1>
        <p className="type-body mt-3 text-ink-muted">
          {t("composer.gate.body")}
        </p>

        <div className="mt-8 space-y-5">
          <div className="space-y-2">
            <label className={fieldLabelClass} htmlFor={campusFieldId}>
              {t("detail.campus")}
            </label>
            <Select
              onValueChange={(campusId) => onAssign(campusId, "")}
              value={selectedCampusId}
            >
              <SelectTrigger className={selectTriggerClass} id={campusFieldId}>
                <SelectValue placeholder={t("composer.campusPlaceholder")} />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {campuses.map((campus) => (
                  <SelectItem
                    className={selectItemClass}
                    key={campus.$id}
                    value={campus.$id}
                  >
                    {campus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass} htmlFor={departmentFieldId}>
              {t("detail.department")}
            </label>
            <DepartmentCombobox
              defaultValue={selectedDepartmentId}
              disabled={!selectedCampusId}
              id={departmentFieldId}
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
        </div>

        {canContinue && (
          <p className="type-body-sm mt-6 flex items-center gap-2 rounded-biso-md bg-success/10 px-3 py-2 text-success">
            <Check aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              {selectedCampus?.name} —{" "}
              {
                departments.find(
                  (department) => department.$id === selectedDepartmentId
                )?.Name
              }
            </span>
          </p>
        )}

        <div className="mt-8 flex justify-end">
          <button
            className={primaryActionClass}
            disabled={!canContinue}
            onClick={onContinue}
            type="button"
          >
            {t("composer.gate.continue")}
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** One of the two view toggles above the panes on small screens. */
function mobileTabClass(active: boolean): string {
  return cn(
    "type-body-sm flex flex-1 items-center justify-center gap-2 border-b-2 py-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
    active
      ? "border-action text-ink"
      : "border-transparent text-ink-muted hover:bg-ink-muted/8 hover:text-ink"
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
  | "submitter_is_financial_manager"
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
  const t = useTranslations("expenses");
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
    store.setSubmitterIsFinancialManager(
      Boolean(initialDraft.submitter_is_financial_manager)
    );

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
    store.setSubmitterIsFinancialManager,
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
        toast.error(t("composer.toast.receiptFailed"));
        return null;
      }
    },
    [store, ocrEnabled, t]
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
          t("composer.toast.statementLinked", {
            name:
              parentReceipt.vendor ||
              t("composer.toast.statementLinkedFallback"),
          })
        );
      }
    },
    [store, t]
  );

  const handleUpload = useCallback(
    (files: File[]) => {
      if (!(store.selectedCampusId && store.selectedDepartmentId)) {
        toast.error(t("composer.toast.selectBeforeUpload"));
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
      t,
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
      toast.error(t("composer.toast.selectBeforeDraft"));
      return;
    }

    if (!store.profile.bank_account) {
      toast.error(t("composer.toast.bankAccountBeforeDraft"));
      return;
    }

    if (hasReceiptsInProgress()) {
      toast.error(t("composer.toast.waitBeforeSaving"));
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
        toast.success(t("composer.toast.draftSaved"));
      } else {
        throw new Error(result.error || "Failed to save draft");
      }
    } catch (error) {
      console.error(error);
      toast.error(t("composer.toast.draftFailed"));
    } finally {
      store.setPhase("draft");
    }
  };

  const handleSubmit = async () => {
    if (!store.isReadyToSubmit()) {
      toast.error(t("composer.toast.requiredFields"));
      return;
    }

    if (hasReceiptsInProgress()) {
      toast.error(t("composer.toast.waitBeforeSubmitting"));
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
        trackEvent("expense_submit", {
          campus: store.selectedCampusId ?? "",
        });
        toast.success(t("composer.toast.submitted"));
        router.push(`/fs/${result.fetchedExpense.$id}`);
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      console.error(error);
      toast.error(t("composer.toast.submitFailed"));
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
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col bg-surface text-ink md:h-[calc(100dvh-5rem)] md:flex-row md:overflow-hidden">
      {/* The panes carry section headings of their own (receipts, the
          report, a receipt's details), so the page's one <h1> sits above
          them rather than moving with whichever pane is showing. */}
      <h1 className="sr-only">{t("composer.title")}</h1>

      {/* Mobile Tab Navigation */}
      <div className="flex border-edge border-b bg-surface md:hidden">
        <button
          aria-pressed={mobileView === "wallet"}
          className={mobileTabClass(mobileView === "wallet")}
          onClick={() => setMobileView("wallet")}
          type="button"
        >
          <Wallet aria-hidden="true" className="size-4 shrink-0" />
          {t("composer.tabs.receipts")}
        </button>
        <button
          aria-pressed={mobileView === "report"}
          className={mobileTabClass(mobileView === "report")}
          onClick={() => setMobileView("report")}
          type="button"
        >
          <FileText aria-hidden="true" className="size-4 shrink-0" />
          {t("composer.tabs.report")}
        </button>
      </div>

      {/* Left Pane: Wallet */}
      <div
        className={cn(
          "w-full shrink-0 border-edge border-r bg-surface md:max-h-[calc(100dvh-5rem)] md:w-[350px] md:overflow-y-auto lg:w-[400px]",
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
          "flex-1 bg-surface-sunken md:overflow-y-auto",
          mobileView === "report" ? "block" : "hidden md:block"
        )}
      >
        {store.selectedReceiptId ? (
          <div className="relative h-full pt-16">
            <div className="absolute top-4 left-4 z-10">
              <button
                className={cn(secondaryActionClass, "bg-surface")}
                onClick={() => store.setSelectedReceiptId(null)}
                type="button"
              >
                <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
                {t("composer.backToReport")}
              </button>
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
