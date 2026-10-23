"use client";

import { RECEIPT_FILE_ACCEPT } from "@repo/shared/utils/expense-attachments";
import {
  DEFAULT_EXPENSE_COST_TYPES,
  defaultCostTypeSlugForCategory,
} from "@repo/shared/utils/expense-cost-types";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle, Check, Loader2, Sparkles, Upload } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { Pill } from "@/components/ui/pill";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { apiClient } from "@/lib/api-client";
import {
  fieldClass,
  fieldLabelClass,
  focusRingClass,
  secondaryActionClass,
  selectContentClass,
  selectItemClass,
  selectTriggerClass,
} from "./form-styles";
import type { Receipt } from "./store";

type CostTypeSlug = (typeof DEFAULT_EXPENSE_COST_TYPES)[number]["slug"];

interface GenerativeReceiptPreviewProps {
  onInsert?: (afterId: string, receipt: Receipt) => void;
  onUpdate: (updates: Partial<Receipt>) => void;
  receipt: Receipt;
}

type UploadPhase = "uploading" | "analyzing" | null;

interface BankStatementUploadParams {
  file: File;
  /** Toast copy, translated by the caller. */
  messages: { uploadFailed: string; uploaded: string };
  onInsert?: (afterId: string, receipt: Receipt) => void;
  onUpdate: (updates: Partial<Receipt>) => void;
  receipt: Receipt;
  setUploadPhase: (phase: UploadPhase) => void;
}

async function analyzeBankStatement(file: File) {
  const ocrFormData = new FormData();
  ocrFormData.append("file", file);
  return await apiClient.fetchFormData<{
    success: boolean;
    data?: { amount?: number; amountInNok?: number; currency?: string };
  }>("/api/expenses/ocr?purpose=bank-statement", {
    method: "POST",
    body: ocrFormData,
  });
}

