interface PlateTextNode {
  children?: unknown;
  text?: unknown;
}

const getPlateNodeText = (node: unknown): string => {
  if (!(node && typeof node === "object")) {
    return "";
  }

  const { children, text } = node as PlateTextNode;
  if (typeof text === "string") {
    return text;
  }
  if (Array.isArray(children)) {
    return children.map(getPlateNodeText).join("");
  }
  return "";
};

export const hasPlateTextContent = (
  value: string | null | undefined
): boolean => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return false;
  }
  if (!trimmed.startsWith("[")) {
    return true;
  }

  try {
    const document = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(document)) {
      return true;
    }
    return document.some((node) => getPlateNodeText(node).trim().length > 0);
  } catch {
    return true;
  }
};
