"use client";

import { useEditorStore } from "@/editor/store";

export function CopilotButton() {
  const setCopilotOpen = useEditorStore((s) => s.setCopilotOpen);

  return (
    <button
      aria-label="Open AI copilot"
      className="pe-copilot"
      onClick={() => setCopilotOpen(true)}
      type="button"
    >
      <div aria-hidden="true" className="pe-copilot__gem">
        ✦
      </div>
      <span>Ask AI</span>
      <span className="pe-copilot__kbd-pill">⌘K</span>
    </button>
  );
}
