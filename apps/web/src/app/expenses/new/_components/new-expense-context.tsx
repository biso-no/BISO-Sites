"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { useToast } from "@repo/ui/components/ui/use-toast"

type ExpenseStep = "details" | "documents" | "review"

interface Expense {
  // Basic Details
  title: string
  description: string
  amount: number
  date: string
  category: string
  department: string
  campus: string
  
  // Bank Details
  bankAccount: string
  accountHolder: string
  bankName: string
  swiftCode?: string
  
  // Document Details
  documents: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>
}

interface NewExpenseContextType {
  currentStep: ExpenseStep
  setCurrentStep: (step: ExpenseStep) => void
  expense: Partial<Expense>
  updateExpense: (data: Partial<Expense>) => void
  isSubmitting: boolean
  submitExpense: () => Promise<void>
  saveAsDraft: () => Promise<void>
  resetForm: () => void
  stepProgress: number
}

const NewExpenseContext = createContext<NewExpenseContextType | undefined>(undefined)

const INITIAL_EXPENSE: Partial<Expense> = {
  documents: [],
}

export function NewExpenseProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState<ExpenseStep>("details")
  const [expense, setExpense] = useState<Partial<Expense>>(INITIAL_EXPENSE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const updateExpense = useCallback((data: Partial<Expense>) => {
    setExpense(prev => ({
      ...prev,
      ...data
    }))
  }, [])

  const submitExpense = async () => {
    setIsSubmitting(true)
    try {
      // TODO: Implement actual submission logic
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast({
        title: "Success!",
        description: "Your expense has been submitted successfully.",
      })
      resetForm()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit expense. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveAsDraft = async () => {
    try {
      // TODO: Implement draft saving logic
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast({
        title: "Draft Saved",
        description: "Your expense has been saved as a draft.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setCurrentStep("details")
    setExpense(INITIAL_EXPENSE)
  }

  const stepProgress = (() => {
    switch (currentStep) {
      case "details":
        return 33
      case "documents":
        return 66
      case "review":
        return 100
      default:
        return 0
    }
  })()

  return (
    <NewExpenseContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        expense,
        updateExpense,
        isSubmitting,
        submitExpense,
        saveAsDraft,
        resetForm,
        stepProgress,
      }}
    >
      {children}
    </NewExpenseContext.Provider>
  )
}

export function useNewExpense() {
  const context = useContext(NewExpenseContext)
  if (context === undefined) {
    throw new Error("useNewExpense must be used within a NewExpenseProvider")
  }
  return context
} 