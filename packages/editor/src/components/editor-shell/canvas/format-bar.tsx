"use client";

import { useEffect, useState } from "react";

interface BarRect {
  left: number;
  top: number;
}

export function FormatBar() {
  const [rect, setRect] = useState<BarRect | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkRange, setLinkRange] = useState<Range | null>(null);

  useEffect(() => {
    function onSelectionChange() {
      if (linkRange) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setRect(null);
        return;
      }
      const anchor = sel.anchorNode;
      const editEl = (
        anchor instanceof Element ? anchor : anchor?.parentElement
      )?.closest("[data-edit='1']");
      if (!editEl) {
        setRect(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      setRect({ top: r.top - 44, left: r.left + r.width / 2 });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [linkRange]);

  if (!rect) {
    return null;
  }

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value ?? undefined);
  }

  function openLinkEditor() {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      setLinkRange(sel.getRangeAt(0).cloneRange());
    }
    setLinkDraft("");
  }

  function applyLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = linkDraft.trim();
    if (!url) {
      setLinkRange(null);
      return;
    }
    const sel = window.getSelection();
    if (sel && linkRange) {
      sel.removeAllRanges();
      sel.addRange(linkRange);
    }
    exec("createLink", url);
    setLinkDraft("");
    setLinkRange(null);
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
        onMouseDown={(e) => {
          e.preventDefault();
          exec("bold");
        }}
        style={{ ...btnStyle, fontWeight: 700 }}
        title="Bold"
        type="button"
      >
        B
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec("italic");
        }}
        style={{ ...btnStyle, fontStyle: "italic" }}
        title="Italic"
        type="button"
      >
        I
      </button>
      {linkRange ? (
        <form onSubmit={applyLink} style={{ display: "flex", height: "100%" }}>
          <input
            aria-label="Link URL"
            autoFocus
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setLinkDraft("");
                setLinkRange(null);
              }
            }}
            placeholder="https://"
            style={{
              width: 150,
              border: 0,
              borderRadius: 999,
              padding: "0 8px",
              fontSize: 12,
            }}
            value={linkDraft}
          />
        </form>
      ) : (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            openLinkEditor();
          }}
          style={{ ...btnStyle, fontSize: 11 }}
          title="Link"
          type="button"
        >
          URL
        </button>
      )}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec("removeFormat");
        }}
        style={{ ...btnStyle, opacity: 0.65, fontSize: 11 }}
        title="Remove formatting"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}
