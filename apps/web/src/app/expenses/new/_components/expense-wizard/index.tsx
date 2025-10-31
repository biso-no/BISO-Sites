"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@repo/ui/components/ui/button"
import { Progress } from "@repo/ui/components/ui/progress"
import { ContactAndBankDetails } from "./steps/contact-bank-details"
import { DepartmentSelection } from "./steps/department-selection"
import { DocumentUpload } from "./steps/document-upload"
import { ExpenseDescription } from "./steps/expense-description"
import { ExpenseConfirmation } from "./steps/expense-confirmation"
import { Models } from "@repo/api/server"
import { getLoggedInUser } from "@/lib/actions/user"
import { useAuth } from "@/lib/hooks/useAuth"
import { Loader2 } from "lucide-react"
import { useAppContext } from "@/app/contexts"

const STEPS = [
  {
    id: "contact",
    title: "Contact & Bank Details",
    description: "Fill in your contact information and bank details.",
  },
  {
    id: "department",
    title: "Campus & Department",
    description: "Select your campus and department information",
  },
  {
    id: "documents",
    title: "Document Upload",
    description: "Upload receipts and supporting documents.",
  },
  {
    id: "description",
    title: "Expense Details",
    description: "Provide details about your expense.",
  },
  {
    id: "confirmation",
    title: "Review & Submit",
    description: "Review and submit your expense claim.",
  },
] as const

export type ExpenseStep = typeof STEPS[number]

export function ExpenseWizard() {
  const { campuses } = useAppContext()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const { profile, isLoading: profileLoading } = useAuth()

  const currentStep = STEPS[currentStepIndex]
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const handlePrevious = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const handleUpdateData = (stepId: string, data: any) => {
    console.log('Updating data for step:', stepId, data);
    setFormData(prev => {
      // Simply merge the data at the root level
      const newData = {
        ...prev,
        [stepId]: data
      };
      console.log('New form data:', newData);
      return newData;
    });
  }

  const getConfirmationData = () => {
    const selectedCampus = campuses.find(c => c.$id === formData.department?.campus);
    const selectedDepartment = selectedCampus?.departments?.find(
      d => d.$id === formData.department?.department
    );

    return {
      contact: {
        ...formData.contact,
        campus: selectedCampus?.$id,
        department: selectedDepartment?.$id
      },
      documents: formData.rows?.rows || [],
      description: formData.description,
    }
  }

  const renderStep = () => {
    if (profileLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading profile...</span>
        </div>
      );
    }

    const commonProps = {
      onNext: handleNext,
      onPrevious: handlePrevious,
      onUpdate: (data: any) => handleUpdateData(currentStep.id, data),
      // Pass relevant data to each step
      data: {
        ...formData[currentStep.id],
        documents: formData.rows?.rows,
        generatedDescription: formData.rows?.description?.generatedDescription
      },
      profile,
    }

    // Add debug logging
    if (currentStep.id === 'description') {
      console.log('Passing data to ExpenseDescription:', {
        documents: formData.rows?.rows,
        description: formData.rows?.description  // Note: The data might be nested under 'documents'
      });
    }

    console.log('Rendering step:', currentStep.id, 'with data:', formData[currentStep.id]); // Debug log

    switch (currentStep.id) {
      case "contact":
        return <ContactAndBankDetails {...commonProps} />
      case "department":
        return <DepartmentSelection {...commonProps} />
      case "documents":
        return <DocumentUpload {...commonProps} />
      case "description":
        return <ExpenseDescription {...commonProps} />
      case "confirmation":
        return (
          <ExpenseConfirmation
            onPrevious={handlePrevious}
            data={getConfirmationData()}
          />
        )
      default:
        return null
    }
  }

  useEffect(() => {
    if (!profileLoading && !profile) {
      // Redirect to login or show error
      window.location.href = '/login'
    }
  }, [profile, profileLoading])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-semibold">{currentStep.title}</h1>
            <p className="text-gray-500">{currentStep.description}</p>
          </div>
          <div className="text-sm text-gray-500">
            Step {currentStepIndex + 1} of {STEPS.length}
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 border-t pt-6">
        <div className="flex justify-between text-sm">
          {STEPS.map((step, index) => (
            <Button
              key={step.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 ${
                index === currentStepIndex
                  ? "text-blue-500"
                  : index < currentStepIndex
                  ? "text-green-500"
                  : "text-gray-400"
              }`}
              onClick={() => setCurrentStepIndex(index)}
              disabled={index > currentStepIndex}
            >
              <div
                className={`w-2 h-2 rounded-full mb-1 ${
                  index === currentStepIndex
                    ? "bg-blue-500"
                    : index < currentStepIndex
                    ? "bg-green-500"
                    : "bg-gray-300"
                }`}
              />
              {step.title}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
} 