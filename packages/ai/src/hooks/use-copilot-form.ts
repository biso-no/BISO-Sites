"use client";

import { useEffect, useCallback, useRef } from "react";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { useCopilotStore, type PageCapability } from "../stores/copilot-store";
import type { FormFieldInfo } from "../types";

type UseCopilotFormOptions<T extends FieldValues> = {
  /**
   * The react-hook-form instance
   */
  form: UseFormReturn<T>;

  /**
   * The capability this form provides (e.g., "create-event", "edit-job")
   */
  capability: PageCapability;

  /**
   * Form field definitions for the AI to understand
   */
  fields: FormFieldInfo[];

  /**
   * Whether the copilot integration is enabled (default: true)
   */
  enabled?: boolean;
};

/**
 * Hook to connect a react-hook-form to the AI copilot
 *
 * This hook:
 * 1. Registers the form with the copilot store when mounted
 * 2. Provides a handler for the AI to stream values into form fields
 * 3. Unregisters when unmounted
 *
 * @example
 * ```tsx
 * const form = useForm<EventFormValues>();
 *
 * useCopilotForm({
 *   form,
 *   capability: "create-event",
 *   fields: eventFormFields,
 * });
 * ```
 */
export function useCopilotForm<T extends FieldValues>({
  form,
  capability,
  fields,
  enabled = true,
}: UseCopilotFormOptions<T>) {
  const registerHandler = useCopilotStore((state) => state.registerHandler);
  const unregisterHandler = useCopilotStore((state) => state.unregisterHandler);
  const setAgentState = useCopilotStore((state) => state.setAgentState);

  // Keep form ref updated to avoid stale closures
  const formRef = useRef(form);
  formRef.current = form;

  // Track streaming state for typewriter effect
  const streamingFieldsRef = useRef<Map<string, { interval: ReturnType<typeof setInterval> | null }>>(
    new Map()
  );

  /**
   * Handle form field updates from the AI
   * Supports both instant updates and streaming (typewriter) effect
   */
  const handleFormField = useCallback(
    (data: {
      fieldId: string;
      value: string;
      streaming?: boolean;
      isComplete?: boolean;
    }) => {
      const { fieldId, value, streaming, isComplete } = data;

      // Clear any existing streaming interval for this field
      const existingState = streamingFieldsRef.current.get(fieldId);
      if (existingState?.interval) {
        clearInterval(existingState.interval);
      }

      if (streaming && !isComplete) {
        // Streaming mode: update value directly (AI is streaming character by character)
        setAgentState("filling-form", `Filling ${fieldId}...`);
        formRef.current.setValue(fieldId as Path<T>, value as T[Path<T>], {
          shouldValidate: false,
          shouldDirty: true,
        });
        streamingFieldsRef.current.set(fieldId, { interval: null });
      } else {
        // Complete: set final value and validate
        formRef.current.setValue(fieldId as Path<T>, value as T[Path<T>], {
          shouldValidate: true,
          shouldDirty: true,
        });
        streamingFieldsRef.current.delete(fieldId);

        // If all fields are done, reset agent state
        if (streamingFieldsRef.current.size === 0) {
          setAgentState("idle");
        }
      }
    },
    [setAgentState]
  );

  // Register with copilot store on mount
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Get current field values for context
    const currentValues = formRef.current.getValues();
    const fieldsWithValues = fields.map((field) => ({
      ...field,
      currentValue: getNestedValue(currentValues, field.id),
    }));

    registerHandler({
      capability,
      formFields: fieldsWithValues,
      onFormField: handleFormField,
    });

    return () => {
      // Clean up any streaming intervals
      for (const state of streamingFieldsRef.current.values()) {
        if (state.interval) {
          clearInterval(state.interval);
        }
      }
      streamingFieldsRef.current.clear();
      unregisterHandler();
    };
  }, [capability, enabled, fields, handleFormField, registerHandler, unregisterHandler]);

  // Update field values in the store when form values change
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const subscription = form.watch((values: Partial<T>) => {
      const activeHandler = useCopilotStore.getState().activeHandler;
      if (activeHandler?.capability === capability && activeHandler.formFields) {
        const updatedFields = activeHandler.formFields.map((field) => ({
          ...field,
          currentValue: getNestedValue(values, field.id),
        }));

        // Only update if values actually changed
        const hasChanges = updatedFields.some((field, index) => {
          const original = activeHandler.formFields?.[index];
          return original?.currentValue !== field.currentValue;
        });

        if (hasChanges) {
          registerHandler({
            ...activeHandler,
            formFields: updatedFields,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [capability, enabled, form, registerHandler]);

  return {
    /**
     * Manually trigger the AI to fill a specific field
     */
    requestFieldFill: (fieldId: string) => {
      // This could be used to request the AI to fill a specific field
      // For now, it's a placeholder for future functionality
      console.log(`Request AI to fill field: ${fieldId}`);
    },
  };
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
