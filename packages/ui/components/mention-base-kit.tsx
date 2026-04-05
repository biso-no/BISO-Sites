import { BaseMentionPlugin } from '@platejs/mention';

import { MentionElementStatic } from '@repo/ui/components/ui/mention-node-static';

export const BaseMentionKit = [
  BaseMentionPlugin.withComponent(MentionElementStatic),
];
