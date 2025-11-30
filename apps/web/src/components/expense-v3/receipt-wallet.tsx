"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FileText, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type DragEvent, type ChangeEvent } from "react";
import type { Receipt } from "./store";
import Image from "next/image";

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
    <div className="flex h-full flex-col bg-[#0B1120] text-white">
      {/* Logo Area */}
      <div className="flex items-center justify-start gap-4 border-white/10 border-b p-6">
      <div className="flex flex-row gap-4">
        <Image 
          src="/images/logo-dark.png" 
          alt="Home Logo" 
          width={48}
          height={48}
          className="h-12 w-12 object-contain"
        />
        
        <Link 
          href="/fs" 
          className="flex items-center gap-2 text-white/60 text-lg font-medium hover:text-white transition-colors ml-auto"
        >
          <ArrowLeft className="h-6 w-6" />
          Back to expenses
        </Link>
      </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-white/10 border-b p-6">
        <div>
          <h2 className="font-medium text-lg text-white">Receipts</h2>
          <p className="text-sm text-white/40">
            {receipts.length} {receipts.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="relative">
          <input
            type="file"
            multiple
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={handleFileInput}
            accept="image/*,application/pdf"
          />
          <Button
            size="icon"
            variant="outline"
            type="button"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
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
              .filter(r => !r.parentId)
              .map((receipt) => (
                <div key={receipt.id} className="space-y-2">
                  <ReceiptItem
                    receipt={receipt}
                    isSelected={selectedId === receipt.id}
                    onClick={() => onSelect(receipt.id)}
                    onRemove={() => onRemove(receipt.id)}
                  />
                  {/* Render children (Bank Statements) */}
                  {receipts
                    .filter(child => child.parentId === receipt.id)
                    .map(child => (
                      <div key={child.id} className="pl-6 relative">
                        {/* Connector Line */}
                        <div className="absolute left-3 top-[-10px] bottom-1/2 w-px bg-white/10 rounded-bl-lg border-b border-l border-white/10" />
                        
                        <ReceiptItem
                          receipt={child}
                          isSelected={selectedId === child.id}
                          onClick={() => onSelect(child.id)}
                          onRemove={() => onRemove(child.id)}
                          isChild
                        />
                      </div>
                    ))
                  }
                </div>
            ))}
          </AnimatePresence>

          {/* Empty State / Drop Target */}
          {receipts.length === 0 && (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                "relative flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 transition-all hover:border-white/20 hover:bg-white/5",
                isDragActive && "border-sky-500 bg-sky-500/10"
              )}
            >
              <input
                type="file"
                multiple
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileInput}
                accept="image/*,application/pdf"
              />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <Upload className="h-6 w-6 text-white/40" />
              </div>
              <p className="text-sm text-white/60">Drop receipts here</p>
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
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border transition-all hover:bg-white/5",
        isSelected
          ? "border-sky-500 bg-white/5 ring-1 ring-sky-500"
          : "border-white/10 bg-white/5",
        isChild && "border-l-2 border-l-white/20 scale-95 origin-left"
      )}
      onClick={onClick}
    >
      <div className={cn("flex gap-3 p-3", isChild && "py-2")}>
        {/* Thumbnail */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/20">
          {receipt.fileType.startsWith("image/") ? (
            <img
              src={receipt.fileUrl}
              alt="Receipt"
              className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText className="h-6 w-6 text-white/40" />
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
            <p className={cn(
              "font-medium text-sm break-words line-clamp-2 leading-tight",
              receipt.description ? "text-white" : "text-white/40 italic"
            )}>
              {receipt.description || "Scanning..."}
            </p>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-mono text-xs text-white/60">
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <div className="rounded-md p-1 hover:bg-red-500/20 hover:text-red-400 text-white/40">
            <Trash2 className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>
      
      {/* Progress Bar */}
      {receipt.status !== "ready" && receipt.status !== "error" && (
        <div className="h-1 w-full bg-white/5">
          <motion.div
            className="h-full bg-sky-500"
            initial={{ width: 0 }}
            animate={{ width: `${receipt.progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
