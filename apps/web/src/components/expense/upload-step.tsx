"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Progress } from "@repo/ui/components/ui/progress";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { ArrowLeft, Eye, Sparkles, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  createExpenseAttachment,
  uploadExpenseAttachment,
} from "@/lib/actions/expense";
import {
  generateExpenseDescription,
  processReceipt,
} from "@/lib/actions/expense-ocr";

interface Attachment {
  id: string;
  fileId: string;
  fileUrl: string;
  file: File;
  preview?: string;
  description: string;
  date: string;
  amount: number;
  processing: boolean;
}

interface UploadStepProps {
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
}

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

        if (!uploadResult.success || !uploadResult.file) {
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
                  fileId: uploadResult.file!.$id,
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
    <Card className="p-8 border-0 shadow-lg">
      <h2 className="text-gray-900 mb-6">Upload Receipts & Documents</h2>

      {/* Upload Area */}
      <div className="mb-8">
        <label className="block">
          <div className="border-2 border-dashed border-[#3DA9E0]/30 rounded-lg p-12 text-center cursor-pointer hover:border-[#3DA9E0] hover:bg-[#3DA9E0]/5 transition-all">
            <Upload className="w-12 h-12 text-[#3DA9E0] mx-auto mb-4" />
            <p className="text-gray-900 mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-gray-600">
              PDF, JPG, PNG up to 10MB each
            </p>
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-900">
              Uploaded Receipts ({attachments.length})
            </h3>
            {canProceed && !isGenerating && (
              <Button
                onClick={handleGenerateDescription}
                variant="outline"
                size="sm"
                className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Description
              </Button>
            )}
          </div>

          {attachments.map((attachment) => (
            <Card key={attachment.id} className="p-4 border-[#3DA9E0]/20">
              <div className="flex items-start gap-4">
                {attachment.preview && (
                  <div className="w-20 h-20 shrink-0 rounded overflow-hidden bg-gray-100">
                    <img
                      src={attachment.preview}
                      alt="Receipt"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grow">
                  {attachment.processing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#3DA9E0]">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        <span className="text-sm">Processing with AI...</span>
                      </div>
                      <Progress value={66} className="h-2" />
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label>Short Description</Label>
                        <Input
                          value={attachment.description}
                          onChange={(e) =>
                            setAttachments((prev) =>
                              prev.map((att) =>
                                att.id === attachment.id
                                  ? { ...att, description: e.target.value }
                                  : att
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={attachment.date}
                          onChange={(e) =>
                            setAttachments((prev) =>
                              prev.map((att) =>
                                att.id === attachment.id
                                  ? { ...att, date: e.target.value }
                                  : att
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Amount (NOK)</Label>
                        <Input
                          type="number"
                          value={attachment.amount}
                          onChange={(e) =>
                            setAttachments((prev) =>
                              prev.map((att) =>
                                att.id === attachment.id
                                  ? {
                                      ...att,
                                      amount: parseFloat(e.target.value) || 0,
                                    }
                                  : att
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(attachment.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

          {/* Generated Description */}
          {canProceed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Label>Expense Description</Label>
              <Textarea
                value={generatedDescription}
                onChange={(e) => setGeneratedDescription(e.target.value)}
                rows={4}
                className="mt-2"
                placeholder={
                  isGenerating
                    ? "Generating description..."
                    : "Enter or generate a description for your expense..."
                }
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-1">
                Edit this description as needed
              </p>
            </motion.div>
          )}

          {/* Total */}
          <Card className="p-4 bg-[#3DA9E0]/5 border-[#3DA9E0]/20">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">
                Total Amount:
              </span>
              <span className="text-2xl font-bold text-[#3DA9E0]">
                {totalAmount.toFixed(2)} NOK
              </span>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
        >
          <Eye className="w-4 h-4 mr-2" />
          Review & Submit
        </Button>
      </div>
    </Card>
  );
}
