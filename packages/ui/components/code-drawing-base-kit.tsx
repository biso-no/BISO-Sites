import { BaseCodeDrawingPlugin } from '@platejs/code-drawing';

import { CodeDrawingElement } from '@repo/ui/components/ui/code-drawing-node';

export const BaseCodeDrawingKit = [
  BaseCodeDrawingPlugin.configure({
    node: { component: CodeDrawingElement },
  }),
];
