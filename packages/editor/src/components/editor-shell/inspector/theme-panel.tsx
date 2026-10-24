"use client";

import {
  BISO_THEME,
  type ColourCheck,
  checkTheme,
  type PageTheme,
} from "@repo/shared/utils/page-theme";
import { useEffect } from "react";
import { useEditorCallbacks } from "@/editor/callbacks";
import { effectiveTheme } from "@/editor/effective-theme";
import { useMeta } from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import { ColourField } from "./colour-field";

type Which = keyof PageTheme;

const DECIMAL = 10;

/** One decimal, rounded down so a near miss never reads as a pass. */
const ratioText = (ratio: number) =>
  `${(Math.floor(ratio * DECIMAL) / DECIMAL).toFixed(1)} : 1`;

const FAIL_COPY: Record<Which, { min: string; text: string }> = {
  accent: { min: "4.5 : 1", text: "Doesn't stand out on the dark colour" },
  dark: { min: "7 : 1", text: "Too light for white text" },
};

function Result({
  check,
  onUse,
  which,
}: {
  check: ColourCheck;
  onUse: (hex: string) => void;
  which: Which;
}) {
  if (check.ok) {
    return (
      <p className="pe-colour__result pe-colour__result--ok">
        {`✓ ${ratioText(check.ratio)}`}
      </p>
    );
  }
  const copy = FAIL_COPY[which];
  return (
    <p className="pe-colour__result pe-colour__result--fail">
      {`${copy.text} (${ratioText(check.ratio)}, needs ${copy.min})`}
      {check.suggestion && (
        <button
          className="pe-colour__use"
          onClick={() => onUse(check.suggestion as string)}
          type="button"
        >
          {`Use ${check.suggestion}`}
        </button>
      )}
    </p>
  );
}

/**
 * The page's colours: a dark and an accent, checked live for contrast. With a
 * department set, the theme applies to all of that department's pages.
 *
 * Fields are seeded from what the page will render with, so the first edit on
 * an untouched department page keeps the department's other colour: every
 * commit writes a full pair. A drag is held in the store's transient
 * `themePreview`, which the canvas prefers, so it repaints live without
 * adding history or reaching autosave.
 */
export function ThemePanel() {
  const meta = useMeta();
  const { departments } = useEditorCallbacks();
  const preview = useEditorStore((s) => s.themePreview);
  const setTheme = useEditorStore((s) => s.setTheme);
  const setPreview = useEditorStore((s) => s.setThemePreview);

  // A drag the panel never saw end (unmount mid-drag) must not leave colours.
  useEffect(() => () => useEditorStore.getState().setThemePreview(null), []);

  const base = effectiveTheme(meta, departments) ?? BISO_THEME;
  const shown = preview ?? base;
  const check = checkTheme(shown);
  const department = departments.find((d) => d.id === meta.department);

  const pair = (which: Which, hex: string): PageTheme => ({
    ...base,
    [which]: hex,
  });
  const commit = (which: Which, hex: string) => {
    const next = pair(which, hex);
    if (next.dark === base.dark && next.accent === base.accent) {
      setPreview(null);
      return;
    }
    setTheme(next);
  };

  const scope = meta.department
    ? `Applies to all ${department?.name ?? meta.department} pages`
    : "Applies to this page";

  const fields: { label: string; which: Which }[] = [
    { label: "Dark", which: "dark" },
    { label: "Accent", which: "accent" },
  ];

  return (
    <div className="pe-colour-panel pe-insp-section">
      <div className="pe-insp-section__h">Theme</div>
      <p className="pe-colour__scope">{scope}</p>
      {fields.map(({ label, which }) => (
        <div className="pe-colour__block" key={which}>
          <ColourField
            label={label}
            onChange={(hex) => setPreview(pair(which, hex))}
            onCommit={(hex) => commit(which, hex)}
            value={shown[which]}
          />
          <Result
            check={check[which]}
            onUse={(hex) => commit(which, hex)}
            which={which}
          />
        </div>
      ))}
      <button
        className="pe-colour__reset"
        onClick={() => setTheme(null)}
        type="button"
      >
        Reset
      </button>
    </div>
  );
}
