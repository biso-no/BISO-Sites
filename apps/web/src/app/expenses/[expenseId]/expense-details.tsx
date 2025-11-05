"use client"
import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { 
  Building, 
  CheckCircle, 
  CreditCard, 
  FileText, 
  ArrowLeft,
  Save,
  AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";

import { BankDetailsStep } from "./bank-details";
import { DepartmentSelectionStep } from "./department-details";
import { DocumentUploadStep } from "./document-details";
import ExpenseOverview from "./overview-details";
import { useFormContext } from "./formContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.9
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.9
  })
};

const stepTitles = [
  { 
    title: "Bank Details", 
    icon: CreditCard,
    description: "Enter your bank account information for reimbursement"
  },
  { 
    title: "Department Info", 
    icon: Building,
    description: "Select your department and related information"
  },
  { 
    title: "Documents", 
    icon: FileText,
    description: "Upload receipts and supporting documents"
  },
  { 
    title: "Overview", 
    icon: CheckCircle,
    description: "Review and submit your expense claim"
  }
];

const StepIndicator = ({ currentStep, totalSteps, onStepClick }: { currentStep: number, totalSteps: number, onStepClick: (step: number) => void }) => {
  return (
    <div className="relative mb-8">
      {/* Progress bar background */}
      <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full" />
      
      {/* Animated progress */}
      <motion.div 
        className="absolute top-1/2 left-0 h-1 bg-linear-to-r from-blue-600 to-indigo-600 -translate-y-1/2 rounded-full"
        initial={false}
        animate={{
          width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Step indicators */}
      <div className="relative flex justify-between">
        {stepTitles.map((step, index) => {
          const isCompleted = currentStep > index + 1;
          const isCurrent = currentStep === index + 1;
          const StepIcon = step.icon;

          return (
            <motion.button
              key={index}
              onClick={() => onStepClick(index + 1)}
              className={`flex flex-col items-center relative ${
                isCompleted || isCurrent ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
              whileHover={isCompleted || isCurrent ? { scale: 1.05 } : {}}
              whileTap={isCompleted || isCurrent ? { scale: 0.95 } : {}}
            >
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCurrent
                    ? 'bg-linear-to-r from-blue-600 to-indigo-600 shadow-lg'
                    : isCompleted
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                } text-white`}
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                  transition: { type: "spring", stiffness: 500, damping: 30 }
                }}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </motion.div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <motion.span
                  className={`text-sm font-medium ${
                    isCurrent ? 'text-blue-600' : 'text-gray-500'
                  }`}
                  animate={{
                    scale: isCurrent ? 1.1 : 1
                  }}
                >
                  {step.title}
                </motion.span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export function ExpenseDetails({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const formContext = useFormContext();
  const { step, updateStep } = formContext;
  const [pageDirection, setPageDirection] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const handleStepClick = (newStep: number) => {
    if (newStep < step) {
      setPageDirection(newStep > step ? 1 : -1);
      updateStep(newStep);
    }
  };

  const handleClose = () => {
    try {
      router.push('/expenses');
    } catch (error) {
      console.error("Error returning to page:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Implement save logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
      toast.success("Progress saved", {
        description: "Your expense form has been saved as a draft.",
      });
    } catch {
      toast.error("Error saving progress", {
        description: "Please try again later.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <BankDetailsStep />;
      case 2:
        return <DepartmentSelectionStep />;
      case 3:
        return <DocumentUploadStep />;
      case 4:
        return <ExpenseOverview expenseId={expenseId} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white pt-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl mx-auto space-y-6"
      >
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={handleClose}
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Expenses
          </Button>
          <Button
            onClick={handleSave}
            variant="outline"
            className="text-blue-600 hover:text-blue-700"
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
        </div>

        {/* Main Form Card */}
        <Card className="border border-gray-200 shadow-xl bg-white/50 backdrop-blur-sm">
          <CardHeader className="border-b border-gray-100 pb-6">
            <div className="flex flex-col space-y-2">
              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">
                {stepTitles[step - 1]?.title || "Reimbursement Form"}
              </CardTitle>
              <p className="text-gray-500">
                {stepTitles[step - 1]?.description}
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            <StepIndicator 
              currentStep={step} 
              totalSteps={4} 
              onStepClick={handleStepClick}
            />
            
            <div className="mt-12">
              <AnimatePresence mode="wait" custom={pageDirection}>
                <motion.div
                  key={step}
                  custom={pageDirection}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 }
                  }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>
          </CardContent>

          {/* Help Text */}
          <CardFooter className="border-t border-gray-100 mt-6">
            <Alert className="bg-blue-50/50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-gray-600">
                Need help? Contact support at support@example.com
              </AlertDescription>
            </Alert>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}