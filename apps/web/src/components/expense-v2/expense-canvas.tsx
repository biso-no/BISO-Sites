"use client";

import type { Campus, Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
 ArrowLeft,
 ArrowRight,
 Check,
 CreditCard,
 Loader2,
 Receipt,
 ReceiptText,
 Send,
 Sparkles,
 Upload,
 Wallet,
 Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import {
 createExpense,
 createExpenseAttachment,
 uploadExpenseAttachment,
} from "@/lib/actions/expense";
import { generateExpenseDescription } from "@/lib/actions/expense-ocr";
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

// Hero header matching app design language
function ExpenseHeader() {
 return (
 <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] py-8 text-white">
 <div className="mx-auto max-w-7xl px-4">
 <Link
 className="mb-6 flex items-center gap-2 text-white/80 transition-colors hover:text-white"
 href="/member"
 >
 <ArrowLeft className="h-5 w-5" />
 Back to Portal
 </Link>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white/20 bg-background/10 backdrop-blur-sm">
 <Receipt className="h-8 w-8 text-white" />
 </div>
 <div>
 <h1 className="mb-1 font-bold text-3xl text-white">
 Submit Expense
 </h1>
 <p className="text-white/80">
 Upload receipts and let AI do the heavy lifting
 </p>
 </div>
 </div>

 <div className="hidden items-center gap-3 md:flex">
 <Card className="border-white/20 /10 px-4 py-2 backdrop-blur-sm">
 <div className="flex items-center gap-2 text-white">
 <Zap className="h-4 w-4 text-yellow-300" />
 <span className="text-sm">AI-Powered</span>
 </div>
 </Card>
 </div>
 </div>
 </div>
 </div>
 );
}

// Feature highlights for empty state
function FeatureHighlights() {
 const features = [
 {
 icon: Upload,
 title: "Drop & Go",
 description: "Just drop your receipts - we handle the rest",
 },
 {
 icon: Sparkles,
 title: "AI Extraction",
 description: "Automatic amount, date & vendor detection",
 },
 {
 icon: Wallet,
 title: "Quick Reimbursement",
 description: "Submit in seconds, get paid faster",
 },
 ];

 return (
 <div className="grid gap-4 md:grid-cols-3">
 {features.map((feature, index) => (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 20 }}
 key={feature.title}
 transition={{ delay: index * 0.1 }}
 >
 <Card className="border-primary/10 p-4 transition-all hover:border-primary/20 hover:shadow-md dark:bg-inverted">
 <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
 <feature.icon className="h-5 w-5 text-primary" />
 </div>
 <h3 className="mb-1 font-semibold text-sm">{feature.title}</h3>
 <p className="text-muted-foreground text-xs">
 {feature.description}
 </p>
 </Card>
 </motion.div>
 ))}
 </div>
 );
}

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
 <span className="hidden sm:inline">{phase.label}</span>
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
 <div className="-right-8 -top-8 absolute h-32 w-32 rounded-full bg-background/10" />
 <div className="-bottom-4 -left-4 absolute h-20 w-20 rounded-full bg-background/5" />

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
 // Step 1: Upload to storage
 const uploadFormData = new FormData();
 uploadFormData.append("file", file);
 store.updateReceipt(tempId, { progress: 20 });

 const uploadResult = await uploadExpenseAttachment(uploadFormData);
 const uploadedFile = uploadResult.success ? uploadResult.file : null;

 if (!uploadedFile) {
 store.updateReceipt(tempId, {
 status: "error",
 error: uploadResult.error || "Upload failed",
 });
 return;
 }

 const fileId = uploadedFile.$id;
 const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

 store.updateReceipt(tempId, {
 fileId,
 fileUrl,
 progress: 50,
 status: "processing",
 });

 // Step 2: OCR via API route
 const ocrFormData = new FormData();
 ocrFormData.append("file", file);

 const ocrResponse = await fetch("/api/expenses/ocr", {
 method: "POST",
 body: ocrFormData,
 });

 store.updateReceipt(tempId, { progress: 80 });

 if (!ocrResponse.ok) {
 const errorData = await ocrResponse.json();
 throw new Error(errorData.error || "OCR processing failed");
 }

 const ocrResult = await ocrResponse.json();
 updateReceiptWithOcrResult(store, tempId, file.name, ocrResult);
 } catch (error) {
 store.updateReceipt(tempId, {
 status: "error",
 error: error instanceof Error ? error.message : "Processing failed",
 });
 }
}

