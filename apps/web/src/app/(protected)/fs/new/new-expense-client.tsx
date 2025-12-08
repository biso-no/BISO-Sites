"use client";

import type { Users } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CampusStep } from "@/components/expense/campus-step";
import {
  ExpenseWizard,
  StepContainer,
} from "@/components/expense/expense-wizard";
import { ProfileStep } from "@/components/expense/profile-step";
import { SummaryDialog } from "@/components/expense/summary-dialog";
import { UploadStep } from "@/components/expense/upload-step";
import { createExpense, createExpenseAttachment } from "@/lib/actions/expense";
import { updateProfile } from "@/lib/actions/user";

const steps = [
  { id: 1, title: "Profile", description: "Contact & Banking" },
  { id: 2, title: "Campus & Department", description: "Assignment" },
  { id: 3, title: "Attachments", description: "Upload Receipts" },
];

type NewExpenseClientProps = {
  initialProfile: Partial<Users>;
  campuses: Array<{ $id: string; name: string }>;
};

export function NewExpenseClient({
  initialProfile,
  campuses,
}: NewExpenseClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [profile, setProfile] = useState(initialProfile);
  const [campusData, setCampusData] = useState<{
    campusId: string;
    departmentId: string;
    campusName?: string;
    departmentName?: string;
  } | null>(null);
  const [uploadData, setUploadData] = useState<{
    attachments: Array<{
      id: string;
      description: string;
      date: string;
      amount: number;
    }>;
    description: string;
    total: number;
  } | null>(null);

  const handleProfileNext = (updatedProfile: Partial<Users>) => {
    setProfile(updatedProfile);
    setCurrentStep(2);
  };

  const handleProfileUpdate = async (updatedProfile: Partial<Users>) => {
    try {
      await updateProfile(updatedProfile);
      toast.success("Profile updated successfully");
    } catch (_error) {
      toast.error("Failed to update profile");
    }
  };

  const handleCampusNext = (data: {
    campusId: string;
    departmentId: string;
  }) => {
    const campus = campuses.find((c) => c.$id === data.campusId);
    setCampusData({
      ...data,
      campusName: campus?.name,
    });
    setCurrentStep(3);
  };

  const handleUploadNext = (data: {
    attachments: Array<{
      id: string;
      description: string;
      date: string;
      amount: number;
    }>;
    description: string;
    total: number;
  }) => {
    setUploadData(data);
    setShowSummary(true);
  };

  const handleSubmit = async () => {
    if (!(campusData && uploadData)) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Create attachment records in the database
      const attachmentIds: string[] = [];

      for (const att of uploadData.attachments) {
        const result = await createExpenseAttachment({
          date: att.date,
          url: att.id, // The file ID from storage
          amount: att.amount,
          description: att.description,
          type: "receipt",
        });

        if (result.success && result.attachment) {
          attachmentIds.push(result.attachment.$id);
        }
      }

      // Create the expense
      const expenseResult = await createExpense({
        campus: campusData.campusId,
        department: campusData.departmentId,
        bank_account: profile.bank_account || "",
        description: uploadData.description,
        expenseAttachments: attachmentIds,
        total: uploadData.total,
      });

      if (expenseResult.success) {
        toast.success("Reimbursement submitted successfully!");
        router.push(`/fs/${expenseResult.expense?.$id}`);
      } else {
        throw new Error(expenseResult.error);
      }
    } catch (error) {
      console.error("Error submitting expense:", error);
      toast.error("Failed to submit reimbursement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Header */}
      <div className="relative h-[30vh] overflow-hidden">
        <ImageWithFallback
          alt="New Reimbursement"
          className="object-cover"
          fill
          src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwZG9jdW1lbnRzfGVufDF8fHx8MTc2MjE2NTE0NXww&ixlib=rb-4.1.0&q=80&w=1080"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <Link href="/fs">
              <motion.button
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
                initial={{ opacity: 0, x: -20 }}
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Reimbursements
              </motion.button>
            </Link>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="mb-4 font-bold text-4xl text-white">
                Submit New Reimbursement
              </h1>
              <p className="text-lg text-white/90">Step {currentStep} of 3</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <ExpenseWizard
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        steps={steps}
      >
        {currentStep === 1 && (
          <StepContainer stepId={1}>
            <ProfileStep
              onNext={handleProfileNext}
              onUpdateProfile={handleProfileUpdate}
              profile={profile}
            />
          </StepContainer>
        )}

        {currentStep === 2 && (
          <StepContainer stepId={2}>
            <CampusStep
              campuses={campuses}
              onBack={() => setCurrentStep(1)}
              onNext={handleCampusNext}
            />
          </StepContainer>
        )}

        {currentStep === 3 && (
          <StepContainer stepId={3}>
            <UploadStep
              onBack={() => setCurrentStep(2)}
              onNext={handleUploadNext}
            />
          </StepContainer>
        )}
      </ExpenseWizard>

      {/* Summary Dialog */}
      {uploadData && campusData && (
        <SummaryDialog
          data={{
            profile,
            campus: campusData.campusName || "",
            department: campusData.departmentName || "",
            attachments: uploadData.attachments,
            description: uploadData.description,
            total: uploadData.total,
          }}
          isSubmitting={isSubmitting}
          onOpenChange={setShowSummary}
          onSubmit={handleSubmit}
          open={showSummary}
        />
      )}
    </div>
  );
}
