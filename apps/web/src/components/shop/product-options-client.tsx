"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { motion } from "motion/react";
import { useState } from "react";
import type { ProductOption } from "@/lib/types/webshop";

type ProductOptionsClientProps = {
  productOptions: ProductOption[];
  productRefId: string; // Used as a key/identifier if needed
  // Note: We don't need 'useProductActions' here, as option state is local
  // The selected options are passed to the AddToCartClient (or a shared state/context)
  // For simplicity, this example component is for rendering/local state only.
};

export function ProductOptionsClient({
  productOptions,
}: ProductOptionsClientProps) {
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOptionChange = (optionIndex: number, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [`option-${optionIndex}`]: value,
    }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`option-${optionIndex}`];
      return newErrors;
    });
  };

  // In a real app, you would need to export or contextually manage 'selectedOptions'
  // so the AddToCartClient can access them before calling the server action.
  // For this refactor, we focus on code splitting. Assume the `AddToCartClient`
  // or a wrapper will manage this shared state.

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-0 p-8 shadow-lg">
        <h2 className="mb-6 font-bold text-2xl text-foreground">
          Product Options
        </h2>
        <div className="space-y-6">
          {productOptions.map((option, index) => (
            <div key={index}>
              <Label className="mb-2 block font-semibold">
                {option.label}
                {option.required && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </Label>

              {option.type === "select" && option.options ? (
                <Select
                  onValueChange={(value) => handleOptionChange(index, value)}
                  value={selectedOptions[`option-${index}`] || ""}
                >
                  <SelectTrigger
                    className={`w-full ${errors[`option-${index}`] ? "border-red-500" : ""}`}
                  >
                    <SelectValue
                      placeholder={`Select ${option.label.toLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {option.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className={errors[`option-${index}`] ? "border-red-500" : ""}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={option.placeholder || option.label}
                  type="text"
                  value={selectedOptions[`option-${index}`] || ""}
                />
              )}

              {errors[`option-${index}`] && (
                <p className="mt-1 text-red-500 text-sm">
                  This field is required
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
