"use client";

import type { SyntaxHighlighterProps as AUIProps } from "@assistant-ui/react-markdown";
import { cn } from "@repo/ui/lib/utils";
import type { FC } from "react";
import ShikiHighlighter, { type ShikiHighlighterProps } from "react-shiki";

/**
 * Props for the SyntaxHighlighter component
 */
export type HighlighterProps = Omit<
  ShikiHighlighterProps,
  "children" | "theme"
> & {
  theme?: ShikiHighlighterProps["theme"];
} & Pick<AUIProps, "node" | "components" | "language" | "code">;

/**
 * SyntaxHighlighter component, using react-shiki
 * Use it by passing to `defaultComponents` in `markdown-text.tsx`
 *
 * @example
 * const defaultComponents = memoizeMarkdownComponents({
 *   SyntaxHighlighter,
 *   h1: //...
 *   //...other elements...
 * });
 */
export const SyntaxHighlighter: FC<HighlighterProps> = ({
  code,
  language,
  theme = { dark: "kanagawa-wave", light: "kanagawa-lotus" },
  className,
  addDefaultStyles = false, // assistant-ui requires custom base styles
  showLanguage = false, // assistant-ui/react-markdown handles language labels
  node: _node,
  components: _components,
  ...props
}) => {
  const BASE_STYLES =
    "aui-shiki-base [&_pre]:overflow-x-auto [&_pre]:rounded-b-lg [&_pre]:bg-muted/75! [&_pre]:p-4";

  return (
    <ShikiHighlighter
      {...props}
      addDefaultStyles={addDefaultStyles}
      className={cn(BASE_STYLES, className)}
      defaultColor="light-dark()"
      language={language}
      showLanguage={showLanguage}
      theme={theme}
    >
      {code.trim()}
    </ShikiHighlighter>
  );
};

SyntaxHighlighter.displayName = "SyntaxHighlighter";
