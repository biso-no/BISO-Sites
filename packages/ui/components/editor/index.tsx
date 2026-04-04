'use client';

import { createPlateEditor, Plate } from 'platejs/react';

import { Editor, EditorContainer } from '../ui/editor';
import { AIKit } from '../ai-kit';
import { CopilotKit } from '../copilot-kit';

export default function RichEditor() {
  const editor = createPlateEditor({
    plugins: [
      ...AIKit,
      ...CopilotKit
    ]
  })

  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Editor placeholder="Type your amazing content here..." />
      </EditorContainer>
    </Plate>
  );
}
