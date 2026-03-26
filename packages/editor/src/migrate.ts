import type { Data } from "@puckeditor/core";
import { migrate, transformProps } from "@puckeditor/core/rsc";
import { config } from "./config";

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
  let data = coerceToData(value);

  try {
    data = migrate(data);
  } catch {
    // keep coerced data as-is if Puck's migrate fails
  }

  // Transform props for components whose fields changed during the refactor.
  // Each transform is a no-op when data already matches the new schema.
  data = transformProps(data, {
    // Root: title, slug, description, visibility moved to the Sheet dialog —
    // strip them so the editor does not warn about unknown root fields.
    root: ({
      title: _title,
      slug: _slug,
      description: _desc,
      visibility: _vis,
      ...rest
    }: Record<string, unknown>) => rest,

    // RichText: content field type changed from textarea to richtext.
    // The stored value format (string) is unchanged, but ensure it exists.
    RichText: (props: Record<string, unknown>) => ({
      ...props,
      content: props.content ?? "",
    }),
  } as any, config as any);

  return data;
}
