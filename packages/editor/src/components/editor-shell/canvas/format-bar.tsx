"use client";

import { useEffect, useState } from "react";

interface BarRect { top: number; left: number; }

export function FormatBar() {
  const [rect, setRect] = useState<BarRect | null>(null);

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setRect(null); return; }
      const anchor = sel.anchorNode;
      const editEl = (anchor instanceof Element ? anchor : anchor?.parentElement)
        ?.closest("[data-edit='1']");
      if (!editEl) { setRect(null); return; }
      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      setRect({ top: r.top - 44, left: r.left + r.width / 2 });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  if (!rect) return null;

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value ?? undefined);
  }

  function handleLink() {
    const url = prompt("URL:");
    if (url) exec("createLink", url);
  }

  const btnStyle: React.CSSProperties = {
    background: "none",
    border: 0,
    color: "inherit",
    cursor: "pointer",
    padding: "0 5px",
    height: "100%",
    lineHeight: 1,
  };

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 6px",
        height: 32,
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 999,
        fontSize: 13,
        boxShadow: "0 2px 8px rgba(0,0,0,.3)",
        userSelect: "none",
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
        style={{ ...btnStyle, fontWeight: 700 }}
        title="Bold"
      >B</button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
        style={{ ...btnStyle, fontStyle: "italic" }}
        title="Italic"
      >I</button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); handleLink(); }}
        style={{ ...btnStyle, fontSize: 11 }}
        title="Link"
      >URL</button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}
        style={{ ...btnStyle, opacity: 0.65, fontSize: 11 }}
        title="Remove formatting"
      >✕</button>
    </div>
  );
}
