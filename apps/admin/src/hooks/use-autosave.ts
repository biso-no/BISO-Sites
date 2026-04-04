"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUTOSAVE_INTERVAL_MS = 30_000;
const AUTOSAVE_DEBOUNCE_MS = 5000;
const PREF_KEY_PREFIX = "autosave_enabled:";

interface UseAutosaveOptions<T> {
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Called on mount when a saved draft is found in localStorage */
  onRestoreDraft?: (draft: T) => void;
  /** Unique storage key — e.g. "event:new" or "event:abc123" */
  storageKey: string;
  /** Current form values to persist */
  values: T;
}

interface UseAutosaveReturn {
  /** Call after a successful server save to clear the local draft */
  clearDraft: () => void;
  enabled: boolean;
  /** Returns the saved draft or null */
  getDraft: <T>() => T | null;
  isSaving: boolean;
  lastSaved: Date | null;
  setEnabled: (v: boolean) => void;
}

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`draft:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, values: T) {
  try {
    localStorage.setItem(`draft:${key}`, JSON.stringify(values));
  } catch {
    // quota exceeded or private mode — silent fail
  }
}

function deleteDraft(key: string) {
  try {
    localStorage.removeItem(`draft:${key}`);
  } catch {
    // silent
  }
}

function readEnabledPref(key: string): boolean {
  try {
    const raw = localStorage.getItem(`${PREF_KEY_PREFIX}${key}`);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function useAutosave<T>({
  storageKey,
  values,
  isDirty,
  onRestoreDraft,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [enabled, setEnabledState] = useState(() =>
    readEnabledPref(storageKey)
  );
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // On mount — offer to restore draft
  useEffect(() => {
    const draft = readDraft<T>(storageKey);
    if (draft && onRestoreDraft) {
      onRestoreDraft(draft);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, onRestoreDraft]);

  const save = useCallback(() => {
    if (!(enabledRef.current && isDirtyRef.current)) {
      return;
    }
    setIsSaving(true);
    writeDraft(storageKey, valuesRef.current);
    setLastSaved(new Date());
    // Simulated async tick so the UI can flash "Saving…" briefly
    setTimeout(() => setIsSaving(false), 300);
  }, [storageKey]);

  // Debounced save on values change
  useEffect(() => {
    if (!(enabled && isDirty)) {
      return;
    }
    const id = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [enabled, isDirty, save]);

  // Interval save every 30 s
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = setInterval(save, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, save]);

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledState(v);
      enabledRef.current = v;
      try {
        localStorage.setItem(`${PREF_KEY_PREFIX}${storageKey}`, String(v));
      } catch {
        // silent
      }
    },
    [storageKey]
  );

  const clearDraft = useCallback(() => {
    deleteDraft(storageKey);
    setLastSaved(null);
  }, [storageKey]);

  const getDraft = useCallback(
    <U>(): U | null => readDraft<U>(storageKey),
    [storageKey]
  );

  return { lastSaved, isSaving, enabled, setEnabled, clearDraft, getDraft };
}
