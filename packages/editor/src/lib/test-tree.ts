import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";

export type AnyElement = ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;

/**
 * Every element in a hook-free component's output, expanding nested function
 * components. The media picker uses hooks, so it is listed, not expanded.
 */
export function walk(node: ReactNode, out: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, out);
    }
    return out;
  }
  if (!isValidElement(node)) {
    return out;
  }
  const el = node as AnyElement;
  out.push(el);
  if (typeof el.type === "function") {
    if (el.type !== MediaPicker) {
      walk((el.type as (p: unknown) => ReactNode)(el.props), out);
    }
    return out;
  }
  for (const child of Children.toArray(el.props.children)) {
    walk(child, out);
  }
  return out;
}

export type PickerElement = ReactElement<{
  onClear?: () => void;
  onPicked: (fileId: string, url: string, mime: string) => void;
  onUrl: (url: string) => void;
}>;

/** The media pickers in a component's output, in order. */
export const pickersIn = (node: ReactNode): PickerElement[] =>
  walk(node).filter((el) => el.type === MediaPicker) as PickerElement[];
