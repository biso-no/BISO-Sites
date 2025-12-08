"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Progress } from "@repo/ui/components/ui/progress";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { ArrowLeft, Eye, Sparkles, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { uploadExpenseAttachment } from "@/lib/actions/expense";
import {
  generateExpenseDescription,
  processReceipt,
} from "@/lib/actions/expense-ocr";

type Attachment = {
  id: string;
  fileId: string;
  fileUrl: string;
  file: File;
  preview?: string;
  description: string;
  date: string;
  amount: number;
  processing: boolean;
};

type UploadStepProps = {
  onNext: (data: {
    attachments: Array<{
      id: string;
      description: string;
      date: string;
      amount: number;
    }>;
    description: string;
    total: number;
  }) => void;
  onBack: () => void;
};

export function UploadStep({ onNext, onBack }: UploadStepProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileUpload = async (files: FileList) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const tempId = Math.random().toString();
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;

      const newAttachment: Attachment = {
        id: tempId,
        fileId: "",
        fileUrl: "",
        file,
        preview,
        description: "",
        date: new Date().toISOString().split("T")[0] || "",
        amount: 0,
        processing: true,
      };

      setAttachments((prev) => [...prev, newAttachment]);

      try {
        // Upload file to storage
        const formData = new FormData();
        formData.append("file", file);
        const uploadResult = await uploadExpenseAttachment(formData);

        if (!(uploadResult.success && uploadResult.file)) {
          throw new Error("Failed to upload file");
        }

        const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${uploadResult.file.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

        // Process with OCR
        const ocrResult = await processReceipt(uploadResult.file.$id, fileUrl);

        setAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId
              ? {
                  ...att,
                  fileId: uploadResult.file?.$id,
                  fileUrl,
                  description:
                    ocrResult.data?.description || `Receipt from ${file.name}`,
                  date: ocrResult.data?.date || att.date,
                  amount: ocrResult.data?.amount || 0,
                  processing: false,
                }
              : att
          )
        );
      } catch (error) {
        console.error("Error processing file:", error);
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId
              ? {
                  ...att,
                  description: `Receipt from ${file.name}`,
                  processing: false,
                }
              : att
          )
        );
      }
    }
  };

  const handleGenerateDescription = async () => {
    const processedAttachments = attachments.filter((att) => !att.processing);

    if (processedAttachments.length === 0) {
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateExpenseDescription(processedAttachments);
      if (result.success && result.description) {
        setGeneratedDescription(result.description);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) {
        URL.revokeObjectURL(att.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const totalAmount = attachments.reduce((sum, att) => sum + att.amount, 0);
  const canProceed =
    attachments.length > 0 && attachments.every((att) => !att.processing);

  const handleNext = () => {
    if (canProceed) {
      onNext({
        attachments: attachments.map((att) => ({
          id: att.fileId,
          description: att.description,
          date: att.date,
          amount: att.amount,
        })),
        description: generatedDescription,
        total: totalAmount,
      });
    }
  };

  return (
    <Card className="border-0 p-8 shadow-lg">
      <h2 className="mb-6 text-foreground">Upload Receipts & Documents</h2>

      {/* Upload Area */}
      <div className="mb-8">
        <label className="block">
          <div className="cursor-pointer rounded-lg border-2 border-[#3DA9E0]/30 border-dashed p-12 text-center transition-all hover:border-[#3DA9E0] hover:bg-[#3DA9E0]/5">
            <Upload className="mx-auto mb-4 h-12 w-12 text-[#3DA9E0]" />
            <p className="mb-2 text-foreground">
              Click to upload or drag and drop
            </p>
            <p className="text-muted-foreground text-sm">
              PDF, JPG, PNG up to 10MB each
            </p>
          </div>
          <input
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            multiple
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            type="file"
          />
        </label>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground">
              Uploaded Receipts ({attachments.length})
            </h3>
            {canProceed && !isGenerating && (
              <Button
                className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                onClick={handleGenerateDescription}
                size="sm"
                variant="outline"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Description
              </Button>
            )}
          </div>

          {attachments.map((attachment) => (
            <Card className="border-[#3DA9E0]/20 p-4" key={attachment.id}>
              <div className="flex items-start gap-4">
                {attachment.preview && (
                  <Image
                    alt="Receipt"
                    className="h-20 w-20 shrink-0 rounded bg-muted object-cover"
                    height={80}
                    src={attachment.preview}
                    unoptimized
                    width={80}
                  />
                )}

                <div className="grow">
                  {attachment.processing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#3DA9E0]">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Processing with AI...</span>
                      </div>
                      <Progress className="h-2" value={66} />
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>Short Description</Label>
                        <Input
                          onChange={(e) =>
                            setAttachments((prev) =>
                              prev.map((att) =>
                                att.id === attachment.id
                                  ? { ...att, description: e.target.value }
                                  : att
                              )
                            )
                          }
                          value={attachment.description}
                        />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input
                          onChange={(e) =>
                            setAttachments((prev) =>
                              prev.map((att) =>
                                att.id === attachment.id
                                  ? { ...att, date: e.target.value }
                                  : att
                              )
                            )
                          }
                          type="date"
                          value={attachment.date}
                        />
                      </div>
                      <div>
                        <Label>Amount (NOK)</Label>
                        <Input
                          onChange={(e) =>
                            setAttachments((prev) =>
                              prev.map((att) =>
                                att.id === attachment.id
                                  ? {
                                      ...att,
                                      amount:
                                        Number.parseFloat(e.target.value) || 0,
                                    }
                                  : att
                              )
                            )
                          }
                          type="number"
                          value={attachment.amount}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="text-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeAttachment(attachment.id)}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}

          {/* Generated Description */}
          {canProceed && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
              initial={{ opacity: 0, y: 10 }}
            >
              <Label>Expense Description</Label>
              <Textarea
                className="mt-2"
                disabled={isGenerating}
                onChange={(e) => setGeneratedDescription(e.target.value)}
                placeholder={
                  isGenerating
                    ? "Generating description..."
                    : "Enter or generate a description for your expense..."
                }
                rows={4}
                value={generatedDescription}
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Edit this description as needed
              </p>
            </motion.div>
          )}

          {/* Total */}
          <Card className="border-[#3DA9E0]/20 bg-[#3DA9E0]/5 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-lg">
                Total Amount:
              </span>
              <span className="font-bold text-2xl text-[#3DA9E0]">
                {totalAmount.toFixed(2)} NOK
              </span>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
          disabled={!canProceed}
          onClick={handleNext}
        >
          <Eye className="mr-2 h-4 w-4" />
          Review & Submit
        </Button>
      </div>
    </Card>
  );
}
