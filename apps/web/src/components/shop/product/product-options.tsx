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
import { useProductPurchase } from "./product-purchase-provider";

export function ProductOptions() {
  const { productOptions, selectedOptions, handleOptionChange, errors } =
    useProductPurchase();

  if (productOptions.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 p-8 shadow-lg">
      <h2 className="mb-6 font-bold text-2xl text-gray-900">Product Options</h2>
      <div className="space-y-6">
        {productOptions.map((option, index) => (
          <div key={index}>
            <Label className="mb-2 block font-semibold">
              {option.label}
              {option.required && <span className="ml-1 text-red-500">*</span>}
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
  );
}
