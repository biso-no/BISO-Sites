"use client";

import "@repo/editor/theme/styles.css";
import type {
  Block,
  EditorLocale,
  PageDoc,
  PageFeedSnapshot,
} from "@repo/editor/render";
import {
  BlockView,
  legacyBackground,
  normalizePageDoc,
  PageFeedProvider,
  PageHeaderView,
  SectionView,
  useEditorStore,
} from "@repo/editor/render";
import { useEffect, useMemo, useRef } from "react";

// This wrapper is a Client Component on purpose. Every block `Render` is
// itself `"use client"`, and BlockRenderer passes them an `onPatch` function.
// Passing a function prop across the Server→Client boundary is a hard RSC
// serialization error, so the boundary must sit here (the server page passes
// only serializable values: the `doc` and the resolved `feeds`). Blocks still
// SSR — they hydrate as before.
//
// Note what this means for the auto-source blocks: they cannot fetch their own
// data on the server, so the server page resolves it for them and hands it
// down through `feeds`. That is why those blocks render real rows in the HTML
// without any of them becoming a Server Component.

interface Props {
  doc: PageDoc;
  /**
   * Auto-source feeds the server already resolved, keyed by `pageFeedKey`.
   * Plain JSON, so it crosses the RSC boundary that `onPatch` cannot.
   */
  feeds?: PageFeedSnapshot;
  locale: EditorLocale;
}

export function RenderedPage({ doc, feeds, locale }: Props) {
  const normalizedDoc = useMemo(() => normalizePageDoc(doc), [doc]);
  // Seed the shared editor store so anything still reading it (inspectors,
  // AI tooling) sees this page. The auto-source blocks do NOT rely on this —
  // they read `PageFeedProvider` below, because zustand hands
  // `getInitialState` to `useSyncExternalStore` as the server snapshot, so a
  // store mutated during render is invisible to SSR and the two passes would
  // disagree about which department to fetch.
  const seeded = useRef(false);
  if (!seeded.current) {
    useEditorStore.setState({ doc: normalizedDoc, locale });
    seeded.current = true;
  }
  useEffect(() => {
    useEditorStore.setState({ doc: normalizedDoc, locale });
  }, [normalizedDoc, locale]);

  const accentStyle = {
    "--page-accent": normalizedDoc.meta.accentColor,
  } as React.CSSProperties;
  const { header } = normalizedDoc;
  // Whatever renders first clears the fixed nav: the page header when there
  // is one, which does so itself, else the first section that renders. An
  // empty section renders nothing on the site, so it cannot be the one.
  const firstIndex = header
    ? -1
    : normalizedDoc.sections.findIndex((section) =>
        section.columns.some((column) => column.blocks.length > 0)
      );

  return (
    <PageFeedProvider
      campus={normalizedDoc.meta.campus ?? ""}
      department={normalizedDoc.meta.department}
      feeds={feeds}
      locale={locale}
    >
      <div className="biso-surface pg-page" style={accentStyle}>
        {header ? (
          <PageHeaderView
            edit={false}
            fallbackTitle={normalizedDoc.meta.title}
            header={header}
            onPatch={noopPatch}
          />
        ) : null}
        {normalizedDoc.sections.map((section, index) => (
          <SectionView
            first={index === firstIndex}
            key={section.id}
            renderBlock={(block) => (
              <BlockRenderer
                background={legacyBackground(section.layout.background)}
                block={block}
              />
            )}
            section={section}
          />
        ))}
      </div>
    </PageFeedProvider>
  );
}

const noopPatch = () => undefined;

function BlockRenderer({
  background,
  block,
}: {
  background: ReturnType<typeof legacyBackground>;
  block: Block;
}) {
  // BlockView, not the definition's Render: it is what applies the Design
  // panel's background, spacing and width, exactly as the admin canvas does.
  return (
    <BlockView
      background={background}
      block={block}
      edit={false}
      onPatch={noopPatch}
    />
  );
}
