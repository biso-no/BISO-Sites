import { describe, expect, test } from "bun:test";
import { Button } from "@repo/ui/components/ui/button";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  type ElementType,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AutoTranslateControl,
  TranslationReviewCard,
} from "./content-translation-controls";

const findElementByType = <Props,>(
  node: ReactNode,
  type: ElementType
): ReactElement<Props> | null => {
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return null;
  }
  if (node.type === type) {
    return node as ReactElement<Props>;
  }
  const children = node.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElementByType<Props>(child, type);
      if (match) {
        return match;
      }
    }
    return null;
  }
  return findElementByType<Props>(children, type);
};

const collectText = (node: ReactNode): string => {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return "";
  }
  return collectText(node.props.children);
};

describe("AutoTranslateControl", () => {
  test("renders an accessible switch and names the active language direction", () => {
    const onCheckedChange = () => undefined;
    const control = AutoTranslateControl({
      checked: true,
      onCheckedChange,
      operation: "save",
      sourceLocale: "no",
    });
    const toggle = findElementByType<{
      "aria-label"?: string;
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }>(control, Switch);

    expect(toggle?.props["aria-label"]).toBe("Auto-translate");
    expect(toggle?.props.checked).toBeTrue();
    expect(toggle?.props.onCheckedChange).toBe(onCheckedChange);
    expect(collectText(control)).toContain(
      "Translate Norwegian to English after save"
    );
  });
});

describe("TranslationReviewCard", () => {
  test("uses a bidirectional action label", () => {
    const norwegianSource = TranslationReviewCard({
      isTranslating: false,
      onTranslate: () => undefined,
      sourceLocale: "no",
    });
    const englishSource = TranslationReviewCard({
      isTranslating: false,
      onTranslate: () => undefined,
      sourceLocale: "en",
    });
    const norwegianButton = findElementByType<{ children?: ReactNode }>(
      norwegianSource,
      Button
    );
    const englishButton = findElementByType<{ children?: ReactNode }>(
      englishSource,
      Button
    );

    expect(collectText(norwegianButton)).toContain("Generate English");
    expect(collectText(englishButton)).toContain("Generate Norwegian");
  });
});
