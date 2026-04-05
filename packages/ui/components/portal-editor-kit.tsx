'use client';

import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';
import {
  BaseBlockquotePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseHorizontalRulePlugin,
} from '@platejs/basic-nodes';
import {
  BaseCodeBlockPlugin,
  BaseCodeLinePlugin,
  BaseCodeSyntaxPlugin,
} from '@platejs/code-block';
import { BaseLinkPlugin } from '@platejs/link';
import { BaseListPlugin } from '@platejs/list';
import { MarkdownPlugin } from '@platejs/markdown';
import { BaseParagraphPlugin, KEYS } from 'platejs';
import { all, createLowlight } from 'lowlight';
import remarkGfm from 'remark-gfm';

import { BlockquoteElement } from '@repo/ui/components/ui/blockquote-node';
import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from '@repo/ui/components/ui/code-block-node';
import {
  H1Element,
  H2Element,
  H3Element,
} from '@repo/ui/components/ui/heading-node';
import { HrElement } from '@repo/ui/components/ui/hr-node';
import { LinkElement } from '@repo/ui/components/ui/link-node';
import { ParagraphElement } from '@repo/ui/components/ui/paragraph-node';
import { BlockList } from '@repo/ui/components/ui/block-list';
import { BaseIndentKit } from './indent-base-kit';

const lowlight = createLowlight(all);

export const PortalEditorKit: any[] = [
  BaseParagraphPlugin.withComponent(ParagraphElement),
  BaseH1Plugin.withComponent(H1Element),
  BaseH2Plugin.withComponent(H2Element),
  BaseH3Plugin.withComponent(H3Element),
  BaseBlockquotePlugin.withComponent(BlockquoteElement),
  BaseHorizontalRulePlugin.withComponent(HrElement),
  BaseLinkPlugin.withComponent(LinkElement),
  BaseCodeBlockPlugin.configure({
    node: { component: CodeBlockElement },
    options: { lowlight },
  }),
  BaseCodeLinePlugin.withComponent(CodeLineElement),
  BaseCodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
  ...BaseIndentKit,
  BaseListPlugin.configure({
    inject: {
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock],
    },
    render: { belowNodes: BlockList as any },
  }),
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin.configure({
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
  MarkdownPlugin.configure({
    options: { remarkPlugins: [remarkGfm] },
  }),
];
