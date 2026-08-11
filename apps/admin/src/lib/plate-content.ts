interface PlateNode {
  children?: unknown;
  src?: unknown;
  text?: unknown;
  url?: unknown;
}

const hasPlateNodeContent = (node: unknown): boolean => {
  if (!(node && typeof node === "object")) {
    return false;
  }

  const { children, src, text, url } = node as PlateNode;
  if (typeof text === "string" && text.trim()) {
    return true;
  }
  if (typeof url === "string" && url.trim()) {
    return true;
  }
  if (typeof src === "string" && src.trim()) {
    return true;
  }
  return Array.isArray(children) && children.some(hasPlateNodeContent);
};

export const hasRichContent = (value: string | null | undefined): boolean => {
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
    return document.some(hasPlateNodeContent);
  } catch {
    return true;
  }
};
