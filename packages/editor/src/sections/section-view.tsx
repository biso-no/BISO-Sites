import type { ReactNode } from "react";
import { sizedImageSrc } from "@/blocks/_v2/media";
import type { Block, Column, Section, SectionBackground } from "@/editor/types";

interface SectionViewProps {
  edit?: boolean;
  /**
   * The page's first section clears the fixed site nav (`--pg-nav-offset`)
   * and, unless it is navy itself, paints a navy strip behind it.
   */
  first?: boolean;
  renderBlock: (block: Block) => ReactNode;
  renderColumnEnd?: (column: Column, columnIndex: number) => ReactNode;
  section: Section;
}

const PHOTO_WIDTH = 2000;

const flag = (on: boolean): "" | undefined => (on ? "" : undefined);

/** Navy surfaces flip the v2 aliases (`--ink`, `--edge`, `--action`…). */
const DEEP: Record<SectionBackground, boolean> = {
  dark: true,
  photo: true,
  tinted: false,
  white: false,
};

/**
 * One section: a responsive grid of columns. Layout is expressed as data
 * attributes and resolved by `sections.css`, so the public site and the admin
 * canvas break at the same container widths.
 */
export function SectionView({
  edit = false,
  first = false,
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
  // A Photo section with no image yet is a Dark one.
  const photo =
    layout.background === "photo" ? layout.backgroundImage : undefined;
  const background: SectionBackground =
    layout.background === "photo" && !photo?.src ? "dark" : layout.background;

  return (
    <section
      className="pg-sec"
      data-align={layout.align}
      data-background={background}
      data-columns={layout.columns}
      data-first={flag(first)}
      data-hide-phone={flag(hideOnPhone)}
      data-phone-reverse={flag(layout.phoneReverse)}
      data-spacing={layout.spacing}
      data-surface={DEEP[background] ? "deep" : undefined}
      data-tablet={layout.tablet}
      id={section.anchor}
    >
      {background === "photo" && photo ? (
        <>
          {/* biome-ignore lint/correctness/useImageSize: absolutely positioned to cover the section, so it never shifts layout. */}
          <img
            alt={photo.alt ?? ""}
            className="pg-sec__photo"
            decoding="async"
            loading={first ? "eager" : "lazy"}
            src={sizedImageSrc(photo.src, PHOTO_WIDTH, photo.mime)}
          />
          <div aria-hidden="true" className="pg-sec__scrim" />
        </>
      ) : null}
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
