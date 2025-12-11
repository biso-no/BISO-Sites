"use client";

import { Card } from "@repo/ui/components/ui/card";
import { CheckCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type Step = {
  id: number;
  title: string;
  description: string;
};

type ExpenseWizardProps = {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  children: React.ReactNode;
};

export function ExpenseWizard({
  steps,
  currentStep,
  children,
}: ExpenseWizardProps) {
  return (
    <div className="-mt-8 relative z-10 mx-auto max-w-4xl px-4">
      <Card className="border-0 p-6 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          {steps.map((step, index) => (
            <div className="flex flex-1 items-center" key={step.id}>
              <div className="flex items-center gap-3">
                {(() => {
                  const isCompleted = currentStep > step.id;
                  const isActive = currentStep === step.id;
                  let circleClass = "bg-muted text-muted-foreground";
                  if (isCompleted) {
                    circleClass = "bg-green-500 text-white";
                  } else if (isActive) {
                    circleClass = "bg-brand text-white";
                  }
                  return (
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${circleClass}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </div>
                  );
                })()}
                <span
                  className={`text-sm ${
                    currentStep >= step.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-4 h-1 flex-1 rounded ${
                    currentStep > step.id ? "bg-green-500" : "bg-muted"
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

type StepContainerProps = {
  stepId: number;
  children: React.ReactNode;
};

export function StepContainer({ stepId, children }: StepContainerProps) {
  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      initial={{ opacity: 0, x: 20 }}
      key={`step-${stepId}`}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
