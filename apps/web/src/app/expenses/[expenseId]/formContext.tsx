"use client";

import { createContext, useContext, useState } from "react";
import type { BankDetailsFormData, DepartmentDetailsFormData, DocumentDetailsFormData } from "./zodSchemas";

interface FormContextType {
  step: number;
  updateStep: (step: number) => void;
  formData: {
    // Bank Details
    bank_account?: string;
    account_holder?: string;
    bank_name?: string;
    swift_code?: string;
    
    // Department Details
    department?: string;
    campus?: string;
    description?: string;
    
    // Document Details
    expense_attachments?: any[];
    expense_attachments_ids?: string[];
    total?: number;
  };
  updateFormData: (data: Partial<FormContextType["formData"]>) => void;
  resetForm: () => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormContextType["formData"]>({});

  const updateStep = (newStep: number) => {
    setStep(newStep);
  };

  const updateFormData = (newData: Partial<FormContextType["formData"]>) => {
    setFormData(prev => ({
      ...prev,
      ...newData
    }));
  };

  const resetForm = () => {
    setStep(1);
    setFormData({});
  };

  return (
    <FormContext.Provider
      value={{
        step,
        updateStep,
        formData,
        updateFormData,
        resetForm,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error("useFormContext must be used within a FormProvider");
  }
  return context;
}
