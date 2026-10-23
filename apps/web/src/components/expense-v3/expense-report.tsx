"use client";

import type { Campus, Users } from "@repo/api/types/appwrite";
import { RECEIPT_FILE_ACCEPT } from "@repo/shared/utils/expense-attachments";
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
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { v4 as uuid } from "uuid";
import { Pill } from "@/components/ui/pill";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { apiClient } from "@/lib/api-client";
import { DepartmentCombobox } from "./department-combobox";
import {
  fieldClass,
  fieldLabelClass,
  focusRingClass,
  primaryActionClass,
  secondaryActionClass,
  selectContentClass,
  selectItemClass,
  selectTriggerClass,
} from "./form-styles";
import { ProfileCompletionBanner } from "./profile-completion-banner";
import type { Receipt } from "./store";

type UploadState = { id: string; phase: "uploading" | "analyzing" } | null;
type UploadPhase = NonNullable<UploadState>["phase"];

// Oslo: the only campus with the department financial-manager approval step.
const OSLO_CAMPUS_ID = "1";
// Ledelsen Oslo: the leadership unit has no separate financial manager — the
// campus controller approves directly — so the toggle is irrelevant there.
const LEDELSEN_OSLO_DEPARTMENT_ID = "2";

interface ReceiptRowProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Receipt>) => void;
  receipt: Receipt;
  selectedId: string | null;
  setUploadState: (state: UploadState) => void;
  uploadState: UploadState;
}

function ReceiptRow({
  receipt,
  selectedId,
  onSelect,
  onUpdate,
  uploadState,
  setUploadState,
  fileInputRef,
}: ReceiptRowProps) {
  const t = useTranslations("expenses");
  const isForeign = receipt.currency && receipt.currency !== "NOK";
  const isAnalyzing =
    uploadState?.id === receipt.id && uploadState.phase === "analyzing";
  const isReady = receipt.status === "ready";

  return (
    <motion.tr
      animate={{ opacity: 1 }}
      className={cn(
        "group cursor-pointer transition-colors hover:bg-ink-muted/8",
        selectedId === receipt.id && "bg-action/10"
      )}
      initial={{ opacity: 0 }}
      key={receipt.id}
      layout
      onClick={() => onSelect(receipt.id)}
    >
      <td className="p-0" colSpan={3}>
        <div className="flex w-full items-center px-0 py-4">
          <div className="w-full max-w-50 px-4 md:max-w-75 md:px-8">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-biso-pill",
                  isReady ? "bg-success" : "animate-pulse bg-warning"
                )}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                {/* The row is the mouse target; this is its keyboard stop. */}
                <button
                  className={cn(
                    "block max-w-full truncate rounded-biso-sm text-left font-semibold text-ink",
                    focusRingClass
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(receipt.id);
                  }}
                  type="button"
                >
                  {receipt.vendor ||
                    receipt.description ||
                    t("composer.report.processing")}
                  <span className="sr-only">
                    {" "}
                    (
                    {isReady
                      ? t("composer.report.statusReady")
                      : t("composer.report.statusProcessing")}
                    )
                  </span>
                </button>
                {/* Show date on mobile only */}
                <div className="type-data block text-ink-muted text-xs md:hidden">
                  {receipt.date || "-"}
                </div>
              </div>
            </div>
            {receipt.status === "analyzing" && (
              <div
                aria-hidden="true"
                className="mt-1 ml-5 h-1 w-24 overflow-hidden rounded-biso-pill bg-surface-sunken"
              >
                <div className="h-full w-full animate-pulse bg-action" />
              </div>
            )}
          </div>
          <div className="type-data hidden flex-1 px-4 text-ink-muted md:block">
            {receipt.date || "-"}
          </div>
          <div className="type-data w-[150px] px-4 text-right md:px-8">
            <ReceiptAmount isAnalyzing={isAnalyzing} receipt={receipt} />
          </div>
        </div>

        {/* Foreign Currency Warning Row */}
        {isForeign && (
          <ForeignCurrencyWarning
            fileInputRef={fileInputRef}
            onUpdate={onUpdate}
            receipt={receipt}
            setUploadState={setUploadState}
            uploadState={uploadState}
          />
        )}
      </td>
    </motion.tr>
  );
}

function ReceiptAmount({
  receipt,
  isAnalyzing,
}: {
  receipt: Receipt;
  isAnalyzing: boolean;
}) {
  const t = useTranslations("expenses");
  const locale = useLocale();

  if (isAnalyzing) {
    return (
      <span className="type-body-sm flex items-center justify-end gap-1.5 text-ink-muted text-xs">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        {t("composer.report.verifying")}
      </span>
    );
  }

  if (receipt.amount) {
    return (
      <span className="text-ink">
        {receipt.amount.toLocaleString(locale)} NOK
      </span>
    );
  }

  return "-";
}

interface ForeignCurrencyWarningProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpdate: (id: string, updates: Partial<Receipt>) => void;
  receipt: Receipt;
  setUploadState: (state: UploadState) => void;
  uploadState: UploadState;
}

function ForeignCurrencyWarning({
  receipt,
  onUpdate,
  uploadState,
  setUploadState,
  fileInputRef,
}: ForeignCurrencyWarningProps) {
  const t = useTranslations("expenses");
  const phase = uploadState?.id === receipt.id ? uploadState.phase : null;

  if (receipt.bankStatementId) {
    return (
      <div className="bg-warning/10 px-4 py-3 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="type-body-sm flex items-center gap-2 text-ink">
            <AlertTriangle
              aria-hidden="true"
              className="size-3.5 shrink-0 text-warning"
            />
            <span>{t("composer.report.verifiedByStatement")}</span>
          </div>
          <div className="type-body-sm flex items-center gap-2 rounded-biso-pill bg-success/10 px-2 py-1 font-semibold text-success">
            <Check aria-hidden="true" className="size-3 shrink-0" />
            <span className="max-w-[100px] truncate md:max-w-[200px]">
              {receipt.bankStatementName}
            </span>
            <button
              aria-label={t("composer.report.removeStatement")}
              className={cn(
                "ml-1 rounded-biso-pill p-0.5 transition-colors hover:bg-success/15",
                focusRingClass
              )}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(receipt.id, {
                  bankStatementId: undefined,
                  bankStatementName: undefined,
                });
              }}
              type="button"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  let uploadLabel = t("composer.report.uploadStatement");
  if (phase === "analyzing") {
    uploadLabel = t("composer.report.analyzing");
  } else if (phase === "uploading") {
    uploadLabel = t("composer.report.uploading");
  }

  return (
    <div className="bg-warning/10 px-4 py-3 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="type-body-sm flex items-center gap-2 text-ink">
          <AlertTriangle
            aria-hidden="true"
            className="size-3.5 shrink-0 text-warning"
          />
          <span>
            {t("composer.report.estimatedFrom", {
              currency: receipt.currency,
              rate: String(receipt.exchangeRate),
            })}
          </span>
        </div>
        <button
          className={cn(
            secondaryActionClass,
            "shrink-0 gap-1 bg-surface px-3 py-1.5"
          )}
          disabled={phase !== null}
          onClick={(e) => {
            e.stopPropagation();
            setUploadState({ id: receipt.id, phase: "uploading" });
            fileInputRef.current?.click();
          }}
          type="button"
        >
          <StatementUploadIcon phase={phase} />
          {uploadLabel}
        </button>
      </div>
    </div>
  );
}

function StatementUploadIcon({ phase }: { phase: UploadPhase | null }) {
  if (phase === "analyzing") {
    return <Sparkles aria-hidden="true" className="size-3 animate-spin" />;
  }

  if (phase === "uploading") {
    return <Loader2 aria-hidden="true" className="size-3 animate-spin" />;
  }

  return <Upload aria-hidden="true" className="size-3" />;
}

interface ExpenseReportProps {
  campuses: Campus[];
  description: string;
  isGeneratingSummary: boolean;
  isSavingDraft: boolean;
  isSubmitting: boolean;
  onAssign: (campusId: string, departmentId: string) => void;
  onDescriptionChange: (description: string) => void;
  onInsert: (afterId: string, receipt: Receipt) => void;
  onProfileUpdate: (profile: Partial<Users>) => void;
  onSaveDraft: () => void;
  onSelect: (id: string) => void;
  onSubmit: () => void;
  onSubmitterIsFinancialManagerChange: (value: boolean) => void;
  onUpdate: (id: string, updates: Partial<Receipt>) => void;
  receipts: Receipt[];
  selectedCampusId: string;
  selectedDepartmentId: string;
  selectedId: string | null;
  submitterIsFinancialManager: boolean;
  totalAmount: number;
  userProfile: Partial<Users>;
}

