"use client";

import { slugifyAnchor } from "@/editor/operations";
import { COLUMN_COUNT } from "@/editor/sections";
import type {
  Section,
  SectionBackgroundImage,
  SectionLayout,
} from "@/editor/types";
import { SECTION_LAYOUTS } from "../canvas/add-section";
import { type Choice, InspRow, InspSection, Segmented } from "./insp-parts";
import { MediaPicker } from "./media-picker";

const BACKGROUNDS: Choice<SectionLayout["background"]>[] = [
  { label: "White", value: "white" },
  { label: "Tinted", value: "tinted" },
  { label: "Dark", value: "dark" },
  { label: "Photo", value: "photo" },
];
const SPACINGS: Choice<SectionLayout["spacing"]>[] = [
  { label: "Tight", value: "tight" },
  { label: "Normal", value: "normal" },
  { label: "Roomy", value: "roomy" },
];
const ALIGNS: Choice<SectionLayout["align"]>[] = [
  { label: "Top", value: "top" },
  { label: "Middle", value: "middle" },
  { label: "Bottom", value: "bottom" },
];
const TABLETS: Choice<SectionLayout["tablet"]>[] = [
  { label: "Side by side", value: "row" },
  { label: "Stacked", value: "stack" },
];

/**
 * A Photo section's image and its alt text. The image is uploaded or linked
 * like a block's; the alt text shows once there is an image to describe.
 */
function BackgroundImageFields({
  image,
  onChange,
}: {
  image: SectionBackgroundImage | undefined;
  onChange: (image: SectionBackgroundImage | undefined) => void;
}) {
  const alt = image?.alt;
  return (
    <InspSection label="Background image">
      <MediaPicker
        accept="image/*"
        onClear={() => onChange(undefined)}
        onPicked={(fileId, src) => onChange({ alt, fileId, src })}
        onUrl={(src) => onChange({ alt, src })}
        src={image?.src}
      />
      {image?.src ? (
        <InspRow label="Alt text">
          <input
            aria-label="Alt text"
            onChange={(e) => onChange({ ...image, alt: e.target.value })}
            placeholder="What the photo shows"
            value={alt ?? ""}
          />
        </InspRow>
      ) : null}
    </InspSection>
  );
}

export function SectionPanel({
  onAnchor,
  onDelete,
  onDuplicate,
  onLayout,
  section,
}: {
  onAnchor: (anchor: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayout: (patch: Partial<SectionLayout>) => void;
  section: Section;
}) {
  const { layout } = section;
  const count = COLUMN_COUNT[layout.columns];
  let reverseLabel: string | null = null;
  if (count === 2) {
    reverseLabel = "Show column 2 first";
  } else if (count > 2) {
    reverseLabel = "Reverse order on phone";
  }
  // The link name field keeps what is typed and commits on blur or Enter.
  // Slugifying every keystroke trimmed the trailing dash, so no space could
  // be typed, and made each keystroke its own undo step.
  const anchor = section.anchor ?? "";
  const commitAnchor = (field: { value: string }) => {
    const typed = field.value;
    field.value = slugifyAnchor(typed);
    if (field.value !== anchor) {
      onAnchor(typed);
    }
  };

  return (
    <>
      <InspSection label="Section layout">
        <div className="pe-variant-grid">
          {SECTION_LAYOUTS.map((option) => (
            <button
              aria-label={option.label}
              className={`pe-variant ${option.columns === layout.columns ? "on" : ""}`}
              key={option.columns}
              onClick={() => onLayout({ columns: option.columns })}
              title={option.label}
              type="button"
            >
              <span aria-hidden="true" className="pe-add-section__cols">
                {option.widths.map((width, i) => (
                  <span
                    key={`${option.columns}-${i}`}
                    style={{ flexGrow: width }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      </InspSection>

      <InspSection label="Appearance">
        <InspRow label="Background">
          <Segmented
            choices={BACKGROUNDS}
            onPick={(background) => onLayout({ background })}
            value={layout.background}
          />
        </InspRow>
        <InspRow label="Spacing">
          <Segmented
            choices={SPACINGS}
            onPick={(spacing) => onLayout({ spacing })}
            value={layout.spacing}
          />
        </InspRow>
        <InspRow label="Align columns">
          <Segmented
            choices={ALIGNS}
            onPick={(align) => onLayout({ align })}
            value={layout.align}
          />
        </InspRow>
      </InspSection>

      {layout.background === "photo" && (
        <BackgroundImageFields
          image={layout.backgroundImage}
          onChange={(backgroundImage) => onLayout({ backgroundImage })}
        />
      )}

      <InspSection label="Responsive">
        <InspRow label="Tablet">
          <Segmented
            choices={TABLETS}
            onPick={(tablet) => onLayout({ tablet })}
            value={layout.tablet}
          />
        </InspRow>
        <InspRow label="Phone">
          <span className="pe-insp-note">Always stacked.</span>
        </InspRow>
        {reverseLabel && (
          <label className="pe-check">
            <input
              checked={layout.phoneReverse}
              onChange={(e) => onLayout({ phoneReverse: e.target.checked })}
              type="checkbox"
            />
            {reverseLabel}
          </label>
        )}
        <label className="pe-check">
          <input
            checked={layout.hideOnPhone}
            onChange={(e) => onLayout({ hideOnPhone: e.target.checked })}
            type="checkbox"
          />
          Hide section on phone
        </label>
      </InspSection>

      <InspSection label="Link name">
        <div className="pe-row">
          <input
            aria-label="Link name"
            defaultValue={anchor}
            // A new section, or an undo, shows the stored name afresh.
            key={`${section.id}:${anchor}`}
            onBlur={(e) => commitAnchor(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitAnchor(e.currentTarget);
              }
            }}
          />
        </div>
        <p className="pe-insp-note">Buttons can link to #name</p>
      </InspSection>

      <InspSection label="Actions">
        <div className="pe-insp-actions">
          <button onClick={onDuplicate} type="button">
            Duplicate
          </button>
          <button onClick={onDelete} type="button">
            Delete
          </button>
        </div>
      </InspSection>
    </>
  );
}
