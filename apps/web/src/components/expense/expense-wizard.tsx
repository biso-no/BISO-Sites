"use client";

import { Card } from "@repo/ui/components/ui/card";
import { CheckCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface Step {
  id: number;
  title: string;
  description: string;
}

interface ExpenseWizardProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  children: React.ReactNode;
}

export function ExpenseWizard({
  steps,
  currentStep,
  children,
}: ExpenseWizardProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-10">
      <Card className="p-6 border-0 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    currentStep > step.id
                      ? "bg-green-500 text-white"
                      : currentStep === step.id
                        ? "bg-[#3DA9E0] text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    currentStep >= step.id ? "text-gray-900" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-4 rounded ${
                    currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="py-8">
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </div>
    </div>
  );
}

interface StepContainerProps {
  stepId: number;
  children: React.ReactNode;
}

export function StepContainer({ stepId, children }: StepContainerProps) {
  return (
    <motion.div
      key={`step-${stepId}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
