"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { useState } from "react";

type AiSummaryProps = {
  summary: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onUpdate: (summary: string) => void;
  totalAmount: number;
  receiptCount: number;
};

export function AiSummary({
  summary,
  isGenerating,
  onGenerate,
  onUpdate,
  totalAmount,
  receiptCount,
}: AiSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localSummary, setLocalSummary] = useState(summary);

  const handleSave = () => {
    onUpdate(localSummary);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalSummary(summary);
    setIsEditing(false);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border bg-card"
      initial={{ opacity: 0, y: 20 }}
      layout
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="border-b bg-linear-to-r from-primary/5 to-secondary/5 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={isGenerating ? { rotate: 360 } : {}}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-secondary/20"
              transition={
                isGenerating
                  ? {
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }
                  : {}
              }
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </motion.div>
            <div>
              <h3 className="font-semibold">AI Summary</h3>
              <p className="text-muted-foreground text-sm">
                {receiptCount} receipt{receiptCount !== 1 ? "s" : ""} •{" "}
                {totalAmount.toLocaleString("nb-NO")} NOK
              </p>
            </div>
          </div>

          {summary && !isEditing && (
            <Button
              className="gap-2"
              disabled={isGenerating}
              onClick={onGenerate}
              size="sm"
              variant="ghost"
            >
              <RefreshCw
                className={cn("h-4 w-4", isGenerating && "animate-spin")}
              />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {!(summary || isGenerating) && (
            <motion.div
              animate={{ opacity: 1 }}
              className="text-center"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="empty"
            >
              <p className="mb-4 text-muted-foreground">
                Generate an AI-powered description for your expense report
              </p>
              <Button className="gap-2" onClick={onGenerate}>
                <Sparkles className="h-4 w-4" />
                Generate Description
              </Button>
            </motion.div>
          )}

          {isGenerating && (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-4"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="generating"
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                className="flex items-center gap-2 text-primary"
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">
                  AI is writing your summary...
                </span>
              </motion.div>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
                <motion.div
                  animate={{ x: "100%" }}
                  className="h-full bg-primary"
                  initial={{ x: "-100%" }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                />
              </div>
            </motion.div>
          )}

          {summary && !isGenerating && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, y: 10 }}
              key="summary"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    autoFocus
                    className="min-h-[100px] w-full resize-none rounded-lg border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onChange={(e) => setLocalSummary(e.target.value)}
                    value={localSummary}
                  />
                  <div className="flex justify-end gap-2">
                    <Button onClick={handleCancel} size="sm" variant="ghost">
                      <X className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} size="sm">
                      <Check className="mr-1 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="pr-8 text-foreground leading-relaxed">
                    {summary}
                  </p>
                  <button
                    className="absolute top-0 right-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                    onClick={() => {
                      setLocalSummary(summary);
                      setIsEditing(true);
                    }}
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
