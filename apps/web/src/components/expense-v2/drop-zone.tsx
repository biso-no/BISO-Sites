"use client";

import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, ImageIcon, Sparkles, Upload } from "lucide-react";
import { useCallback, useState } from "react";

type DropZoneProps = {
  onFilesDropped: (files: File[]) => void;
  isProcessing: boolean;
  receiptCount: number;
};

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

function DragIcon({
  isDragActive,
  isProcessing,
  isCompact,
}: {
  isDragActive: boolean;
  isProcessing: boolean;
  isCompact: boolean;
}) {
  const iconSize = isCompact ? "h-7 w-7" : "h-10 w-10";
  const smallIconSize = isCompact ? "h-5 w-5" : "h-7 w-7";

  if (isProcessing) {
    return (
      <motion.div
        animate={{ opacity: 1, scale: 1, rotate: 360 }}
        exit={{ opacity: 0, scale: 0.8 }}
        initial={{ opacity: 0, scale: 0.8 }}
        key="processing"
        transition={{
          rotate: {
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          },
        }}
      >
        <Sparkles className={cn("text-primary", iconSize)} />
      </motion.div>
    );
  }

  if (isDragActive) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: 10 }}
        key="active"
      >
        <Upload className={cn("text-primary", iconSize)} />
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-1"
      exit={{ opacity: 0, y: 10 }}
      initial={{ opacity: 0, y: -10 }}
      key="idle"
    >
      <ImageIcon className={cn("text-muted-foreground", smallIconSize)} />
      <FileText className={cn("-ml-2 text-muted-foreground", smallIconSize)} />
    </motion.div>
  );
}

function DropZoneText({
  isDragActive,
  isProcessing,
  isCompact,
  onFileInput,
}: {
  isDragActive: boolean;
  isProcessing: boolean;
  isCompact: boolean;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (isProcessing) {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        className="space-y-1"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key="processing-text"
      >
        <p className="font-medium text-foreground">
          AI is analyzing your receipts...
        </p>
        <p className="text-muted-foreground text-sm">
          Extracting amounts, dates, and descriptions
        </p>
      </motion.div>
    );
  }

  if (isDragActive) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0, y: 10 }}
        key="active-text"
      >
        <p className="font-semibold text-lg text-primary">Release to upload</p>
        <p className="text-muted-foreground text-sm">
          Your receipts will be analyzed instantly
        </p>
      </motion.div>
    );
  }

  if (isCompact) {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key="compact-text"
      >
        <p className="text-muted-foreground text-sm">
          Drop more receipts or{" "}
          <label className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">
            browse
            <input
              accept={ACCEPTED_TYPES.join(",")}
              className="sr-only"
              multiple
              onChange={onFileInput}
              type="file"
            />
          </label>
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="space-y-2"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      key="idle-text"
    >
      <p className="font-medium text-foreground text-lg">
        Drop your receipts here
      </p>
      <p className="text-muted-foreground text-sm">
        or{" "}
        <label className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">
          browse files
          <input
            accept={ACCEPTED_TYPES.join(",")}
            className="sr-only"
            multiple
            onChange={onFileInput}
            type="file"
          />
        </label>
      </p>
      <p className="mt-2 text-muted-foreground/60 text-xs">
        Supports JPEG, PNG, HEIC, and PDF
      </p>
    </motion.div>
  );
}

export function DropZone({
  onFilesDropped,
  isProcessing,
  receiptCount,
}: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const next = prev - 1;
      if (next === 0) {
        setIsDragActive(false);
      }
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      setDragCounter(0);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        ACCEPTED_TYPES.includes(file.type)
      );

      if (files.length > 0) {
        onFilesDropped(files);
      }
    },
    [onFilesDropped]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        onFilesDropped(files);
      }
      e.target.value = "";
    },
    [onFilesDropped]
  );

  const isCompact = receiptCount > 0;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-dashed bg-white transition-all duration-300 dark:bg-gray-900",
        isDragActive
          ? "border-primary bg-primary/5 shadow-[0_0_40px_rgba(var(--primary-rgb),0.15)]"
          : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30",
        isCompact ? "p-6" : "min-h-[280px] p-12"
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      layout
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Animated background gradient */}
      <motion.div
        animate={{
          opacity: isDragActive ? 1 : 0,
          scale: isDragActive ? 1.1 : 1,
        }}
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5"
        transition={{ duration: 0.3 }}
      />

      {/* Floating particles when dragging */}
      <AnimatePresence>
        {isDragActive &&
          Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              animate={{
                x: `${20 + Math.random() * 60}%`,
                y: `${20 + Math.random() * 60}%`,
                scale: [0, 1, 0.5],
                opacity: [0, 1, 0],
              }}
              className="pointer-events-none absolute h-2 w-2 rounded-full bg-primary/30"
              exit={{ scale: 0, opacity: 0 }}
              initial={{
                x: "50%",
                y: "50%",
                scale: 0,
                opacity: 0,
              }}
              key={`particle-${i}-${isDragActive}`}
              transition={{
                duration: 1.5,
                delay: i * 0.1,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeOut",
              }}
            />
          ))}
      </AnimatePresence>

      {/* Main content */}
      <motion.div
        animate={{ scale: isDragActive ? 1.02 : 1 }}
        className="relative flex flex-col items-center justify-center gap-4 text-center"
        transition={{ duration: 0.2 }}
      >
        {/* Icon container */}
        <motion.div
          animate={{
            rotate: isDragActive ? [0, -5, 5, 0] : 0,
            scale: isDragActive ? 1.1 : 1,
          }}
          className={cn(
            "relative flex items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-secondary/10",
            isCompact ? "h-14 w-14" : "h-20 w-20"
          )}
          transition={{ duration: 0.4 }}
        >
          <AnimatePresence mode="wait">
            <DragIcon
              isCompact={isCompact}
              isDragActive={isDragActive}
              isProcessing={isProcessing}
            />
          </AnimatePresence>
        </motion.div>

        {/* Text */}
        <AnimatePresence mode="wait">
          <DropZoneText
            isCompact={isCompact}
            isDragActive={isDragActive}
            isProcessing={isProcessing}
            onFileInput={handleFileInput}
          />
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
