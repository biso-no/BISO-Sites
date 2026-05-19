"use client";

import { useMeta, useSaving } from "@/editor/hooks";
import { useEditorCallbacks } from "@/editor/callbacks";

export function Topbar() {
  const meta = useMeta();
  const saving = useSaving();
  const { onExit } = useEditorCallbacks();

  return (
    <header className="pe-topbar">
      <div className="pe-topbar__left">
        {onExit && (
          <button
            type="button"
            className="pe-topbar__exit"
            onClick={onExit}
            aria-label="Back to pages"
            title="Back to pages"
          >
            ←
          </button>
        )}
        <span className="pe-topbar__logo serif">BISO</span>
        <span className="pe-topbar__sep" aria-hidden="true">/</span>
        <span className="pe-topbar__page">{meta.title}</span>
      </div>

      <div className="pe-topbar__center">
        <div className="pe-url">
          <span className="pe-url__secure" aria-label="secure">✓</span>
          <span>biso.no /</span>
          <b className="pe-url__slug">{meta.slug}</b>
        </div>
      </div>

      <div className="pe-topbar__right">
        <span className="pe-save">
          {saving === "pending" && <><i className="pe-save__dot pending" aria-hidden="true"/>Saving…</>}
          {saving === "saved" && <><i className="pe-save__dot saved" aria-hidden="true"/>Saved</>}
          {saving === "error" && <><i className="pe-save__dot error" aria-hidden="true"/>Error</>}
          {saving === "idle" && null}
        </span>
        <button type="button" className="pe-publish">
          <span className="pe-publish__pulse" aria-hidden="true"/>
          Publish
        </button>
      </div>
    </header>
  );
}