type OcrApiResponse = {
 success: boolean;
 data: {
 description: string | null;
 amount: number | null;
 currency: string | null;
 date: string | null;
 vendor: string | null;
 };
 rawText: string;
 method: "pdf" | "ocr";
};

function updateReceiptWithOcrResult(
 store: ExpenseStore,
 tempId: string,
 fileName: string,
 ocrResult: OcrApiResponse
): void {
 const data = ocrResult.data;
 const hasData = data.amount !== null || data.description !== null;

 // Build description from vendor + AI description or fallback
 const description =
 data.vendor && data.description
 ? `${data.vendor}: ${data.description}`
 : data.description || data.vendor || `Receipt from ${fileName}`;

 store.updateReceipt(tempId, {
 status: "ready",
 progress: 100,
 description,
 amount: data.amount ?? 0,
 date: data.date || new Date().toISOString().split("T")[0] || "",
 confidence: hasData ? 0.8 : 0.3,
 currency: data.currency || "NOK",
 });
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

 const hasReceipts = receipts.length > 0;

 return (
 <div className="min-h-screen bg-linear-to-b from-section to-background dark:from-background dark:to-card">
 {/* Hero Header */}
 <ExpenseHeader />

 {/* Main Content */}
 <div className="mx-auto max-w-7xl px-4 py-8">
 {/* Phase indicator - only show when we have receipts */}
 <AnimatePresence>
 {hasReceipts && (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="mb-8"
 exit={{ opacity: 0, y: -10 }}
 initial={{ opacity: 0, y: -10 }}
 >
 <PhaseIndicator currentPhase={currentPhase} />
 </motion.div>
 )}
 </AnimatePresence>

 {/* Empty state - feature highlights */}
 <AnimatePresence>
 {!hasReceipts && (
 <motion.div
 animate={{ opacity: 1 }}
 className="mb-8"
 exit={{ opacity: 0 }}
 initial={{ opacity: 0 }}
 >
 <FeatureHighlights />
 </motion.div>
 )}
 </AnimatePresence>

 {/* Main content grid */}
 <div className="grid gap-8 lg:grid-cols-5">
 {/* Left column - Drop zone and Receipts */}
 <div
 className={cn(
 "space-y-6",
 hasReceipts ? "lg:col-span-3" : "lg:col-span-5"
 )}
 >
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

 {/* Right column - Summary & Actions (only when we have receipts) */}
 <AnimatePresence>
 {hasReceipts && (
 <motion.div
 animate={{ opacity: 1, x: 0 }}
 className="space-y-4 lg:col-span-2"
 exit={{ opacity: 0, x: 20 }}
 initial={{ opacity: 0, x: 20 }}
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
 <Card className="border-primary/10 p-4 dark:bg-inverted">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
 <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-muted-foreground text-xs">
 Reimbursement to
 </p>
 <p className="truncate font-medium font-mono text-sm">
 {profile.bank_account}
 </p>
 </div>
 <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
 <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
 </div>
 </div>
 </Card>
 )}

 {/* Submit button */}
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 10 }}
 transition={{ delay: 0.1 }}
 >
 <Button
 className="w-full gap-2 py-6 text-lg"
 disabled={!canSubmit || phase === "submitting"}
 onClick={handleSubmit}
 size="lg"
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
