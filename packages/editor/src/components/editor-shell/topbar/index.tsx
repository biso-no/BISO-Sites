"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useEditorCallbacks } from "@/editor/callbacks";
import {
  THEME_BLOCKS_PUBLISH,
  themeBlocksSave,
} from "@/editor/effective-theme";
import { useMeta, useSaving } from "@/editor/hooks";

export function Topbar({ actions }: { actions?: ReactNode }) {
  const meta = useMeta();
  const saving = useSaving();
  const { onExit, onPublish, onUnpublish, activeLocale } = useEditorCallbacks();
  const [publishing, setPublishing] = useState(false);

  const isPublished = meta.status === "published";
  const themeBlocked = themeBlocksSave(meta);
  // Leaving now would drop every edit since the colours started failing:
  // held like the locale switch until they pass.
  const exitBlocked = saving === "blocked";
  let publishTitle = "Publish to biso.no";
  if (themeBlocked) {
    publishTitle = THEME_BLOCKS_PUBLISH;
  } else if (isPublished) {
    publishTitle = "Publish the latest edits to biso.no";
  }
  let publishLabel = "Publish";
  if (publishing) {
    publishLabel = "…";
  } else if (isPublished) {
    // Edits only ever reach the draft; publishing again copies them live.
    publishLabel = "Publish changes";
  }

  async function run(
    action?: (locale: typeof activeLocale) => Promise<unknown>
  ) {
    if (!action) {
      return;
    }
    setPublishing(true);
    try {
      await action(activeLocale);
    } catch {
      // The host reports the failure itself; the status stays as it was.
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
            disabled={exitBlocked}
            onClick={onExit}
            title={
              exitBlocked
                ? "Fix the theme colours before leaving"
                : "Back to pages"
            }
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
          <span aria-hidden="true" className="pe-url__secure">
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
          {saving === "blocked" && (
            <>
              <i aria-hidden="true" className="error pe-save__dot" />
              Not saved: theme colours fail the contrast check
            </>
          )}
          {saving === "idle" && null}
        </span>
        {actions}
        {isPublished && onUnpublish && (
          <button
            className="pe-topbar__unpublish"
            disabled={publishing || saving === "pending"}
            onClick={() => run(onUnpublish)}
            title="Take this page off biso.no"
            type="button"
          >
            Unpublish
          </button>
        )}
        {onPublish && (
          <button
            className={`pe-publish ${isPublished ? "pe-publish--live" : ""}`}
            disabled={publishing || saving === "pending" || themeBlocked}
            onClick={() => run(onPublish)}
            title={publishTitle}
            type="button"
          >
            {!isPublished && (
              <span aria-hidden="true" className="pe-publish__pulse" />
            )}
            {publishLabel}
          </button>
        )}
      </div>
    </header>
  );
}
