"use client";

import { useEditorStore } from "@/editor/store";

export function CopilotButton() {
  const setCopilotOpen = useEditorStore((s) => s.setCopilotOpen);

  return (
    <button
      type="button"
      className="pe-copilot"
      onClick={() => setCopilotOpen(true)}
      aria-label="Open AI copilot"
    >
      <div className="pe-copilot__gem" aria-hidden="true">✦</div>
      <span>Ask AI</span>
      <span className="pe-copilot__kbd-pill">⌘K</span>
    </button>
  );
}
