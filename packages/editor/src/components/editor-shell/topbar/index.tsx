"use client";

import { useState } from "react";
import { useEditorCallbacks } from "@/editor/callbacks";
import { useMeta, useSaving } from "@/editor/hooks";

export function Topbar() {
  const meta = useMeta();
  const saving = useSaving();
  const { onExit, onPublish, onUnpublish, activeLocale } = useEditorCallbacks();
  const [publishing, setPublishing] = useState(false);

  const isPublished = meta.status === "published";

  async function handlePublish() {
    if (!(onPublish || onUnpublish)) {
      return;
    }
    setPublishing(true);
    try {
      if (isPublished && onUnpublish) {
        await onUnpublish(activeLocale);
      } else if (!isPublished && onPublish) {
        await onPublish(activeLocale);
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <header className="pe-topbar">
      <div className="pe-topbar__left">
        {onExit && (
          <button
            aria-label="Back to pages"
            className="pe-topbar__exit"
            onClick={onExit}
            title="Back to pages"
            type="button"
          >
            ←
          </button>
        )}
        <span className="serif pe-topbar__logo">BISO</span>
        <span aria-hidden="true" className="pe-topbar__sep">
          /
        </span>
        <span className="pe-topbar__page">{meta.title}</span>
      </div>

      <div className="pe-topbar__center">
        <div className="pe-url">
          <span aria-label="secure" className="pe-url__secure">
            ✓
          </span>
          <span>biso.no /</span>
          <b className="pe-url__slug">{meta.slug}</b>
        </div>
      </div>

      <div className="pe-topbar__right">
        <span className="pe-save">
          {saving === "pending" && (
            <>
              <i aria-hidden="true" className="pending pe-save__dot" />
              Saving…
            </>
          )}
          {saving === "saved" && (
            <>
              <i aria-hidden="true" className="saved pe-save__dot" />
              Saved
            </>
          )}
          {saving === "error" && (
            <>
              <i aria-hidden="true" className="error pe-save__dot" />
              Error
            </>
          )}
          {saving === "idle" && null}
        </span>
        {(onPublish || onUnpublish) && (
          <button
            className={`pe-publish${isPublished ? "pe-publish--live" : ""}`}
            disabled={publishing || saving === "pending"}
            onClick={handlePublish}
            title={isPublished ? "Unpublish this page" : "Publish to biso.no"}
            type="button"
          >
            {!isPublished && (
              <span aria-hidden="true" className="pe-publish__pulse" />
            )}
            {publishing ? "…" : isPublished ? "Published ✓" : "Publish"}
          </button>
        )}
      </div>
    </header>
  );
}
