import "@repo/editor/theme/styles.css";
import type { Block, PageDoc } from "@repo/editor/render";
import { getBlock } from "@repo/editor/render";

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
