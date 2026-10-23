"use client";

import { ButtonLink, isLiveButton } from "@/blocks/_v2/button-link";
import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { externalLinkProps, safeHref } from "@/blocks/_v2/links";
import { sizedImageSrc } from "@/blocks/_v2/media";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { HeaderCrumb, MediaRef, PageHeader } from "@/editor/types";

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
  /**
   * The page's own title (`meta.title`). The site shows it when the header's
   * title is empty, so the page still has its `<h1>`.
   */
  fallbackTitle?: string;
  header: PageHeader;
  onPatch: PatchFn;
}

/** Text worth showing on the site: not empty, not only whitespace. */
const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

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
export function PageHeaderView({
  edit,
  fallbackTitle,
  header,
  onPatch,
}: PageHeaderViewProps) {
  const { media, variant } = header;
  const showAside = variant === "split" && (Boolean(media?.src) || edit);

  return (
    <header
      className="pg-header border-edge border-b bg-surface text-ink"
      // Full is a tall band only when there is media to fill it.
      data-media={media?.src ? "" : undefined}
      data-surface="deep"
      data-variant={variant}
    >
      {variant === "full" ? <FullMedia edit={edit} media={media} /> : null}

      <div className={showAside ? GRID_SPLIT : GRID}>
        <HeaderText
          edit={edit}
          fallbackTitle={fallbackTitle}
          header={header}
          onPatch={onPatch}
        />

        {showAside ? (
          <div className="w-full @3xl:max-w-none max-w-md">
            <ChevronMedia
              alt={media?.alt ?? ""}
              kind={media?.kind}
              // Above the fold, and likely the page's largest paint.
              loading="eager"
              loop={media?.kind === "video"}
              mime={media?.mime}
              placeholder={edit ? MEDIA_PROMPT : undefined}
              poster={media?.poster}
              posterMime={media?.posterMime}
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
function HeaderText({
  edit,
  fallbackTitle,
  header,
  onPatch,
}: PageHeaderViewProps) {
  const crumbs = edit
    ? header.crumbs
    : header.crumbs.filter((crumb) => crumb.label.trim());
  const buttons = edit ? header.buttons : header.buttons.filter(isLiveButton);

  return (
    <div className="min-w-0">
      {crumbs.length > 0 ? <Crumbs crumbs={crumbs} edit={edit} /> : null}

      {edit || hasText(header.eyebrow) ? (
        <EditableText
          className="type-label mb-3 text-ink-accent"
          data-placeholder={edit ? "Eyebrow" : undefined}
          edit={edit}
          onChange={(value) => onPatch("eyebrow", value)}
          tag="p"
          value={header.eyebrow}
        />
      ) : null}

      <HeaderTitle
        edit={edit}
        fallbackTitle={fallbackTitle}
        header={header}
        onPatch={onPatch}
      />

      {edit || hasText(header.lede) ? (
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
            <ButtonLink
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

/**
 * The page's only `<h1>`. The editor edits the header's own title, empty or
 * not; the site falls back to the page title, and renders no empty `<h1>`.
 */
function HeaderTitle({
  edit,
  fallbackTitle,
  header,
  onPatch,
}: PageHeaderViewProps) {
  const className = header.variant === "full" ? TITLE_FULL : TITLE;
  if (edit) {
    return (
      <EditableText
        className={className}
        data-placeholder={fallbackTitle?.trim() || "Page title"}
        edit
        onChange={(value) => onPatch("title", value)}
        tag="h1"
        value={header.title}
      />
    );
  }
  let title = "";
  if (hasText(header.title)) {
    title = header.title;
  } else if (hasText(fallbackTitle)) {
    title = fallbackTitle;
  }
  return title ? <h1 className={className}>{title}</h1> : null;
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
          const crumbHref = safeHref(crumb.href);
          return (
            <li className="flex items-center gap-2" key={`${i}-${crumb.label}`}>
              {i > 0 ? (
                <span aria-hidden="true" className="opacity-50">
                  /
                </span>
              ) : null}
              {crumbHref && !last && !edit ? (
                <a
                  className={CRUMB_LINK}
                  href={crumbHref}
                  {...externalLinkProps(crumbHref)}
                >
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

/** Full: the media covers the band under a flat navy scrim. */
function Backdrop({ media }: { media: MediaRef }) {
  const poster = media.poster
    ? sizedImageSrc(media.poster, BACKDROP_WIDTH, media.posterMime)
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
            src={sizedImageSrc(media.src, BACKDROP_WIDTH, media.mime)}
          />
        )}
      </div>
      <div aria-hidden="true" className="pg-header__scrim" />
    </>
  );
}
