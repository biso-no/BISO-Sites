"use client";

import "@repo/editor/theme/styles.css";
import type {
  Block,
  EditorLocale,
  PageDoc,
  PageFeedSnapshot,
} from "@repo/editor/render";
import {
  getBlock,
  normalizePageDoc,
  PageFeedProvider,
  type ResolvedBackground,
  resolveBackgrounds,
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
  const backgrounds = resolveBackgrounds(normalizedDoc.blocks);

  return (
    <PageFeedProvider
      department={normalizedDoc.meta.department}
      feeds={feeds}
      locale={locale}
    >
      <div className="biso-surface pg-page" style={accentStyle}>
        {normalizedDoc.blocks.map((block, index) => (
          <BlockRenderer
            background={backgrounds[index] ?? "default"}
            block={block as Block}
            key={(block as Block).id}
          />
        ))}
      </div>
    </PageFeedProvider>
  );
}

function BlockRenderer({
  background,
  block,
}: {
  background: ResolvedBackground;
  block: Block;
}) {
  const def = getBlock(block.type);
  if (!def) {
    return null;
  }
  const noopPatch = () => undefined;
  return (
    <def.Render
      background={background}
      block={block as never}
      edit={false}
      onPatch={noopPatch}
    />
  );
}
