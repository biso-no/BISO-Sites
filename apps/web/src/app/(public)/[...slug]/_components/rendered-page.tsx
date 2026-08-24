"use client";

import "@repo/editor/theme/styles.css";
import type { Block, PageDoc } from "@repo/editor/render";
import {
  getBlock,
  normalizePageDoc,
  type ResolvedBackground,
  resolveBackgrounds,
  useEditorStore,
} from "@repo/editor/render";
import { useEffect, useMemo, useRef } from "react";

// This wrapper is a Client Component on purpose. Every block `Render` is
// itself `"use client"`, and BlockRenderer passes them an `onPatch` function.
// Passing a function prop across the Server→Client boundary is a hard RSC
// serialization error, so the boundary must sit here (the server page passes
// only the serializable `doc`). Blocks still SSR — they hydrate as before.

interface Props {
  doc: PageDoc;
}

export function RenderedPage({ doc }: Props) {
  const normalizedDoc = useMemo(() => normalizePageDoc(doc), [doc]);
  // Seed the shared editor store from this page's doc BEFORE the blocks render.
  // Auto-source blocks (events/jobs/news) resolve their live feed from
  // `useEditorStore(s => s.doc.meta.department)`; without seeding they'd read
  // the store default ("biso") and fetch the wrong department's feed. The
  // synchronous guard runs once before children first render (no wasted "biso"
  // fetch); the effect keeps it in sync if the doc prop changes on the same
  // mount. This mirrors how EditorShell seeds the store via setDoc.
  const seeded = useRef(false);
  if (!seeded.current) {
    useEditorStore.setState({ doc: normalizedDoc });
    seeded.current = true;
  }
  useEffect(() => {
    useEditorStore.setState({ doc: normalizedDoc });
  }, [normalizedDoc]);

  const accentStyle = {
    "--page-accent": normalizedDoc.meta.accentColor,
  } as React.CSSProperties;
  const backgrounds = resolveBackgrounds(normalizedDoc.blocks);

  return (
    <div className="biso-surface pg-page" style={accentStyle}>
      {normalizedDoc.blocks.map((block, index) => (
        <BlockRenderer
          background={backgrounds[index] ?? "default"}
          block={block as Block}
          key={(block as Block).id}
        />
      ))}
    </div>
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
