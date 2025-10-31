"use client"

import { motion } from "framer-motion"
import { CheckCircle2, CircleDot } from "lucide-react"
import type { ExpenseStep } from "."

interface StepIndicatorProps {
  steps: ExpenseStep[]
  currentStepIndex: number
  onStepClick: (index: number) => void
}

export function StepIndicator({
  steps,
  currentStepIndex,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="relative">
      {/* Progress bar background */}
      <div className="absolute top-[22px] left-0 w-full h-1 bg-gray-200 rounded-full" />

      {/* Animated progress */}
      <motion.div
        className="absolute top-[22px] left-0 h-1 rounded-full bg-linear-to-r from-blue-500 to-indigo-500"
        initial={false}
        animate={{
          width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex
          const isCurrent = index === currentStepIndex
          const isClickable = index < currentStepIndex

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
              onClick={() => isClickable && onStepClick(index)}
            >
              {/* Step circle */}
              <motion.div
                className={`
                  w-11 h-11 rounded-full flex items-center justify-center
                  ${
                    isCurrent
                      ? "bg-linear-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30"
                      : isCompleted
                      ? "bg-green-500"
                      : "bg-white border-2 border-gray-200"
                  }
                `}
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                  transition: { type: "spring", stiffness: 500, damping: 30 },
                }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : isCurrent ? (
                  <CircleDot className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-gray-400 font-medium">{index + 1}</span>
                )}
              </motion.div>

              {/* Step label */}
              <motion.div
                className="mt-4 text-center"
                animate={{
                  scale: isCurrent ? 1.05 : 1,
                }}
              >
                <p
                  className={`text-sm font-semibold mb-1 ${
                    isCurrent
                      ? "text-blue-600"
                      : isCompleted
                      ? "text-green-600"
                      : "text-gray-400"
                  }`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-xs max-w-[150px] ${
                    isCurrent || isCompleted ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {step.description}
                </p>
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 