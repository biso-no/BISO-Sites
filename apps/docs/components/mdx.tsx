import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Callout } from './callout';
import { Tabs, CodeTabs } from './tabs';
import { Steps, Step } from './steps';
import { FileTree, FileTreeItem } from './file-tree';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
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