/**
 * Form bridge — a module-level singleton that lets the AI assistant
 * fill fields in a currently-open studio form (job studio, event studio).
 *
 * Studio pages register via useAssistantFormTarget(); the assistant
 * widget's fillForm tool resolution calls fillFormField().
 */

/** Canonical schemaId constants — used by editors and the fillForm tool description. */
export const JOB_STUDIO_SCHEMA_ID = "job-studio" as const;
export const EVENT_STUDIO_SCHEMA_ID = "event-studio" as const;

type FieldSetter = (path: string, value: string) => void;

interface FormBridgeState {
  schemaId: string | null;
  setField: FieldSetter | null;
}

const _bridge: FormBridgeState = {
  schemaId: null,
  setField: null,
};

/**
 * Register the currently-active form. Returns a cleanup function.
 * Call this from a useEffect in the studio component.
 *
 * @example
 * useEffect(() => {
 *   return registerAssistantFormTarget("job-studio", (path, value) =>
 *     setValue(path as keyof JobFormValues, value as never)
 *   );
 * }, [setValue]);
 */
export function registerAssistantFormTarget(
  schemaId: string,
  setField: FieldSetter
): () => void {
  _bridge.schemaId = schemaId;
  _bridge.setField = setField;
  return () => {
    if (_bridge.schemaId === schemaId) {
      _bridge.schemaId = null;
      _bridge.setField = null;
    }
  };
}

/** Returns the schemaId of the currently registered form, or null. */
export function getActiveFormSchemaId(): string | null {
  return _bridge.schemaId;
}

/**
 * Fill a single field in the registered form.
 * Returns false if no form is registered or schemaId doesn't match.
 */
export function fillFormField(
  schemaId: string,
  path: string,
  value: string
): boolean {
  if (_bridge.schemaId !== schemaId || !_bridge.setField) {
    return false;
  }
  _bridge.setField(path, value);
  return true;
}

/**
 * Fill multiple fields with a short async typewriter delay between them.
 * Returns the count of fields successfully filled.
 */
export async function fillFormFieldsWithDelay(
  schemaId: string,
  fields: Array<{ path: string; value: string }>,
  delayMs = 80
): Promise<number> {
  let count = 0;
  for (const field of fields) {
    const ok = fillFormField(schemaId, field.path, field.value);
    if (ok) {
      count++;
      if (delayMs > 0) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  return count;
}
