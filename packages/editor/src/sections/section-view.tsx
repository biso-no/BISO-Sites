import type { ReactNode } from "react";
import type { Block, Column, Section } from "@/editor/types";

interface SectionViewProps {
  edit?: boolean;
  renderBlock: (block: Block) => ReactNode;
  renderColumnEnd?: (column: Column, columnIndex: number) => ReactNode;
  section: Section;
}

const flag = (on: boolean): "" | undefined => (on ? "" : undefined);

/**
 * One section: a responsive grid of columns. Layout is expressed as data
 * attributes and resolved by `sections.css`, so the public site and the admin
 * canvas break at the same container widths.
 */
export function SectionView({
  edit = false,
  renderBlock,
  renderColumnEnd,
  section,
}: SectionViewProps) {
  const { layout } = section;
  const blocks = section.columns.flatMap((column) => column.blocks);
  if (blocks.length === 0 && !edit) {
    return null;
  }
  // A section whose every block is hidden on phones hides there too, or the
  // phone shows an empty band of section padding.
  const hideOnPhone =
    layout.hideOnPhone ||
    (blocks.length > 0 && blocks.every((block) => block.hideOnPhone === true));

  return (
    <section
      className="pg-sec"
      data-align={layout.align}
      data-background={layout.background}
      data-columns={layout.columns}
      data-hide-phone={flag(hideOnPhone)}
      data-phone-reverse={flag(layout.phoneReverse)}
      data-spacing={layout.spacing}
      data-tablet={layout.tablet}
      id={section.anchor}
    >
      <div className="pg-sec__grid">
        {section.columns.map((column, index) => (
          <div className="pg-col" data-col={index} key={column.id}>
            {column.blocks.map((block) => (
              <div
                className="pg-col__item"
                data-hide-phone={flag(block.hideOnPhone === true)}
                key={block.id}
              >
                {renderBlock(block)}
              </div>
            ))}
            {renderColumnEnd?.(column, index)}
          </div>
        ))}
      </div>
    </section>
  );
}
