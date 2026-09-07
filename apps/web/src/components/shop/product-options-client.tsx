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
import { Textarea } from "@repo/ui/components/ui/textarea";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ProductCustomField } from "@/lib/types/product";
import { useProductCustomFields } from "./product-custom-fields-context";

/** `type` for the plain `<Input>` branch; `select`/`textarea` render their own. */
const INPUT_TYPE: Record<string, string> = {
  email: "email",
  number: "number",
  text: "text",
};

function FieldControl({
  field,
  invalid,
  onChange,
  value,
}: {
  field: ProductCustomField;
  invalid: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const invalidClass = invalid ? "border-red-500" : "";

  if (field.type === "select") {
    return (
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className={`w-full ${invalidClass}`} id={field.id}>
          <SelectValue placeholder={field.placeholder || field.label} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        className={invalidClass}
        id={field.id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder || field.label}
        value={value}
      />
    );
  }

  return (
    <Input
      className={invalidClass}
      id={field.id}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder || field.label}
      type={INPUT_TYPE[field.type] ?? "text"}
      value={value}
    />
  );
}

/**
 * The questions this product asks before it can be added to the basket.
 *
 * State lives in ProductCustomFieldsProvider, not here, so the add-to-cart
 * button can read the answers — they are two sibling client components inside
 * a server-rendered page and have no other way to share.
 */
export function ProductOptionsClient() {
  const t = useTranslations("shop");
  const state = useProductCustomFields();

  if (!state || state.fields.length === 0) {
    return null;
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-0 p-8 shadow-lg">
        <h2 className="mb-6 font-bold text-2xl text-foreground">
          {t("product.optionsTitle")}
        </h2>
        <div className="space-y-6">
          {state.fields.map((field) => {
            const invalid = state.missing.includes(field.id);
            return (
              <div key={field.id}>
                <Label className="mb-2 block font-semibold" htmlFor={field.id}>
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </Label>

                <FieldControl
                  field={field}
                  invalid={invalid}
                  onChange={(value) => state.setAnswer(field.id, value)}
                  value={state.answers[field.id] ?? ""}
                />

                {field.helpText && (
                  <p className="mt-1 text-muted-foreground text-sm">
                    {field.helpText}
                  </p>
                )}
                {invalid && (
                  <p className="mt-1 text-red-500 text-sm">
                    {t("product.optionRequired")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
