import { migrate } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";

const EMPTY_DATA: Data = {
  root: { props: {} },
  content: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceToData(value: unknown): Data {
  if (!isRecord(value)) {
    return EMPTY_DATA;
  }

  const root = isRecord(value.root) ? value.root : {};
  const rootProps = isRecord((root as Record<string, unknown>).props)
    ? (root as Record<string, unknown>).props
    : {};

  const content = Array.isArray(value.content) ? value.content : [];

  return {
    root: { props: rootProps as Record<string, unknown> },
    content: content as Data["content"],
  };
}

export function migratePuckData(value: unknown): Data {
  const data = coerceToData(value);

  try {
    return migrate(data);
  } catch {
    return data;
  }
}

