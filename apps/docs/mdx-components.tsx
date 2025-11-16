import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Callout } from './components/callout';
import { Tabs, CodeTabs } from './components/tabs';
import { Steps, Step } from './components/steps';
import { FileTree, FileTreeItem } from './components/file-tree';
import { Mermaid } from './components/mdx/mermaid';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

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
};


export function getMDXComponents(customComponents?: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock 
      
        {...props}
      >
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...customComponents,
  };
}
