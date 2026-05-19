import "@repo/editor/theme/styles.css";
import { getBlock } from "@repo/editor/render";
import type { PageDoc, Block } from "@repo/editor/render";

interface Props {
  doc: PageDoc;
}

export function RenderedPage({ doc }: Props) {
  const accentStyle = { "--accent": doc.meta.accentColor } as React.CSSProperties;

  return (
    <div className="pg-page" style={accentStyle}>
      {doc.blocks.map((block) => (
        <BlockRenderer key={(block as Block).id} block={block as Block} doc={doc} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: Block; doc: PageDoc }) {
  const def = getBlock(block.type);
  if (!def) return null;
  return (
    <def.Render
      block={block as never}
      edit={false}
      onPatch={() => {}}
    />
  );
}
