import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { Callout } from './callout';
import { Tabs, CodeTabs } from './tabs';
import { Steps, Step } from './steps';
import { FileTree, FileTreeItem } from './file-tree';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Wrap all fenced code blocks in the Fumadocs CodeBlock component
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    Callout,
    Tabs,
    CodeTabs,
    Steps,
    Step,
    FileTree,
    FileTreeItem,
    ...components,
  };
}