export function ExpenseReport({
  receipts,
  selectedId,
  onSelect,
  onUpdate,
  onInsert,
  onSubmit,
  onSaveDraft,
  isSavingDraft,
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
  submitterIsFinancialManager,
  onSubmitterIsFinancialManagerChange,
}: ExpenseReportProps) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const campusFieldId = useId();
  const departmentFieldId = useId();
  const today = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Find departments for selected campus
  const selectedCampus = campuses.find((c) => c.$id === selectedCampusId);
  const departments = selectedCampus?.departments || [];
  const hasReceiptsInProgress = receipts.some(
    (receipt) => receipt.status !== "ready"
  );
  const canSaveDraft =
    Boolean(
      selectedCampusId && selectedDepartmentId && userProfile.bank_account
    ) && !hasReceiptsInProgress;
  const canSubmit = canSaveDraft && receipts.length > 0;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>(null);

  const uploadBankStatementFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadExpenseAttachment(formData);
    if (!(result.success && result.file)) {
      throw new Error("Upload failed");
    }

    const fileId = result.file.$id;
    const fileUrl =
      result.file.viewUrl ||
      `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

    return { fileId, fileUrl };
  };

  const applyBankStatementOcr = async (file: File, receiptId: string) => {
    try {
      const ocrFormData = new FormData();
      ocrFormData.append("file", file);
      const ocrResult = await apiClient.fetchFormData<{
        success: boolean;
        data?: { amount?: number; amountInNok?: number; currency?: string };
      }>("/api/expenses/ocr?purpose=bank-statement", {
        method: "POST",
        body: ocrFormData,
      });

      if (!(ocrResult.success && ocrResult.data)) {
        return;
      }

      const { amount, amountInNok, currency } = ocrResult.data;
      const nokAmount =
        !currency || currency === "NOK" ? amount : (amountInNok ?? amount);

      if (nokAmount) {
        onUpdate(receiptId, { amount: Math.abs(nokAmount) });
      }
    } catch {
      // OCR failure is non-fatal
    }
  };

  const addBankStatementReceipt = (
    receiptId: string,
    file: File,
    fileId: string,
    fileUrl: string
  ) => {
    const parentReceipt = receipts.find((r) => r.id === receiptId);
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
  };

  const handleBankStatementUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    receiptId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadState({ id: receiptId, phase: "uploading" });
    try {
      const { fileId, fileUrl } = await uploadBankStatementFile(file);

      onUpdate(receiptId, {
        bankStatementId: fileId,
        bankStatementName: file.name,
        bankStatementType: file.type,
      });

      setUploadState({ id: receiptId, phase: "analyzing" });
      await applyBankStatementOcr(file, receiptId);
      addBankStatementReceipt(receiptId, file, fileId, fileUrl);

      toast.success(t("composer.toast.statementAdded"));
    } catch (_error) {
      toast.error(t("composer.toast.uploadFailed"));
    } finally {
      setUploadState(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <ScrollArea className="flex h-full flex-col p-4 md:p-8">
      <div>
        <input
          accept={RECEIPT_FILE_ACCEPT}
          className="hidden"
          onChange={(e) =>
            uploadState && handleBankStatementUpload(e, uploadState.id)
          }
          ref={fileInputRef}
          type="file"
        />

        {/* The report document: a bordered surface on the sunken pane. */}
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-biso-md border border-edge bg-surface-raised">
          {/* Document Header */}
          <div className="border-edge border-b p-6 md:p-8">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row">
              <div>
                <h2 className="type-display-sm text-ink">
                  {t("composer.report.title")}
                </h2>
                <p className="type-body-sm mt-2 text-ink-muted">{today}</p>
              </div>
              <Pill>{t("status.draft")}</Pill>
            </div>

            {/* User & Assignment Info */}
            <div className="grid gap-6 md:grid-cols-2">
              <dl className="space-y-4">
                <div>
                  <dt className="type-label text-ink-muted">
                    {t("composer.report.submitter")}
                  </dt>
                  <dd className="type-body-sm mt-1 font-semibold text-ink">
                    {userProfile?.name || t("composer.report.unknownUser")}
                  </dd>
                  <dd className="type-body-sm break-words text-ink-muted">
                    {userProfile?.email}
                  </dd>
                </div>
                <div>
                  <dt className="type-label text-ink-muted">
                    {t("detail.bankAccount")}
                  </dt>
                  <dd
                    className={cn(
                      "mt-1",
                      userProfile?.bank_account
                        ? "type-data text-ink"
                        : "type-body-sm text-ink-muted"
                    )}
                  >
                    {userProfile?.bank_account ||
                      t("composer.report.noBankAccount")}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3 rounded-biso-md bg-surface-sunken p-4">
                <p className="type-label text-ink-muted">
                  {t("composer.report.costAllocation")}
                </p>

                <div className="grid gap-2">
                  <label className="sr-only" htmlFor={campusFieldId}>
                    {t("detail.campus")}
                  </label>
                  <Select
                    onValueChange={(val) => onAssign(val, "")}
                    value={selectedCampusId}
                  >
                    <SelectTrigger
                      className={selectTriggerClass}
                      id={campusFieldId}
                    >
                      <SelectValue
                        placeholder={t("composer.campusPlaceholder")}
                      />
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

                  <label className="sr-only" htmlFor={departmentFieldId}>
                    {t("detail.department")}
                  </label>
                  <DepartmentCombobox
                    defaultValue={selectedDepartmentId}
                    disabled={!selectedCampusId}
                    id={departmentFieldId}
                    items={departments.map((dept) => ({
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
              <div className="mb-2 flex items-center justify-between gap-4">
                <label
                  className={fieldLabelClass}
                  htmlFor="expense-description"
                >
                  {t("composer.report.description")}
                </label>
                {isGeneratingSummary && (
                  <div className="type-body-sm flex animate-pulse items-center gap-2 text-ink-accent">
                    <Loader2
                      aria-hidden="true"
                      className="size-3 animate-spin"
                    />
                    {t("composer.report.generatingSummary")}
                  </div>
                )}
              </div>
              <Textarea
                className={cn(fieldClass, "min-h-[80px] resize-none")}
                disabled={isGeneratingSummary}
                id="expense-description"
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder={t("composer.report.descriptionPlaceholder")}
                value={description}
              />
            </div>

            {selectedCampusId === OSLO_CAMPUS_ID &&
              selectedDepartmentId !== LEDELSEN_OSLO_DEPARTMENT_ID && (
                <div className="mt-4 flex items-start justify-between gap-4 rounded-biso-md border border-edge p-4">
                  <div className="space-y-1">
                    <label
                      className="type-body-sm font-semibold text-ink"
                      htmlFor="financial-manager-toggle"
                    >
                      {t("composer.report.financialManager")}
                    </label>
                    <p
                      className="type-body-sm text-ink-muted"
                      id="financial-manager-toggle-hint"
                    >
                      {t("composer.report.financialManagerHint")}
                    </p>
                  </div>
                  {/* A native switch, as on the member portal: the shared one
                      paints its "on" state in the sky blue, under the 3:1 a
                      control's state needs against white. */}
                  <input
                    aria-checked={submitterIsFinancialManager}
                    aria-describedby="financial-manager-toggle-hint"
                    checked={submitterIsFinancialManager}
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-action focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2"
                    id="financial-manager-toggle"
                    onChange={(e) =>
                      onSubmitterIsFinancialManagerChange(e.target.checked)
                    }
                    role="switch"
                    type="checkbox"
                  />
                </div>
              )}
          </div>

          {/* Line Items */}
          <div className="flex-1 overflow-y-auto">
            <table className="type-body-sm w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface-sunken text-ink-muted">
                <tr>
                  <th className="type-label px-4 py-3 md:px-8" scope="col">
                    {t("composer.report.itemColumn")}
                  </th>
                  <th
                    className="type-label hidden px-4 py-3 md:table-cell"
                    scope="col"
                  >
                    {t("detail.date")}
                  </th>
                  <th
                    className="type-label px-4 py-3 text-right md:px-8"
                    scope="col"
                  >
                    {t("detail.amount")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {receipts.length === 0 ? (
                  <tr>
                    <td
                      className="py-12 text-center text-ink-muted"
                      colSpan={3}
                    >
                      {t("composer.report.empty")}
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
                      setUploadState={setUploadState}
                      uploadState={uploadState}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Totals */}
          <div className="border-edge border-t bg-surface-sunken p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="type-body-sm text-ink-muted">
                {t("composer.report.attachedCount", {
                  count: receipts.length,
                })}
              </p>
              <div className="flex items-end justify-between gap-4 md:block md:text-right">
                <p className="type-label text-ink-muted">
                  {t("composer.report.total")}
                </p>
                <p className="type-data mt-1 text-2xl text-ink md:text-3xl">
                  {totalAmount.toLocaleString(locale)}{" "}
                  <span className="text-ink-muted text-lg">NOK</span>
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <button
                aria-busy={isSavingDraft}
                className={cn(
                  secondaryActionClass,
                  "w-full md:w-auto md:min-w-40"
                )}
                disabled={isSavingDraft || isSubmitting || !canSaveDraft}
                onClick={onSaveDraft}
                type="button"
              >
                {isSavingDraft ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 shrink-0 animate-spin"
                    />
                    {t("composer.report.saving")}
                  </>
                ) : (
                  <>
                    <Save aria-hidden="true" className="size-4 shrink-0" />
                    {t("composer.report.saveDraft")}
                  </>
                )}
              </button>
              <button
                aria-busy={isSubmitting}
                className={cn(
                  primaryActionClass,
                  "w-full md:w-auto md:min-w-50"
                )}
                disabled={isSavingDraft || isSubmitting || !canSubmit}
                onClick={onSubmit}
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 shrink-0 animate-spin"
                    />
                    {t("composer.report.submitting")}
                  </>
                ) : (
                  <>
                    {t("composer.report.submit")}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
