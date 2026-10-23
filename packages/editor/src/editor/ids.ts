export type IdPrefix = "b" | "c" | "s";

/** Short random id such as `b-k3j9x2`. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
