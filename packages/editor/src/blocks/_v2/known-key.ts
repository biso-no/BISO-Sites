/**
 * `value` when it is one of `table`'s own keys, else `fallback`. Stored block
 * props are untrusted (copilot output and seed scripts bypass the editor UI),
 * so every enum lookup goes through this: a plain `table[value]` would give
 * `undefined` for an unknown value and a function for "constructor".
 */
export function knownKey<K extends string>(
  table: Readonly<Record<K, unknown>>,
  value: unknown,
  fallback: NoInfer<K>
): K {
  return typeof value === "string" && Object.hasOwn(table, value)
    ? (value as K)
    : fallback;
}
