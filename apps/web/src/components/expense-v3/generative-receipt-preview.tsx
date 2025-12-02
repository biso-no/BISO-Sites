import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  Check,
  DollarSign,
  Globe,
  Sparkles,
  Store,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import type { Receipt } from "./store";

type GenerativeReceiptPreviewProps = {
  receipt: Receipt;
  onUpdate: (updates: Partial<Receipt>) => void;
  onInsert?: (afterId: string, receipt: Receipt) => void;
};

export function GenerativeReceiptPreview({
  receipt,
  onUpdate,
  onInsert,
}: GenerativeReceiptPreviewProps) {
  // If we are in "analyzing" or "processing" state, show the generative UI
  const isProcessing =
    receipt.status === "processing" || receipt.status === "analyzing";
  const isForeign = Boolean(receipt.currency && receipt.currency !== "NOK");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingStatement, setIsUploadingStatement] = useState(false);

  const handleBankStatementUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingStatement(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadExpenseAttachment(formData);
      if (result.success && result.file) {
        const fileId = result.file.$id;
        const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

        onUpdate({
          bankStatementId: fileId,
          bankStatementName: file.name,
          bankStatementType: file.type,
        });

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

        toast.success("Bank statement uploaded");
      } else {
        toast.error("Upload failed");
      }
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUploadingStatement(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="h-full w-full p-8">
      <input
        accept="application/pdf,image/*"
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
            isUploadingStatement={isUploadingStatement}
            onRemoveStatement={() =>
              onUpdate({
                bankStatementId: undefined,
                bankStatementName: undefined,
              })
            }
            onUploadClick={() => fileInputRef.current?.click()}
            receipt={receipt}
          />
        </div>

        <div className="space-y-6">
          <Field
            delay={0.1}
            icon={Store}
            isLoading={isProcessing}
            label="Vendor"
            onChange={(v) => onUpdate({ vendor: v })}
            value={receipt.vendor || (isProcessing ? "" : "Unknown Vendor")}
          />

          <Field
            delay={0.3}
            icon={Calendar}
            isLoading={isProcessing}
            label="Date"
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
  return (
    <div className="mb-8 flex items-center justify-between">
      <h2 className="font-semibold text-2xl tracking-tight text-foreground dark:text-white">Receipt Details</h2>
      <div className="flex items-center gap-2">
        {isProcessing ? (
          <div className="flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-600 text-xs">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Analyzing receipt...
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-600 text-xs">
            <Sparkles className="h-3 w-3" />
            AI Extracted
          </div>
        )}
      </div>
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
  return (
    <div className="relative aspect-3/4 overflow-hidden rounded-xl border border-border bg-muted dark:bg-gray-900">
      {receipt.fileType.startsWith("image/") ? (
        <Image
          alt="Receipt Preview"
          className="h-full w-full object-contain"
          fill
          src={receipt.fileUrl}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          No preview available
        </div>
      )}

      {isProcessing && (
        <motion.div
          animate={{ top: ["0%", "100%"] }}
          className="absolute inset-x-0 h-1 bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]"
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

type ForeignCurrencyWarningProps = {
  receipt: Receipt;
  isProcessing: boolean;
  isUploadingStatement: boolean;
  onUploadClick: () => void;
  onRemoveStatement: () => void;
};

function ForeignCurrencyWarning({
  receipt,
  isProcessing,
  isUploadingStatement,
  onUploadClick,
  onRemoveStatement,
}: ForeignCurrencyWarningProps) {
  const shouldShow =
    !isProcessing && receipt.currency && receipt.currency !== "NOK";
  if (!shouldShow) {
    return null;
  }

  const hasStatement = Boolean(receipt.bankStatementId);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20"
      initial={{ opacity: 0, y: 10 }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-2">
          <p className="font-medium text-amber-900 text-sm dark:text-amber-200">
            Foreign Currency Detected ({receipt.currency})
          </p>
          <p className="text-amber-700 text-xs dark:text-amber-400">
            The amount is estimated using historical rates (
            {receipt.exchangeRate}). Please upload a bank statement for the
            exact amount.
          </p>

          {hasStatement ? (
            <div className="flex items-center gap-2 font-medium text-emerald-600 text-sm">
              <Check className="h-4 w-4" />
              <span className="truncate">
                {receipt.bankStatementName || "Statement attached"}
              </span>
              <Button
                className="ml-auto text-xs underline opacity-60 hover:opacity-100"
                onClick={onRemoveStatement}
              >
                Remove
              </Button>
            </div>
          ) : (
            <Button
              className="w-full gap-2 border-amber-200 bg-white text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/50"
              disabled={isUploadingStatement}
              onClick={onUploadClick}
              size="sm"
              variant="outline"
            >
              {isUploadingStatement ? (
                <Sparkles className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {isUploadingStatement ? "Uploading..." : "Upload Bank Statement"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

type AmountFieldsProps = {
  receipt: Receipt;
  isProcessing: boolean;
  isForeign: boolean;
  onUpdate: (updates: Partial<Receipt>) => void;
};

function AmountFields({
  receipt,
  isProcessing,
  isForeign,
  onUpdate,
}: AmountFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        delay={0.5}
        icon={DollarSign}
        isLoading={isProcessing}
        label={`Amount (${isForeign ? "NOK - Est." : "NOK"})`}
        onChange={(v) => onUpdate({ amount: Number(v) })}
        type="number"
        value={receipt.amount || ""}
      />

      {isForeign && (
        <Field
          delay={0.6}
          icon={Globe}
          isLoading={isProcessing}
          label={`Original (${receipt.currency})`}
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

type DescriptionFieldProps = {
  receipt: Receipt;
  isProcessing: boolean;
  onUpdate: (updates: Partial<Receipt>) => void;
};

function DescriptionField({
  receipt,
  isProcessing,
  onUpdate,
}: DescriptionFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
        Description
      </Label>
      {isProcessing ? (
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted-foreground/20 dark:bg-gray-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted-foreground/20 dark:bg-gray-800" />
        </div>
      ) : (
        <Textarea
          className="resize-none border-0 bg-muted p-4 text-base focus-visible:ring-1 focus-visible:ring-sky-500 dark:bg-gray-900"
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={3}
          value={receipt.description}
        />
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  isLoading,
  delay,
  onChange,
  type = "text",
}: {
  icon: any;
  label: string;
  value: string | number;
  isLoading: boolean;
  delay: number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </Label>

      <div className="relative min-h-[40px]">
        {isLoading ? (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            className="flex h-10 w-full items-center rounded-md bg-muted px-3 dark:bg-gray-800"
            initial={{ opacity: 0.5 }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay,
            }}
          >
            <div className="h-4 w-24 rounded bg-muted-foreground/30 dark:bg-gray-700" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 5 }}
            transition={{ delay }}
          >
            <Input
              className="h-10 border-0 bg-muted px-3 font-medium text-lg focus-visible:ring-1 focus-visible:ring-sky-500 dark:bg-gray-900"
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
