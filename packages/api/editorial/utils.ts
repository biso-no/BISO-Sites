import type { EditorialDocument } from "./types";

export function cloneDocument(document: EditorialDocument): EditorialDocument {
  return JSON.parse(JSON.stringify(document)) as EditorialDocument;
}

export function decodeJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  if (typeof value === "object") {
    return value as T;
  }

  return fallback;
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function createEmptyDocument(): EditorialDocument {
  return {
    root: { props: {} },
    content: [],
  };
}
