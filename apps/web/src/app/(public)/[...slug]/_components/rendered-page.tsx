"use client";

import "@repo/editor/theme/styles.css";
import type { Block, PageDoc } from "@repo/editor/render";
import { getBlock } from "@repo/editor/render";

// This wrapper is a Client Component on purpose. Every block `Render` is
// itself `"use client"`, and BlockRenderer passes them an `onPatch` function.
// Passing a function prop across the Server→Client boundary is a hard RSC
// serialization error, so the boundary must sit here (the server page passes
// only the serializable `doc`). Blocks still SSR — they hydrate as before.

interface Props {
  doc: PageDoc;
}

export function RenderedPage({ doc }: Props) {
  const accentStyle = {
    "--accent": doc.meta.accentColor,
  } as React.CSSProperties;

  return (
    <div className="pg-page" style={accentStyle}>
      {doc.blocks.map((block) => (
        <BlockRenderer block={block as Block} key={(block as Block).id} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  const def = getBlock(block.type);
  if (!def) {
    return null;
  }
  const noopPatch = () => undefined;
  return <def.Render block={block as never} edit={false} onPatch={noopPatch} />;
}
