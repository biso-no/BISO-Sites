/**
 * A stored list prop, as the objects in it. Copilot output and seed scripts
 * bypass the editor UI, so a list can be missing, a string, or hold nulls and
 * strings: those become an empty list or are skipped instead of crashing the
 * page. Index-based edits then write the cleaned list back.
 */
export function listOf<T extends object>(value: unknown): T[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is T => typeof item === "object" && item !== null
      )
    : [];
}
