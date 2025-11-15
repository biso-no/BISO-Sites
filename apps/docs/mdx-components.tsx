import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Callout } from './components/callout';
import { Tabs, CodeTabs } from './components/tabs';
import { Steps, Step } from './components/steps';
import { FileTree, FileTreeItem } from './components/file-tree';

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
};

export function getMDXComponents(customComponents?: MDXComponents): MDXComponents {
  return {
    ...components,
    ...customComponents,
  };
}
