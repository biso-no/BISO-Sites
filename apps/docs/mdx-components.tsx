import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { BeforeYouStart } from "./components/before-you-start";
import { Callout } from "./components/callout";
import { FileTree, FileTreeItem } from "./components/file-tree";
import { Mermaid } from "./components/mdx/mermaid";
import { Private } from "./components/private";
import { Screenshot } from "./components/screenshot";
import { Step, Steps } from "./components/steps";
import { CodeTabs, Tabs } from "./components/tabs";
import { WhatHappensNext } from "./components/what-happens-next";

// Export components directly for MDX usage (Next.js MDX pattern)
export const components: MDXComponents = {
  ...defaultMdxComponents,
  Callout,
  Tabs,
  CodeTabs,
  Steps,
  Step,
  FileTree,
  FileTreeItem,
  Mermaid,
  BeforeYouStart,
  WhatHappensNext,
  Screenshot,
  Private,
};

export function getMDXComponents(
  customComponents?: MDXComponents
): MDXComponents {
  return {
    ...components,
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...customComponents,
  };
}
