"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cx } from "../view-model";

export function ModalShell({
  eyebrow,
  title,
  icon,
  onClose,
  children,
  footer,
  wide,
}: {
  children: ReactNode;
  eyebrow: string;
  footer?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="m-overlay">
      <button
        aria-label="Close"
        className="m-backdrop"
        onClick={onClose}
        type="button"
      />
      <div className={cx("modal", wide && "wide")} role="dialog">
        <div className="m-head">
          <div className="m-head-id">
            {icon ? <span className="m-icon">{icon}</span> : null}
            <div>
              <span className="m-eyebrow">{eyebrow}</span>
              <h2>{title}</h2>
            </div>
          </div>
          <button
            className="m-close"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="scroll m-body">{children}</div>
        {footer ? <div className="m-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
