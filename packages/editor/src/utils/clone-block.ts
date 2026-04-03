"use client";

import type { ComponentData, Config } from "@puckeditor/core";

export function createId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

export function isComponentData(value: unknown): value is ComponentData {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    "props" in (value as Record<string, unknown>) &&
    typeof (value as { type?: unknown }).type === "string" &&
    Boolean((value as { props?: unknown }).props) &&
    typeof (value as { props?: unknown }).props === "object"
  );
}

export function cloneWithNewIds(
  item: ComponentData,
  config: Config
): ComponentData {
  const defaultProps =
    (config.components?.[item.type]?.defaultProps as Record<string, unknown>) ??
    {};

  const nextProps = {
    ...defaultProps,
    ...(item.props as Record<string, unknown>),
    id: createId(item.type),
  };

  const remap = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(remap);
    }
    if (isComponentData(value)) {
      return cloneWithNewIds(value, config);
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(record).map(([k, v]) => [k, remap(v)])
      );
    }
    return value;
  };

  return { ...item, props: remap(nextProps) as ComponentData["props"] };
}
