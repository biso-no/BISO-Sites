"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormFieldInfo, FormStreamEvent } from "../types";

type UseFormAutopilotOptions = {
  /** Form ID for identification */
  formId: string;
  /** Form name for display */
  formName: string;
  /** Field definitions */
  fields: FormFieldInfo[];
  /** Callback to set a field value */
  onSetValue: (fieldId: string, value: unknown) => void;
  /** Callback to get current field value */
  onGetValue: (fieldId: string) => unknown;
};

type FormAutopilotState = {
  isActive: boolean;
  currentField: string | null;
  streamingText: string;
};

/**
 * Hook for enabling AI autopilot form filling
 * Connects form fields to the AI assistant for streaming updates
 */
export function useFormAutopilot({
  formId,
  formName,
  fields,
  onSetValue,
  onGetValue,
}: UseFormAutopilotOptions) {
  const [state, setState] = useState<FormAutopilotState>({
    isActive: false,
    currentField: null,
    streamingText: "",
  });

  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current form context for AI
  const getFormContext = useCallback(() => {
    const fieldValues = fields.map((field) => ({
      ...field,
      currentValue: onGetValue(field.id),
    }));

    return {
      formId,
      formName,
      fields: fieldValues,
    };
  }, [formId, formName, fields, onGetValue]);

  // Handle streaming text into a field with typewriter effect
  const streamToField = useCallback(
    (fieldId: string, text: string, onComplete?: () => void) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) {
        return;
      }

      setState((prev) => ({
        ...prev,
        isActive: true,
        currentField: fieldId,
        streamingText: "",
      }));

      let currentIndex = 0;
      const chars = text.split("");

      // Clear any existing interval
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }

      // Stream characters with typewriter effect
      streamIntervalRef.current = setInterval(() => {
        if (currentIndex < chars.length) {
          const partialText = chars.slice(0, currentIndex + 1).join("");
          onSetValue(fieldId, partialText);
          setState((prev) => ({ ...prev, streamingText: partialText }));
          currentIndex += 1;
        } else {
          // Complete
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          setState((prev) => ({
            ...prev,
            isActive: false,
            currentField: null,
          }));
          onComplete?.();
        }
      }, 20); // 20ms per character = ~50 chars/second
    },
    [fields, onSetValue]
  );

  // Handle immediate field update (no streaming)
  const setFieldValue = useCallback(
    (fieldId: string, value: unknown) => {
      onSetValue(fieldId, value);
    },
    [onSetValue]
  );

  // Handle form stream events from AI
  const handleFormStream = useCallback(
    (event: FormStreamEvent) => {
      if (event.done === false) {
        streamToField(event.fieldId, event.chunk);
      } else {
        setFieldValue(event.fieldId, event.chunk);
      }
    },
    [streamToField, setFieldValue]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    }; // eslint-disable-line
  }, []);

  return {
    // State
    isActive: state.isActive,
    currentField: state.currentField,
    streamingText: state.streamingText,

    // Context
    getFormContext,

    // Actions
    streamToField,
    setFieldValue,
    handleFormStream,
  };
}
