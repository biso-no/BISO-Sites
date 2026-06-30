"use client";

import type { TourStepRenderContext } from "@repo/tours/types";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { CSSProperties } from "react";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
} from "../../app/(portal)/_components/studio";

const ghostButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  fontSize: 12.5,
  color: STUDIO.ink2,
  background: "rgba(255,255,255,0.55)",
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  cursor: "pointer",
};

const darkButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 13px",
  fontSize: 12.5,
  color: STUDIO.paper,
  background: STUDIO.ink,
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(26,24,20,0.18)",
};

/**
 * A tour step-card styled to match the recruitment "studio" look (warm cream
 * paper, hairline borders, Cormorant serif title, IBM Plex Mono progress chip,
 * ink primary button). Passed to the shared TourProvider via `renderStepCard`,
 * so the package keeps owning positioning/overlay while this owns the visuals.
 */
export function StudioTourCard({
  step,
  index,
  total,
  isFirst,
  isLast,
  titleId,
  bodyId,
  labels,
  translate,
  onNext,
  onBack,
  onSkip,
}: TourStepRenderContext) {
  const resolve = (value: string) => (translate ? translate(value) : value);
  const progress = labels.progress(index + 1, total);

  return (
    <div
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      aria-modal="false"
      role="dialog"
      style={{
        width: 344,
        maxWidth: "calc(100vw - 2rem)",
        padding: 18,
        background: STUDIO.paper,
        border: `0.5px solid ${STUDIO.rule}`,
        borderRadius: 14,
        boxShadow:
          "0 24px 60px rgba(26,24,20,0.22), 0 2px 8px rgba(26,24,20,0.08)",
        color: STUDIO.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: MONO_STACK,
            fontSize: 10.5,
            letterSpacing: "0.04em",
            color: STUDIO.ink3,
            background: STUDIO.paper2,
            border: `0.5px solid ${STUDIO.rule2}`,
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {progress}
        </span>
        <button
          aria-label={labels.close}
          onClick={onSkip}
          style={{
            display: "grid",
            placeItems: "center",
            padding: 2,
            color: STUDIO.ink3,
            background: "transparent",
            border: 0,
            borderRadius: 6,
            cursor: "pointer",
          }}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>

      <h2
        id={titleId}
        style={{
          margin: 0,
          fontFamily: SERIF_STACK,
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          color: STUDIO.ink,
        }}
      >
        {resolve(step.title)}
      </h2>
      <p
        id={bodyId}
        style={{
          margin: "8px 0 0",
          fontSize: 13.5,
          lineHeight: 1.5,
          color: STUDIO.ink2,
        }}
      >
        {resolve(step.body)}
      </p>

      <span aria-live="polite" className="sr-only">
        {`${progress}: ${resolve(step.title)}`}
      </span>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <button onClick={onSkip} style={ghostButton} type="button">
          {labels.skip}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {isFirst ? null : (
            <button onClick={onBack} style={ghostButton} type="button">
              <ArrowLeft aria-hidden="true" size={14} />
              {labels.back}
            </button>
          )}
          <button onClick={onNext} style={darkButton} type="button">
            {isLast ? labels.finish : labels.next}
            {isLast ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <ArrowRight aria-hidden="true" size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
