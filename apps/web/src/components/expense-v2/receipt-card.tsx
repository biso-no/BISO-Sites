"use client";

import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  Check,
  DollarSign,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Receipt, ReceiptStatus } from "./store";

type ReceiptCardProps = {
  receipt: Receipt;
  onUpdate: (updates: Partial<Receipt>) => void;
  onRemove: () => void;
  index: number;
};

function StatusIndicator({ status }: { status: ReceiptStatus }) {
  const configs: Record<
    ReceiptStatus,
    { icon: React.ReactNode; color: string; label: string }
  > = {
    uploading: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      color: "text-blue-500",
      label: "Uploading",
    },
    processing: {
      icon: <Sparkles className="h-3.5 w-3.5 animate-pulse" />,
      color: "text-amber-500",
      label: "AI analyzing",
    },
    ready: {
      icon: <Check className="h-3.5 w-3.5" />,
      color: "text-emerald-500",
      label: "Ready",
    },
    editing: {
      icon: <Pencil className="h-3.5 w-3.5" />,
      color: "text-primary",
      label: "Editing",
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: "text-red-500",
      label: "Error",
    },
  };

  const config = configs[status];

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-1.5 font-medium text-xs",
        config.color
      )}
      initial={{ opacity: 0, scale: 0.8 }}
    >
      {config.icon}
      <span>{config.label}</span>
    </motion.div>
  );
}

function InlineEditor({
  value,
  onChange,
  type = "text",
  prefix,
  suffix,
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: "text" | "number" | "date";
  prefix?: string;
  suffix?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  const handleSave = () => {
    setIsEditing(false);
    const newValue =
      type === "number" ? Number.parseFloat(localValue) || 0 : localValue;
    onChange(newValue);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalValue(String(value));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <motion.div
        animate={{ scale: 1 }}
        className="flex items-center gap-1"
        initial={{ scale: 0.95 }}
      >
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input
          autoFocus
          className="w-full min-w-0 rounded border border-primary/30 bg-background/50 px-2 py-0.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          type={type}
          value={localValue}
        />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
        <button
          className="rounded p-0.5 text-emerald-500 hover:bg-emerald-500/10"
          onClick={handleSave}
          type="button"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          onClick={handleCancel}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <button
      className="group flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
      onClick={() => setIsEditing(true)}
      type="button"
    >
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <span className="truncate">{value}</span>
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function getConfidenceBadgeColor(confidence: number): string {
  if (confidence > 0.8) {
    return "bg-emerald-500";
  }
  if (confidence > 0.5) {
    return "bg-amber-500";
  }
  return "bg-red-500";
}

export function ReceiptCard({
  receipt,
  onUpdate,
  onRemove,
  index,
}: ReceiptCardProps) {
  const isImage = receipt.fileType.startsWith("image/");
  const isProcessing =
    receipt.status === "uploading" || receipt.status === "processing";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300",
        isProcessing
          ? "border-primary/30"
          : "border-border hover:border-primary/20 hover:shadow-md"
      )}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      layout
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Progress overlay for processing state */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 z-10"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              className="absolute inset-0 bg-linear-to-r from-primary/5 via-primary/10 to-primary/5"
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {isImage ? (
            <Image
              alt={receipt.fileName}
              className="object-cover"
              fill
              sizes="80px"
              src={receipt.fileUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Confidence indicator */}
          {receipt.status === "ready" && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "-right-1 -top-1 absolute flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px] text-white shadow",
                getConfidenceBadgeColor(receipt.confidence)
              )}
              initial={{ opacity: 0, scale: 0 }}
              transition={{ delay: 0.3 }}
            >
              {Math.round(receipt.confidence * 100)}
            </motion.div>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{receipt.fileName}</p>
              <StatusIndicator status={receipt.status} />
            </div>

            {/* Remove button */}
            <motion.button
              className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              onClick={onRemove}
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Extracted data - only show when ready */}
          <AnimatePresence>
            {receipt.status === "ready" && (
              <motion.div
                animate={{ opacity: 1, height: "auto" }}
                className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Amount */}
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <InlineEditor
                    onChange={(v) => onUpdate({ amount: Number(v) })}
                    suffix={receipt.currency || "NOK"}
                    type="number"
                    value={receipt.amount}
                  />
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <InlineEditor
                    onChange={(v) => onUpdate({ date: String(v) })}
                    type="date"
                    value={receipt.date}
                  />
                </div>

                {/* Description - full width */}
                <div className="col-span-2 mt-1">
                  <InlineEditor
                    onChange={(v) => onUpdate({ description: String(v) })}
                    value={receipt.description}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error state */}
          {receipt.status === "error" && receipt.error && (
            <motion.p
              animate={{ opacity: 1 }}
              className="text-destructive text-xs"
              initial={{ opacity: 0 }}
            >
              {receipt.error}
            </motion.p>
          )}
        </div>
      </div>

      {/* Upload progress bar */}
      {receipt.status === "uploading" && (
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-x-0 bottom-0 h-1 bg-muted"
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ width: `${receipt.progress}%` }}
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
