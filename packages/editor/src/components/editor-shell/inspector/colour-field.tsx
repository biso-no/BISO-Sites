"use client";

import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
  THEME_QUICK_PICKS,
} from "@repo/shared/utils/page-theme";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

interface Props {
  label: string;
  /** Live change while dragging: repaint only, no undo step. */
  onChange: (hex: string) => void;
  /** A finished edit: the caller makes its one undoable change. */
  onCommit: (hex: string) => void;
  value: string;
}

interface Hsv {
  h: number;
  s: number;
  v: number;
}

const KEY_STEP = 0.01;
const KEY_STEP_SHIFT = 0.1;
const MAX_HUE = 359;

const ARROWS: Record<string, [number, number]> = {
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** From a hex, keeping the old hue where the colour has none (greys, black). */
function hsvFrom(hex: string, previous: Hsv): Hsv {
  const next = hexToHsv(hex);
  const hueless = next.s === 0 || next.v === 0;
  return {
    h: hueless ? previous.h : Math.min(MAX_HUE, Math.round(next.h)),
    s: next.s,
    v: next.v,
  };
}

const hexOf = ({ h, s, v }: Hsv) => hsvToHex(h, s, v);

/**
 * Saturation/value area, hue slider, hex field and quick picks. Everything
 * outside speaks hex; HSV is the picker's own working state.
 *
 * Drags report through `onChange` and commit once on release. Arrow keys on
 * the area commit on every press: a key press is a deliberate step, and a
 * held key would otherwise leave the change uncommitted until a release that
 * keyboard users never make.
 */
export function ColourField({ label, onChange, onCommit, value }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() =>
    hsvFrom(value, { h: 0, s: 0, v: 0 })
  );
  const [seen, setSeen] = useState(value);
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const live = useRef(hsv);
  const dragging = useRef(false);

  // The parent's value changed (a commit, an undo, a reset): follow it.
  if (value !== seen) {
    setSeen(value);
    setText(value);
    setInvalid(false);
    if (value !== hexOf(hsv)) {
      const next = hsvFrom(value, hsv);
      live.current = next;
      setHsv(next);
    }
  }

  const apply = (next: Hsv) => {
    live.current = next;
    setHsv(next);
    setText(hexOf(next));
    setInvalid(false);
  };

  const fromPointer = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!(rect.width && rect.height)) {
      return;
    }
    const next = {
      h: live.current.h,
      s: clamp01((e.clientX - rect.left) / rect.width),
      v: 1 - clamp01((e.clientY - rect.top) / rect.height),
    };
    apply(next);
    onChange(hexOf(next));
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    fromPointer(e);
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (dragging.current) {
      fromPointer(e);
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onCommit(hexOf(live.current));
  };

  const onAreaKey = (e: KeyboardEvent<HTMLElement>) => {
    const arrow = ARROWS[e.key];
    if (!arrow) {
      return;
    }
    e.preventDefault();
    const step = e.shiftKey ? KEY_STEP_SHIFT : KEY_STEP;
    const next = {
      h: live.current.h,
      s: clamp01(live.current.s + arrow[0] * step),
      v: clamp01(live.current.v + arrow[1] * step),
    };
    apply(next);
    onCommit(hexOf(next));
  };

  const onHue = (raw: string) => {
    const next = { ...live.current, h: Number(raw) };
    apply(next);
    onChange(hexOf(next));
  };

  const commitText = () => {
    const normal = normalizeHex(text);
    if (!normal) {
      setInvalid(true);
      return;
    }
    apply(hsvFrom(normal, live.current));
    onCommit(normal);
  };

  const onTextKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitText();
    } else if (e.key === "Escape") {
      setText(value);
      setInvalid(false);
    }
  };

  const current = hexOf(hsv);
  const hueColour = hsvToHex(hsv.h, 1, 1);

  return (
    <div className="pe-colour" data-colour={label}>
      <div className="pe-colour__label">{label}</div>
      <div
        aria-label="Saturation and brightness"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={current}
        className="pe-colour__area"
        onKeyDown={onAreaKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        style={{ backgroundColor: hueColour }}
        tabIndex={0}
      >
        <span
          className="pe-colour__thumb"
          style={{
            background: current,
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
          }}
        />
      </div>
      <input
        aria-label={`${label} hue`}
        className="pe-colour__hue"
        max={MAX_HUE}
        min={0}
        onChange={(e) => onHue(e.currentTarget.value)}
        onKeyUp={() => onCommit(hexOf(live.current))}
        onPointerUp={() => onCommit(hexOf(live.current))}
        step={1}
        type="range"
        value={Math.round(hsv.h)}
      />
      <div className="pe-colour__hexrow">
        <span className="pe-colour__chip" style={{ background: current }} />
        <input
          aria-invalid={invalid}
          aria-label={`${label} hex`}
          autoComplete="off"
          className="pe-colour__hex"
          onBlur={commitText}
          onChange={(e) => {
            setText(e.currentTarget.value);
            setInvalid(false);
          }}
          onKeyDown={onTextKey}
          spellCheck={false}
          type="text"
          value={text}
        />
      </div>
      <p aria-live="polite" className="pe-colour__error">
        {invalid ? "Not a colour" : ""}
      </p>
      <div className="pe-color-row">
        {THEME_QUICK_PICKS.map((pick) => (
          <button
            aria-label={`${pick.label} ${pick.hex}`}
            className={current === pick.hex ? "on" : undefined}
            key={pick.hex}
            onClick={() => onCommit(pick.hex)}
            style={{ background: pick.hex }}
            title={pick.label}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
