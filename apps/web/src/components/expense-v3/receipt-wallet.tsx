"use client";

import { RECEIPT_FILE_ACCEPT } from "@repo/shared/utils/expense-attachments";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, type DragEvent, useCallback, useState } from "react";
import { focusRingClass } from "./form-styles";
import type { Receipt } from "./store";

/** Shows a hidden file input's keyboard focus on the control drawn over it. */
const fileInputFocusClass =
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface";

interface ReceiptWalletProps {
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onUpload: (files: File[]) => void;
  receipts: Receipt[];
  selectedId: string | null;
}

export function ReceiptWallet({
  receipts,
  onUpload,
  onSelect,
  onRemove,
  selectedId,
}: ReceiptWalletProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onUpload(files);
      }
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        onUpload(files);
      }
      e.target.value = "";
    },
    [onUpload]
  );

  const t = useTranslations("expenses");

  return (
    <div className="flex h-full flex-col bg-surface text-ink">
      {/* Back to the list. The site header above already carries the logo. */}
      <div className="border-edge border-b px-6 py-4">
        <Link
          className={cn(
            "type-body-sm inline-flex items-center gap-2 rounded-biso-sm text-ink-muted transition-colors hover:text-ink",
            focusRingClass
          )}
          href="/fs"
        >
          <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
          {t("back")}
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-edge border-b p-6">
        <div>
          <h2 className="type-heading-section text-ink">
            {t("composer.wallet.title")}
          </h2>
          <p className="type-body-sm mt-1 text-ink-muted">
            {t("composer.wallet.count", { count: receipts.length })}
          </p>
        </div>
        {/* The file input sits over the round button and takes the click; the
            button underneath is only its drawing. */}
        <div
          className={cn(
            "group relative flex size-10 shrink-0 items-center justify-center rounded-biso-pill border border-edge text-ink transition-colors hover:border-ink-accent hover:text-ink-accent",
            fileInputFocusClass
          )}
        >
          <input
            accept={RECEIPT_FILE_ACCEPT}
            aria-label={t("composer.wallet.add")}
            className="absolute inset-0 cursor-pointer opacity-0"
            multiple
            onChange={handleFileInput}
            type="file"
          />
          <Plus aria-hidden="true" className="size-4" />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {receipts
              .filter((r) => !r.parentId)
              .map((receipt) => (
                <div className="space-y-2" key={receipt.id}>
                  <ReceiptItem
                    isSelected={selectedId === receipt.id}
                    onClick={() => onSelect(receipt.id)}
                    onRemove={() => onRemove(receipt.id)}
                    receipt={receipt}
                  />
                  {/* Render children (Bank Statements) */}
                  {receipts
                    .filter((child) => child.parentId === receipt.id)
                    .map((child) => (
                      <div className="relative pl-6" key={child.id}>
                        {/* Connector Line */}
                        <div
                          aria-hidden="true"
                          className="absolute top-[-10px] bottom-1/2 left-3 w-px rounded-bl-biso-md border-edge border-b border-l bg-edge"
                        />

                        <ReceiptItem
                          isChild
                          isSelected={selectedId === child.id}
                          onClick={() => onSelect(child.id)}
                          onRemove={() => onRemove(child.id)}
                          receipt={child}
                        />
                      </div>
                    ))}
                </div>
              ))}
          </AnimatePresence>

          {/* Empty State / Drop Target */}
          {receipts.length === 0 && (
            <div
              className={cn(
                "relative flex h-64 flex-col items-center justify-center gap-3 rounded-biso-md border-2 border-edge border-dashed text-ink-muted transition-colors hover:border-ink-muted hover:bg-ink-muted/8",
                fileInputFocusClass,
                isDragActive && "border-action bg-action/10 text-ink"
              )}
            >
              {/* The input covers the whole zone, so it is what a drag lands
                  on; it takes the drop handlers itself. */}
              <input
                accept={RECEIPT_FILE_ACCEPT}
                aria-label={t("composer.wallet.add")}
                className="absolute inset-0 cursor-pointer opacity-0"
                multiple
                onChange={handleFileInput}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                type="file"
              />
              <Upload aria-hidden="true" className="size-6" />
              <p className="type-body-sm">{t("composer.wallet.dropzone")}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ReceiptItem({
  receipt,
  isSelected,
  onClick,
  onRemove,
  isChild,
}: {
  receipt: Receipt;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  isChild?: boolean;
}) {
  const t = useTranslations("expenses");
  const locale = useLocale();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className={cn(
        "group relative overflow-hidden rounded-biso-md border bg-surface-raised transition-colors",
        isSelected
          ? "border-action ring-1 ring-action"
          : "border-edge hover:border-ink-muted",
        isChild && "origin-left scale-95 border-l-2 border-l-ink-muted"
      )}
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      layout
      onClick={onClick}
    >
      {/* The card is the selection target; this button gives it a keyboard
          stop and a name. Its click bubbles to the card's own handler. */}
      <button
        aria-current={isSelected ? "true" : undefined}
        className={cn(
          "flex w-full gap-3 p-3 pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
          isChild && "py-2"
        )}
        type="button"
      >
        {/* Thumbnail */}
        <span className="relative block size-16 shrink-0 overflow-hidden rounded-biso-sm bg-surface-sunken">
          {receipt.fileType.startsWith("image/") ? (
            <Image
              alt={t("composer.wallet.thumbnailAlt")}
              className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
              height={64}
              src={receipt.fileUrl}
              unoptimized
              width={64}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <FileText aria-hidden="true" className="size-6 text-ink-muted" />
            </span>
          )}

          {/* Status Overlay */}
          {receipt.status === "processing" && (
            <span
              className="absolute inset-0 flex items-center justify-center bg-surface/70"
              data-surface="deep"
            >
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin text-ink"
              />
            </span>
          )}
        </span>

        {/* Info */}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span
            className={cn(
              "type-body-sm wrap-break-word line-clamp-2 leading-tight",
              receipt.description
                ? "font-semibold text-ink"
                : "text-ink-muted italic"
            )}
          >
            {receipt.description || t("composer.wallet.scanning")}
          </span>

          <span className="flex items-center justify-between gap-2">
            <span className="type-data truncate text-ink-muted text-xs">
              {receipt.date || t("composer.wallet.datePending")}
            </span>
            {receipt.amount > 0 && (
              <span className="type-data shrink-0 text-ink text-xs">
                {receipt.amount.toLocaleString(locale)} NOK
              </span>
            )}
          </span>
        </span>
      </button>

      {/* Actions */}
      <button
        aria-label={t("composer.wallet.remove")}
        className={cn(
          "absolute top-2 right-2 rounded-biso-sm p-1 text-ink-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
          focusRingClass
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        type="button"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
      </button>

      {/* Progress Bar */}
      {receipt.status !== "ready" && receipt.status !== "error" && (
        <div aria-hidden="true" className="h-1 w-full bg-surface-sunken">
          <motion.div
            animate={{ width: `${receipt.progress}%` }}
            className="h-full bg-action"
            initial={{ width: 0 }}
          />
        </div>
      )}
    </motion.div>
  );
}
