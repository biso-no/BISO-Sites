"use client";

import type { Campus, Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
  ReceiptText,
  Send,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import {
  createExpense,
  createExpenseAttachment,
  uploadExpenseAttachment,
} from "@/lib/actions/expense";
import {
  generateExpenseDescription,
  processReceipt,
} from "@/lib/actions/expense-ocr";
import { AiSummary } from "./ai-summary";
import { AssignmentPicker } from "./assignment-picker";
import { DropZone } from "./drop-zone";
import { ReceiptCard } from "./receipt-card";
import {
  type ExpensePhase,
  type ExpenseStore,
  type Receipt as ReceiptType,
  useExpenseStore,
} from "./store";

type ExpenseCanvasProps = {
  campuses: Campus[];
  initialProfile: Partial<Users>;
};

function PhaseIndicator({ currentPhase }: { currentPhase: string }) {
  const phases = [
    { id: "upload", label: "Upload", icon: ReceiptText },
    { id: "assign", label: "Assign", icon: CreditCard },
    { id: "confirm", label: "Submit", icon: Send },
  ];

  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center justify-center gap-2">
      {phases.map((phase, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = phase.id === currentPhase;
        const Icon = phase.icon;

        return (
          <div className="flex items-center gap-2" key={phase.id}>
            {index > 0 && (
              <motion.div
                animate={{ scaleX: isComplete ? 1 : 0.3 }}
                className={cn(
                  "h-0.5 w-8 rounded-full transition-colors",
                  isComplete ? "bg-primary" : "bg-muted"
                )}
              />
            )}
            <motion.div
              animate={{
                scale: isCurrent ? 1 : 0.95,
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all",
                isComplete && "bg-primary/10 text-primary",
                isCurrent && "bg-primary text-primary-foreground shadow-md",
                isComplete || isCurrent ? "" : "text-muted-foreground"
              )}
            >
              {isComplete ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden font-medium sm:inline">
                {phase.label}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function TotalBanner({
  total,
  receiptCount,
}: {
  total: number;
  receiptCount: number;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-primary/80 p-6 text-primary-foreground"
      initial={{ opacity: 0, y: 20 }}
    >
      {/* Decorative elements */}
      <div className="-right-8 -top-8 absolute h-32 w-32 rounded-full bg-white/10" />
      <div className="-bottom-4 -left-4 absolute h-20 w-20 rounded-full bg-white/5" />

      <div className="relative">
        <p className="mb-1 text-primary-foreground/80 text-sm">
          Total Reimbursement
        </p>
        <motion.p
          animate={{ scale: 1 }}
          className="font-bold text-4xl tracking-tight"
          initial={{ scale: 1.1 }}
          key={total}
        >
          {total.toLocaleString("nb-NO")}{" "}
          <span className="font-normal text-2xl">NOK</span>
        </motion.p>
        <p className="mt-2 text-primary-foreground/70 text-sm">
          {receiptCount} receipt{receiptCount !== 1 ? "s" : ""} attached
        </p>
      </div>
    </motion.div>
  );
}

// Helper function to process a single file upload
async function processReceiptFile(
  file: File,
  store: ExpenseStore
): Promise<void> {
  const tempId = uuid();
  const receipt: ReceiptType = {
    id: tempId,
    fileId: "",
    fileUrl: URL.createObjectURL(file),
    fileName: file.name,
    fileType: file.type,
    status: "uploading",
    progress: 0,
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0] || "",
    confidence: 0,
    currency: "NOK",
  };

  store.addReceipt(receipt);

  try {
    const formData = new FormData();
    formData.append("file", file);
    store.updateReceipt(tempId, { progress: 30 });

    const uploadResult = await uploadExpenseAttachment(formData);
    const uploadSuccess = uploadResult.success && uploadResult.file;

    if (!uploadSuccess) {
      store.updateReceipt(tempId, {
        status: "error",
        error: uploadResult.error || "Upload failed",
      });
      return;
    }

    const fileId = uploadResult.file.$id;
    const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

    store.updateReceipt(tempId, {
      fileId,
      fileUrl,
      progress: 60,
      status: "processing",
    });

    const ocrResult = await processReceipt(fileId, fileUrl);
    updateReceiptWithOcrResult(store, tempId, file.name, ocrResult);
  } catch (error) {
    store.updateReceipt(tempId, {
      status: "error",
      error: error instanceof Error ? error.message : "Processing failed",
    });
  }
}

function updateReceiptWithOcrResult(
  store: ExpenseStore,
  tempId: string,
  fileName: string,
  ocrResult: {
    success: boolean;
    data?: {
      description?: string | null;
      amount?: number | null;
      date?: string | null;
      confidence?: number;
      currency?: string | null;
    };
  }
): void {
  if (ocrResult.success && ocrResult.data) {
    store.updateReceipt(tempId, {
      status: "ready",
      progress: 100,
      description: ocrResult.data.description || `Receipt from ${fileName}`,
      amount: ocrResult.data.amount || 0,
      date: ocrResult.data.date || new Date().toISOString().split("T")[0] || "",
      confidence: ocrResult.data.confidence || 0,
      currency: ocrResult.data.currency || "NOK",
    });
  } else {
    store.updateReceipt(tempId, {
      status: "ready",
      progress: 100,
      description: `Receipt from ${fileName}`,
      confidence: 0.3,
    });
  }
}

async function submitExpense(
  store: ExpenseStore,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  if (!store.isReadyToSubmit()) {
    toast.error("Please complete all required fields");
    return;
  }

  store.setPhase("submitting");
  store.setSubmissionError(null);

  try {
    const attachmentIds = await createAttachmentRecords(store.receipts);
    const expenseResult = await createExpense({
      campus: store.selectedCampusId,
      department: store.selectedDepartmentId,
      bank_account: store.profile.bank_account || "",
      description: store.aiSummary || undefined,
      expenseAttachments: attachmentIds,
      total: store.totalAmount(),
    });

    handleExpenseResult(store, router, expenseResult);
  } catch (error) {
    store.setSubmissionError(
      error instanceof Error ? error.message : "Submission failed"
    );
    store.setPhase("confirm");
    toast.error("Failed to submit expense");
  }
}

async function createAttachmentRecords(
  receipts: ReceiptType[]
): Promise<string[]> {
  const attachmentIds: string[] = [];
  for (const receipt of receipts) {
    const result = await createExpenseAttachment({
      date: receipt.date,
      url: receipt.fileId,
      amount: receipt.amount,
      description: receipt.description,
      type: receipt.fileType,
    });
    if (result.success && result.attachment) {
      attachmentIds.push(result.attachment.$id);
    }
  }
  return attachmentIds;
}

function handleExpenseResult(
  store: ExpenseStore,
  router: ReturnType<typeof useRouter>,
  expenseResult: {
    success: boolean;
    expense?: { $id: string } | null;
    error?: string;
  }
): void {
  if (expenseResult.success && expenseResult.expense) {
    store.setExpenseId(expenseResult.expense.$id);
    store.setPhase("complete");
    toast.success("Expense submitted successfully!");
    setTimeout(() => {
      router.push(`/fs/${expenseResult.expense?.$id}`);
    }, 1500);
  } else {
    throw new Error(expenseResult.error || "Submission failed");
  }
}

function SubmitButtonContent({ phase }: { phase: ExpensePhase }) {
  if (phase === "submitting") {
    return (
      <>
        <Loader2 className="h-5 w-5 animate-spin" />
        Submitting...
      </>
    );
  }

  if (phase === "complete") {
    return (
      <>
        <Check className="h-5 w-5" />
        Submitted!
      </>
    );
  }

  return (
    <>
      <Sparkles className="h-5 w-5" />
      Submit Expense
      <ArrowRight className="h-5 w-5" />
    </>
  );
}

export function ExpenseCanvas({
  campuses,
  initialProfile,
}: ExpenseCanvasProps) {
  const router = useRouter();

  // Select stable references from store
  const setCampuses = useExpenseStore((s) => s.setCampuses);
  const setProfile = useExpenseStore((s) => s.setProfile);
  const receipts = useExpenseStore((s) => s.receipts);
  const phase = useExpenseStore((s) => s.phase);
  const aiSummary = useExpenseStore((s) => s.aiSummary);
  const isGeneratingSummary = useExpenseStore((s) => s.isGeneratingSummary);
  const selectedCampusId = useExpenseStore((s) => s.selectedCampusId);
  const selectedDepartmentId = useExpenseStore((s) => s.selectedDepartmentId);
  const profile = useExpenseStore((s) => s.profile);
  const setIsGeneratingSummary = useExpenseStore(
    (s) => s.setIsGeneratingSummary
  );
  const setAiSummary = useExpenseStore((s) => s.setAiSummary);
  const setAssignment = useExpenseStore((s) => s.setAssignment);
  const updateReceipt = useExpenseStore((s) => s.updateReceipt);
  const removeReceipt = useExpenseStore((s) => s.removeReceipt);
  const totalAmount = useExpenseStore((s) => s.totalAmount);
  const allReceiptsReady = useExpenseStore((s) => s.allReceiptsReady);
  const isReadyToSubmit = useExpenseStore((s) => s.isReadyToSubmit);

  // Get the full store for helper functions that need multiple operations
  const store = useExpenseStore();

  // Initialize store with campuses and profile - only run once on mount
  useEffect(() => {
    setCampuses(campuses);
    setProfile(initialProfile);
  }, [campuses, initialProfile, setCampuses, setProfile]);

  const isProcessingAny = receipts.some(
    (r) => r.status === "uploading" || r.status === "processing"
  );

  const handleFilesDropped = useCallback(
    (files: File[]) => {
      for (const file of files) {
        processReceiptFile(file, store);
      }
    },
    [store]
  );

  const handleGenerateSummary = useCallback(async () => {
    if (receipts.length === 0) {
      return;
    }

    setIsGeneratingSummary(true);

    try {
      const result = await generateExpenseDescription(
        receipts.map((r) => ({
          description: r.description,
          amount: r.amount,
          date: r.date,
        }))
      );

      if (result.success && result.description) {
        setAiSummary(result.description);
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [receipts, setIsGeneratingSummary, setAiSummary]);

  const handleSubmit = useCallback(async () => {
    await submitExpense(store, router);
  }, [store, router]);

  // Determine current phase
  const currentPhase = (() => {
    if (phase === "submitting" || phase === "complete") {
      return phase;
    }
    if (receipts.length === 0 || !allReceiptsReady()) {
      return "upload";
    }
    if (!(selectedCampusId && selectedDepartmentId)) {
      return "assign";
    }
    return "confirm";
  })();

  const canProceedToAssign = allReceiptsReady() && receipts.length > 0;
  const canSubmit = isReadyToSubmit();

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* Header */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
      >
        <h1 className="font-bold text-3xl tracking-tight">New Expense</h1>
        <p className="mt-2 text-muted-foreground">
          Upload receipts and let AI do the heavy lifting
        </p>
      </motion.div>

      {/* Phase indicator */}
      <PhaseIndicator currentPhase={currentPhase} />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column - Receipts */}
        <div className="space-y-4 lg:col-span-3">
          <DropZone
            isProcessing={isProcessingAny}
            onFilesDropped={handleFilesDropped}
            receiptCount={receipts.length}
          />

          <AnimatePresence mode="popLayout">
            {receipts.map((receipt, index) => (
              <ReceiptCard
                index={index}
                key={receipt.id}
                onRemove={() => removeReceipt(receipt.id)}
                onUpdate={(updates) => updateReceipt(receipt.id, updates)}
                receipt={receipt}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right column - Summary & Actions */}
        <div className="space-y-4 lg:col-span-2">
          <AnimatePresence mode="wait">
            {receipts.length > 0 && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
                exit={{ opacity: 0, x: 20 }}
                initial={{ opacity: 0, x: 20 }}
                key="sidebar"
              >
                <TotalBanner
                  receiptCount={receipts.length}
                  total={totalAmount()}
                />

                {canProceedToAssign && (
                  <>
                    <AiSummary
                      isGenerating={isGeneratingSummary}
                      onGenerate={handleGenerateSummary}
                      onUpdate={setAiSummary}
                      receiptCount={receipts.length}
                      summary={aiSummary}
                      totalAmount={totalAmount()}
                    />

                    <AssignmentPicker
                      campuses={campuses}
                      initialCampusId={selectedCampusId}
                      initialDepartmentId={selectedDepartmentId}
                      onComplete={setAssignment}
                    />

                    {/* Bank account info */}
                    {profile.bank_account && (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border bg-card p-4"
                        initial={{ opacity: 0, y: 10 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-xs">
                              Payment to
                            </p>
                            <p className="truncate font-mono text-sm">
                              {profile.bank_account}
                            </p>
                          </div>
                          <Check className="h-4 w-4 text-emerald-500" />
                        </div>
                      </motion.div>
                    )}

                    {/* Submit button */}
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: 10 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button
                        className="w-full gap-2"
                        disabled={!canSubmit || phase === "submitting"}
                        onClick={handleSubmit}
                        size="xl"
                        variant="gradient"
                      >
                        <SubmitButtonContent phase={phase} />
                      </Button>
                    </motion.div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