async function uploadBankStatement({
  file,
  messages,
  onUpdate,
  setUploadPhase,
  receipt,
  onInsert,
}: BankStatementUploadParams) {
  const formData = new FormData();
  formData.append("file", file);

  const result = await uploadExpenseAttachment(formData);
  if (!(result.success && result.file)) {
    toast.error(messages.uploadFailed);
    return;
  }

  const fileId = result.file.$id;
  const fileUrl =
    result.file.viewUrl ||
    `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

  onUpdate({
    bankStatementId: fileId,
    bankStatementName: file.name,
    bankStatementType: file.type,
  });

  setUploadPhase("analyzing");
  try {
    const ocrResult = await analyzeBankStatement(file);
    if (ocrResult.success && ocrResult.data) {
      const { amount, amountInNok, currency } = ocrResult.data;
      const nokAmount =
        !currency || currency === "NOK" ? amount : (amountInNok ?? amount);
      if (nokAmount) {
        onUpdate({ amount: Math.abs(nokAmount) });
      }
    }
  } catch {
    // OCR failure is non-fatal.
  }

  if (onInsert) {
    const statementReceipt: Receipt = {
      id: uuid(),
      fileId,
      fileUrl,
      fileName: file.name,
      fileType: file.type,
      status: "ready",
      progress: 100,
      description: `Bank Statement for: ${receipt.vendor || receipt.description || "Receipt"}`,
      amount: 0,
      date: receipt.date || new Date().toISOString().split("T")[0],
      confidence: 1,
      currency: "NOK",
      parentId: receipt.id,
    };
    onInsert(receipt.id, statementReceipt);
  }

  toast.success(messages.uploaded);
}

export function GenerativeReceiptPreview({
  receipt,
  onUpdate,
  onInsert,
}: GenerativeReceiptPreviewProps) {
  const t = useTranslations("expenses");
  // If we are in "analyzing" or "processing" state, show the generative UI
  const isProcessing =
    receipt.status === "processing" || receipt.status === "analyzing";
  const isForeign = Boolean(receipt.currency && receipt.currency !== "NOK");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);

  const handleBankStatementUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadPhase("uploading");
    try {
      await uploadBankStatement({
        file,
        messages: {
          uploadFailed: t("composer.toast.uploadFailed"),
          uploaded: t("composer.toast.statementUploaded"),
        },
        onInsert,
        onUpdate,
        receipt,
        setUploadPhase,
      });
    } catch (_error) {
      toast.error(t("composer.toast.uploadFailed"));
    } finally {
      setUploadPhase(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="h-full w-full p-4 md:p-8">
      <input
        accept={RECEIPT_FILE_ACCEPT}
        className="hidden"
        onChange={handleBankStatementUpload}
        ref={fileInputRef}
        type="file"
      />

      <Header isProcessing={isProcessing} />

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <ReceiptPreview isProcessing={isProcessing} receipt={receipt} />
          <ForeignCurrencyWarning
            isProcessing={isProcessing}
            onRemoveStatement={() =>
              onUpdate({
                bankStatementId: undefined,
                bankStatementName: undefined,
              })
            }
            onUploadClick={() => fileInputRef.current?.click()}
            receipt={receipt}
            uploadPhase={uploadPhase}
          />
        </div>

        <div className="space-y-6">
          <Field
            isLoading={isProcessing}
            label={t("composer.preview.vendor")}
            onChange={(v) => onUpdate({ vendor: v })}
            value={
              receipt.vendor ||
              (isProcessing ? "" : t("composer.preview.unknownVendor"))
            }
          />

          <Field
            isLoading={isProcessing}
            label={t("detail.date")}
            onChange={(v) => onUpdate({ date: v })}
            type="date"
            value={receipt.date}
          />

          <AmountFields
            isForeign={isForeign}
            isProcessing={isProcessing}
            onUpdate={onUpdate}
            receipt={receipt}
          />

          <CostTypeField
            isProcessing={isProcessing}
            onUpdate={onUpdate}
            receipt={receipt}
          />

          <DescriptionField
            isProcessing={isProcessing}
            onUpdate={onUpdate}
            receipt={receipt}
          />
        </div>
      </div>
    </div>
  );
}

function Header({ isProcessing }: { isProcessing: boolean }) {
  const t = useTranslations("expenses");
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h2 className="type-display-sm text-ink">
        {t("composer.preview.title")}
      </h2>
      {isProcessing ? (
        <Pill tone="accent">
          <Sparkles aria-hidden="true" className="size-3 animate-pulse" />
          {t("composer.preview.analyzing")}
        </Pill>
      ) : (
        <Pill tone="success">
          <Sparkles aria-hidden="true" className="size-3" />
          {t("composer.preview.extracted")}
        </Pill>
      )}
    </div>
  );
}

function ReceiptPreview({
  receipt,
  isProcessing,
}: {
  receipt: Receipt;
  isProcessing: boolean;
}) {
  const t = useTranslations("expenses");
  return (
    <div className="relative aspect-3/4 overflow-hidden rounded-biso-md border border-edge bg-surface-sunken">
      {receipt.fileType.startsWith("image/") ? (
        <Image
          alt={t("composer.preview.imageAlt")}
          className="h-full w-full object-contain"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          src={receipt.fileUrl}
          unoptimized
        />
      ) : (
        <div className="type-body-sm flex h-full w-full items-center justify-center text-ink-muted">
          {t("composer.preview.noPreview")}
        </div>
      )}

      {/* The scanner line: a busy indicator, shown only while OCR runs. */}
      {isProcessing && (
        <motion.div
          animate={{ top: ["0%", "100%"] }}
          aria-hidden="true"
          className="absolute inset-x-0 h-1 bg-action"
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 2,
            ease: "linear",
          }}
        />
      )}
    </div>
  );
}

interface ForeignCurrencyWarningProps {
  isProcessing: boolean;
  onRemoveStatement: () => void;
  onUploadClick: () => void;
  receipt: Receipt;
  uploadPhase: "uploading" | "analyzing" | null;
}

function UploadPhaseIcon({ uploadPhase }: { uploadPhase: UploadPhase }) {
  if (uploadPhase === "analyzing") {
    return <Sparkles aria-hidden="true" className="size-3 animate-spin" />;
  }
  if (uploadPhase === "uploading") {
    return <Loader2 aria-hidden="true" className="size-3 animate-spin" />;
  }
  return <Upload aria-hidden="true" className="size-3" />;
}

function ForeignCurrencyWarning({
  receipt,
  isProcessing,
  uploadPhase,
  onUploadClick,
  onRemoveStatement,
}: ForeignCurrencyWarningProps) {
  const t = useTranslations("expenses");
  const shouldShow =
    !isProcessing && receipt.currency && receipt.currency !== "NOK";
  if (!shouldShow) {
    return null;
  }

  const hasStatement = Boolean(receipt.bankStatementId);
  let uploadLabel = t("composer.preview.uploadStatement");
  if (uploadPhase === "analyzing") {
    uploadLabel = t("composer.preview.analyzingStatement");
  } else if (uploadPhase === "uploading") {
    uploadLabel = t("composer.preview.uploading");
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="rounded-biso-md border border-warning/30 bg-warning/10 p-4"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <div className="type-body-sm min-w-0 flex-1 space-y-2 text-ink">
          <p className="font-semibold">
            {t("composer.preview.foreignTitle", {
              currency: receipt.currency,
            })}
          </p>
          <p>
            {t("composer.preview.foreignBody", {
              rate: String(receipt.exchangeRate),
            })}
          </p>

          {hasStatement ? (
            <div className="flex items-center gap-2 font-semibold text-success">
              <Check aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">
                {receipt.bankStatementName ||
                  t("composer.preview.statementAttached")}
              </span>
              <button
                className={cn(
                  "ml-auto shrink-0 rounded-biso-sm font-normal text-ink-muted underline underline-offset-4 hover:text-ink hover:no-underline",
                  focusRingClass
                )}
                onClick={onRemoveStatement}
                type="button"
              >
                {t("composer.preview.removeStatement")}
              </button>
            </div>
          ) : (
            <button
              className={cn(secondaryActionClass, "w-full bg-surface")}
              disabled={uploadPhase !== null}
              onClick={onUploadClick}
              type="button"
            >
              <UploadPhaseIcon uploadPhase={uploadPhase} />
              {uploadLabel}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface AmountFieldsProps {
  isForeign: boolean;
  isProcessing: boolean;
  onUpdate: (updates: Partial<Receipt>) => void;
  receipt: Receipt;
}

function AmountFields({
  receipt,
  isProcessing,
  isForeign,
  onUpdate,
}: AmountFieldsProps) {
  const t = useTranslations("expenses");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        isLoading={isProcessing}
        label={
          isForeign
            ? t("composer.preview.amountEstimated")
            : t("composer.preview.amount")
        }
        onChange={(v) => onUpdate({ amount: Number(v) })}
        type="number"
        value={receipt.amount || ""}
      />

      {isForeign && (
        <Field
          isLoading={isProcessing}
          label={t("composer.preview.originalAmount", {
            currency: receipt.currency,
          })}
          onChange={(v) => {
            const original = Number(v);
            const updates: Partial<Receipt> = {
              originalAmount: original,
            };
            if (receipt.exchangeRate) {
              updates.amount = Number(
                (original * receipt.exchangeRate).toFixed(2)
              );
            }
            onUpdate(updates);
          }}
          type="number"
          value={receipt.originalAmount || ""}
        />
      )}
    </div>
  );
}

interface CostTypeFieldProps {
  isProcessing: boolean;
  onUpdate: (updates: Partial<Receipt>) => void;
  receipt: Receipt;
}

function CostTypeField({
  receipt,
  isProcessing,
  onUpdate,
}: CostTypeFieldProps) {
  const t = useTranslations("expenses");
  const fieldId = useId();
  const costTypeLabels: Record<CostTypeSlug, string> = {
    travel: t("composer.costTypes.travel"),
    social: t("composer.costTypes.social"),
    academic: t("composer.costTypes.academic"),
    other: t("composer.costTypes.other"),
  };
  // Default from the AI category, but the user can override per receipt — this
  // decides which GL account the line is booked to when posted to the ledger.
  const value =
    receipt.costType ?? defaultCostTypeSlugForCategory(receipt.category);

  return (
    <div className="space-y-2">
      <label className={fieldLabelClass} htmlFor={fieldId}>
        {t("composer.preview.costType")}
      </label>
      {isProcessing ? (
        <div className="h-10 w-full animate-pulse rounded-biso-sm bg-surface-sunken" />
      ) : (
        <Select
          onValueChange={(costType) => onUpdate({ costType })}
          value={value}
        >
          <SelectTrigger className={selectTriggerClass} id={fieldId}>
            <SelectValue
              placeholder={t("composer.preview.costTypePlaceholder")}
            />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {DEFAULT_EXPENSE_COST_TYPES.map((costType) => (
              <SelectItem
                className={selectItemClass}
                key={costType.slug}
                value={costType.slug}
              >
                {costTypeLabels[costType.slug]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

interface DescriptionFieldProps {
  isProcessing: boolean;
  onUpdate: (updates: Partial<Receipt>) => void;
  receipt: Receipt;
}

function DescriptionField({
  receipt,
  isProcessing,
  onUpdate,
}: DescriptionFieldProps) {
  const t = useTranslations("expenses");
  const fieldId = useId();
  return (
    <div className="space-y-2">
      <label className={fieldLabelClass} htmlFor={fieldId}>
        {t("composer.report.description")}
      </label>
      {isProcessing ? (
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded-biso-sm bg-surface-sunken" />
          <div className="h-4 w-1/2 animate-pulse rounded-biso-sm bg-surface-sunken" />
        </div>
      ) : (
        <Textarea
          className={cn(fieldClass, "type-body resize-none p-4")}
          id={fieldId}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={3}
          value={receipt.description}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  isLoading,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  isLoading: boolean;
  onChange: (value: string) => void;
  type?: string;
}) {
  const fieldId = useId();
  return (
    <div className="space-y-2">
      <label className={fieldLabelClass} htmlFor={fieldId}>
        {label}
      </label>

      <div className="relative min-h-[40px]">
        {isLoading ? (
          <div className="flex h-10 w-full animate-pulse items-center rounded-biso-sm bg-surface-sunken px-3">
            <div className="h-4 w-24 rounded-biso-sm bg-ink-muted/20" />
          </div>
        ) : (
          // Skeleton to content: the one state change this field animates.
          <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
            <Input
              className={cn(fieldClass, "h-10 px-3 font-semibold")}
              id={fieldId}
              onChange={(e) => onChange(e.target.value)}
              type={type}
              value={value}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
