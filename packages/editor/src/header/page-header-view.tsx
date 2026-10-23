"use client";

import { BUTTON_CLASS, ButtonLink } from "@/blocks/_v2/button-link";
import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { sizedImageSrc } from "@/blocks/_v2/media";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type {
  HeaderCrumb,
  LinkButton,
  MediaRef,
  PageHeader,
} from "@/editor/types";

/** Editor-only prompt where the header's media would go. */
const MEDIA_PROMPT = "Add a photo or video in the inspector";
const ASIDE_WIDTH = 900;
const BACKDROP_WIDTH = 2000;

const GRID = "relative mx-auto grid w-full max-w-biso gap-8";
const GRID_SPLIT =
  "relative mx-auto grid w-full max-w-biso gap-8 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @3xl:items-end";
const TITLE = "type-display-lg max-w-[18ch] text-ink";
const TITLE_FULL = "type-display-hero max-w-[18ch] text-ink";
const CRUMB_LINK =
  "underline-offset-4 hover:text-ink hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

interface PageHeaderViewProps {
  edit: boolean;
  header: PageHeader;
  onPatch: PatchFn;
}

/**
 * The page header, the editor's take on the site's `PageHeader`: a navy band
 * with breadcrumb, eyebrow, the page's only `<h1>`, lede and buttons. Split
 * sets the media in a chevron beside the text on a wide page and below it on
 * a narrow one; full lays it behind the text under a scrim; plain shows none.
 * The band clears the site's fixed nav itself (`--pg-nav-offset`).
 *
 * Without media the site shows text only. The editor shows where the media
 * goes instead, so choosing Split or Full visibly changes something.
 */
export function PageHeaderView({ edit, header, onPatch }: PageHeaderViewProps) {
  const { media, variant } = header;
  const showAside = variant === "split" && (Boolean(media?.src) || edit);

  return (
    <header
      className="pg-header border-edge border-b bg-surface text-ink"
      data-surface="deep"
      data-variant={variant}
    >
      {variant === "full" ? <FullMedia edit={edit} media={media} /> : null}

      <div className={showAside ? GRID_SPLIT : GRID}>
        <HeaderText edit={edit} header={header} onPatch={onPatch} />

        {showAside ? (
          <div className="w-full @3xl:max-w-none max-w-md">
            <ChevronMedia
              alt={media?.alt ?? ""}
              kind={media?.kind}
              loop={media?.kind === "video"}
              placeholder={edit ? MEDIA_PROMPT : undefined}
              poster={media?.poster}
              ratio="4/3"
              src={media?.src ?? ""}
              width={ASIDE_WIDTH}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Breadcrumb, eyebrow, title, lede and buttons. Empty ones stay off the site. */
function HeaderText({ edit, header, onPatch }: PageHeaderViewProps) {
  const crumbs = edit
    ? header.crumbs
    : header.crumbs.filter((crumb) => crumb.label.trim());
  const buttons = edit
    ? header.buttons
    : header.buttons.filter((b) => b.label.trim() && b.href.trim());

  return (
    <div className="min-w-0">
      {crumbs.length > 0 ? <Crumbs crumbs={crumbs} edit={edit} /> : null}

      {edit || header.eyebrow ? (
        <EditableText
          className="type-label mb-3 text-ink-accent"
          data-placeholder={edit ? "Eyebrow" : undefined}
          edit={edit}
          onChange={(value) => onPatch("eyebrow", value)}
          tag="p"
          value={header.eyebrow}
        />
      ) : null}

      <EditableText
        className={header.variant === "full" ? TITLE_FULL : TITLE}
        data-placeholder={edit ? "Page title" : undefined}
        edit={edit}
        onChange={(value) => onPatch("title", value)}
        tag="h1"
        value={header.title}
      />

      {edit || header.lede ? (
        <EditableText
          className="type-body mt-5 max-w-(--measure) text-ink-muted"
          data-placeholder={
            edit ? "One or two sentences about the page" : undefined
          }
          edit={edit}
          onChange={(value) => onPatch("lede", value)}
          tag="p"
          value={header.lede}
        />
      ) : null}

      {buttons.length > 0 ? (
        <div className="mt-7 flex flex-wrap gap-3">
          {buttons.map((button, i) => (
            <HeaderButton
              button={button}
              edit={edit}
              key={`${i}-${button.label}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Full: the media behind the text; on the canvas, a prompt where it goes. */
function FullMedia({ edit, media }: { edit: boolean; media?: MediaRef }) {
  if (media?.src) {
    return <Backdrop media={media} />;
  }
  if (!edit) {
    return null;
  }
  return (
    <div className="pg-header__media type-body-sm flex items-start justify-end bg-surface-sunken p-4 text-ink-muted">
      {MEDIA_PROMPT}
    </div>
  );
}

function Crumbs({ crumbs, edit }: { crumbs: HeaderCrumb[]; edit: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="type-body-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li className="flex items-center gap-2" key={`${i}-${crumb.label}`}>
              {i > 0 ? (
                <span aria-hidden="true" className="opacity-50">
                  /
                </span>
              ) : null}
              {crumb.href && !last && !edit ? (
                <a className={CRUMB_LINK} href={crumb.href}>
                  {crumb.label}
                </a>
              ) : (
                <span aria-current={last ? "page" : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A link on the site; inert on the canvas, where a click must not navigate. */
function HeaderButton({ button, edit }: { button: LinkButton; edit: boolean }) {
  if (!edit) {
    return <ButtonLink button={button} />;
  }
  return (
    <span className={BUTTON_CLASS[button.style]}>
      {button.label || "Button"}
    </span>
  );
}

/** Full: the media covers the band under a flat navy scrim. */
function Backdrop({ media }: { media: MediaRef }) {
  const poster = media.poster
    ? sizedImageSrc(media.poster, BACKDROP_WIDTH)
    : undefined;
  return (
    <>
      <div className="pg-header__media">
        {media.kind === "video" ? (
          <>
            <video
              autoPlay
              className="pg-reduced-motion-video"
              loop
              muted
              playsInline
              poster={poster}
              src={media.src}
            />
            {poster ? (
              // biome-ignore lint/correctness/useImageSize: covers the header, so it never shifts layout.
              <img
                alt={media.alt ?? ""}
                className="pg-reduced-motion-poster"
                decoding="async"
                src={poster}
              />
            ) : null}
          </>
        ) : (
          // biome-ignore lint/correctness/useImageSize: covers the header, so it never shifts layout.
          <img
            alt={media.alt ?? ""}
            decoding="async"
            src={sizedImageSrc(media.src, BACKDROP_WIDTH)}
          />
        )}
      </div>
      <div aria-hidden="true" className="pg-header__scrim" />
    </>
  );
}
