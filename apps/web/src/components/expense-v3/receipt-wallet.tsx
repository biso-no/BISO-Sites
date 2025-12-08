"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FileText, Plus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type DragEvent, useCallback, useState } from "react";
import type { Receipt } from "./store";
import { Input } from "@repo/ui/components/ui/input";

type ReceiptWalletProps = {
  receipts: Receipt[];
  onUpload: (files: File[]) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  selectedId: string | null;
};

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

  return (
    <div className="flex h-full flex-col bg-card text-foreground dark:bg-[#0B1120] dark:text-white">
      {/* Logo Area */}
      <div className="flex items-center justify-start gap-4 border-b border-border p-6 dark:border-white/10">
        <div className="flex flex-row gap-4">
          <>
            <Image
              alt="Home Logo"
              className="hidden h-12 w-12 object-contain dark:block"
              height={48}
              src="/images/logo-dark.png"
              width={48}
            />
            <Image
              alt="Home Logo"
              className="block h-12 w-12 object-contain dark:hidden"
              height={48}
              src="/images/logo-light.png"
              width={48}
            />
          </>

          <Link
            className="ml-auto flex items-center gap-2 font-medium text-lg text-muted-foreground transition-colors hover:text-foreground dark:text-white/60 dark:hover:text-white"
            href="/fs"
          >
            <ArrowLeft className="h-6 w-6" />
            Back to expenses
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-6 dark:border-white/10">
        <div>
          <h2 className="font-medium text-lg text-foreground dark:text-white">Receipts</h2>
          <p className="text-sm text-muted-foreground dark:text-white/40">
            {receipts.length} {receipts.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="relative">
          <Input
            accept="image/*,application/pdf"
            className="absolute inset-0 cursor-pointer opacity-0"
            multiple
            onChange={handleFileInput}
            type="file"
          />
          <Button
            className="border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/20 dark:bg-background/5 dark:text-white dark:hover:bg-background/10"
            size="icon"
            type="button"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
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
                        <div className="absolute top-[-10px] bottom-1/2 left-3 w-px rounded-bl-lg border-b border-l border-border bg-border dark:border-white/10 dark:bg-background/10" />

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
            <Card
              className={cn(
                "relative flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border transition-all hover:border-muted-foreground hover:bg-muted dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-background/5",
                isDragActive && "border-sky-500 bg-sky-500/10"
              )}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                accept="image/*,application/pdf"
                className="absolute inset-0 cursor-pointer opacity-0"
                multiple
                onChange={handleFileInput}
                type="file"
              />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted dark:bg-background/5">
                <Upload className="h-6 w-6 text-muted-foreground dark:text-white/40" />
              </div>
              <p className="text-sm text-muted-foreground dark:text-white/60">Drop receipts here</p>
            </Card>
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
  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border transition-all hover:bg-muted dark:hover:bg-background/5",
        isSelected
          ? "border-sky-500 bg-muted ring-1 ring-sky-500 dark:bg-background/5"
          : "border-border bg-muted dark:border-white/10 dark:bg-background/5",
        isChild && "origin-left scale-95 border-l-2 border-l-muted-foreground dark:border-l-white/20"
      )}
      exit={{ opacity: 0, scale: 0.9 }}
      initial={{ opacity: 0, x: -20 }}
      layout
      onClick={onClick}
    >
      <div className={cn("flex gap-3 p-3", isChild && "py-2")}>
        {/* Thumbnail */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted-foreground/10 dark:bg-black/20">
          {receipt.fileType.startsWith("image/") ? (
            <Image
              alt="Receipt"
              className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
              height={64}
              src={receipt.fileUrl}
              width={64}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground dark:text-white/40" />
            </div>
          )}

          {/* Status Overlay */}
          {receipt.status === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-6">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "wrap-break-word line-clamp-2 font-medium text-sm leading-tight",
                receipt.description
                  ? "text-foreground dark:text-white"
                  : "text-muted-foreground italic dark:text-white/40"
              )}
            >
              {receipt.description || "Scanning..."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-mono text-muted-foreground text-xs dark:text-white/60">
              {receipt.date || "Date pending"}
            </p>
            {receipt.amount > 0 && (
              <p className="shrink-0 font-medium text-emerald-400 text-xs">
                {receipt.amount.toLocaleString("nb-NO")} NOK
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <Button
          className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <div className="rounded-md p-1 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 dark:text-white/40">
            <Trash2 className="h-3.5 w-3.5" />
          </div>
        </Button>
      </div>

      {/* Progress Bar */}
      {receipt.status !== "ready" && receipt.status !== "error" && (
        <div className="h-1 w-full bg-muted dark:bg-background/5">
          <motion.div
            animate={{ width: `${receipt.progress}%` }}
            className="h-full bg-sky-500"
            initial={{ width: 0 }}
          />
        </div>
      )}
    </motion.div>
  );
}
