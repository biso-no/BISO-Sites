"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ProductCustomField } from "@/lib/types/product";

interface CustomFieldsState {
  /** Answers keyed by field id, which is the key checkout stores them under. */
  answers: Record<string, string>;
  /** Field definitions for the product being viewed. */
  fields: ProductCustomField[];
  /** Field ids that were left blank on the last add-to-cart attempt. */
  missing: string[];
  setAnswer: (id: string, value: string) => void;
  setMissing: (ids: string[]) => void;
}

/**
 * Answers live in a context because the inputs and the "Add to cart" button
 * are separate client components rendered in different branches of a server
 * component's tree — before this, each held its own state and the button sent
 * a permanently empty object, silently discarding whatever the buyer typed.
 */
const ProductCustomFieldsContext = createContext<CustomFieldsState | null>(
  null
);

export function ProductCustomFieldsProvider({
  children,
  fields,
}: {
  children: ReactNode;
  fields: ProductCustomField[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);

  const value = useMemo<CustomFieldsState>(
    () => ({
      answers,
      fields,
      missing,
      setAnswer: (id, answer) => {
        setAnswers((current) => ({ ...current, [id]: answer }));
        // Clear the error as soon as the buyer types, rather than making them
        // press the button again to find out they have fixed it.
        setMissing((current) => current.filter((entry) => entry !== id));
      },
      setMissing,
    }),
    [answers, fields, missing]
  );

  return (
    <ProductCustomFieldsContext.Provider value={value}>
      {children}
    </ProductCustomFieldsContext.Provider>
  );
}

/**
 * Returns null when the product has no questions, so the add-to-cart button
 * works unchanged on the products (the large majority) that have none.
 */
export function useProductCustomFields(): CustomFieldsState | null {
  return useContext(ProductCustomFieldsContext);
}

/** Field ids that are required but still unanswered. */
export function findMissingRequired(
  fields: ProductCustomField[],
  answers: Record<string, string>
): string[] {
  return fields
    .filter((field) => field.required && !answers[field.id]?.trim())
    .map((field) => field.id);
}

/** Id → label, so the order line can record what each answer was asked for. */
export function buildFieldLabels(
  fields: ProductCustomField[]
): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.id, field.label]));
}
