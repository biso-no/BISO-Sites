"use client";

import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { useTranslations } from "next-intl";
import {
  shopFieldClass,
  shopFieldInvalidClass,
  shopFieldLabelClass,
  shopSelectContentClass,
  shopSelectItemClass,
  shopSelectTriggerClass,
} from "@/components/shop/v2/form-styles";
import type { ProductCustomField } from "@/lib/types/product";
import {
  productFieldDomId,
  useProductCustomFields,
} from "./product-custom-fields-context";

/** `type` for the plain `<Input>` branch; `select`/`textarea` render their own. */
const INPUT_TYPE: Record<string, string> = {
  email: "email",
  number: "number",
  text: "text",
};

interface FieldA11y {
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  id: string;
}

function FieldControl({
  a11y,
  field,
  invalid,
  onChange,
  value,
}: {
  a11y: FieldA11y;
  field: ProductCustomField;
  invalid: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const placeholder = field.placeholder || field.label;

  if (field.type === "select") {
    return (
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger
          {...a11y}
          className={cn(
            shopSelectTriggerClass,
            invalid && shopFieldInvalidClass
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={shopSelectContentClass}>
          {(field.options ?? []).map((option) => (
            <SelectItem
              className={shopSelectItemClass}
              key={option}
              value={option}
            >
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
        {...a11y}
        className={cn(shopFieldClass, invalid && shopFieldInvalidClass)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    );
  }

  return (
    <Input
      {...a11y}
      className={cn(shopFieldClass, invalid && shopFieldInvalidClass)}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
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
 *
 * Rendered inside the buy card, between the price and the button, so the
 * questions are answered where the purchase is made — on a phone the card comes
 * first, and a required question below the description would sit out of sight
 * of the button that refuses to proceed without it.
 */
export function ProductOptionsClient() {
  const t = useTranslations("shop");
  const state = useProductCustomFields();

  if (!state || state.fields.length === 0) {
    return null;
  }

  return (
    <fieldset className="mt-6 border-edge border-t pt-6">
      <legend className="type-heading-card mb-4 text-ink">
        {t("product.optionsTitle")}
      </legend>
      <div className="space-y-5">
        {state.fields.map((field) => {
          const invalid = state.missing.includes(field.id);
          const id = productFieldDomId(field.id);
          const helpId = field.helpText ? `${id}-help` : undefined;
          const errorId = invalid ? `${id}-error` : undefined;
          const describedBy =
            [helpId, errorId].filter(Boolean).join(" ") || undefined;
          return (
            <div key={field.id}>
              <label className={shopFieldLabelClass} htmlFor={id}>
                {field.label}
                {field.required ? (
                  <span aria-hidden="true" className="ms-1 text-danger">
                    *
                  </span>
                ) : null}
              </label>

              <div className="mt-2">
                <FieldControl
                  a11y={{
                    "aria-describedby": describedBy,
                    "aria-invalid": invalid ? true : undefined,
                    "aria-required": field.required ? true : undefined,
                    id,
                  }}
                  field={field}
                  invalid={invalid}
                  onChange={(value) => state.setAnswer(field.id, value)}
                  value={state.answers[field.id] ?? ""}
                />
              </div>

              {field.helpText ? (
                <p className="type-body-sm mt-1 text-ink-muted" id={helpId}>
                  {field.helpText}
                </p>
              ) : null}
              {invalid ? (
                <p className="type-body-sm mt-1 text-danger" id={errorId}>
                  {t("product.optionRequired")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
