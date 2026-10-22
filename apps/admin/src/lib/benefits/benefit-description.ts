/**
 * Whether a stored description is formatted: HTML from the old block editor,
 * or a JSON node list from the Plate editor before it. The benefit panel
 * writes plain text, where line breaks are the only formatting.
 */
export function isFormattedDescription(
  value: string | null | undefined
): boolean {
  const trimmed = (value ?? "").trim();
  if (trimmed.startsWith("<")) {
    return true;
  }
  if (!trimmed.startsWith("[")) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((node) => typeof node === "object" && node !== null)
    );
  } catch {
    return false;
  }
}
