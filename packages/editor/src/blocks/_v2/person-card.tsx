import { externalLinkProps, safeHref } from "./links";

const WHITESPACE = /\s+/g;

function initialsOf(name: string): string {
  const words = (typeof name === "string" ? name : "")
    .trim()
    .split(WHITESPACE)
    .filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
const LINK =
  "type-body-sm break-words text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * Name, role and contact links. Contact hrefs are built here and still pass
 * `safeHref`, so a stored `javascript:` value never becomes a link.
 */
export function PersonCard({
  email,
  imageSrc,
  name,
  phone,
  position,
}: {
  email?: string | null;
  imageSrc?: string | null;
  name: string;
  phone?: string | null;
  position?: string | null;
}) {
  const mail = email ? safeHref(`mailto:${email.trim()}`) : null;
  // `mailto:javascript:…` is a harmless mailto, but the address itself must
  // not look like a script scheme either.
  const mailOk = mail && !email?.trim().toLowerCase().startsWith("javascript:");
  const tel = phone ? safeHref(`tel:${phone.replace(WHITESPACE, "")}`) : null;

  return (
    <div className="flex flex-col items-center gap-3 rounded-biso-md border border-edge bg-surface-raised p-5 text-center">
      <span className="type-heading-card flex size-16 items-center justify-center overflow-hidden rounded-biso-pill bg-surface-sunken text-ink-accent">
        {imageSrc ? (
          // biome-ignore lint/correctness/useImageSize: fills the avatar frame.
          <img
            alt=""
            className="size-16 object-cover"
            decoding="async"
            loading="lazy"
            src={imageSrc}
          />
        ) : (
          <span aria-hidden="true" data-monogram="">
            {initialsOf(name)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="type-heading-card block break-words text-ink">
          {name}
        </span>
        {position ? (
          <span className="type-body-sm block break-words text-ink-muted">
            {position}
          </span>
        ) : null}
      </span>
      {mailOk || tel ? (
        <span className="flex min-w-0 flex-col items-center gap-1">
          {mailOk ? (
            <a className={LINK} href={mail} {...externalLinkProps(mail)}>
              {email}
            </a>
          ) : null}
          {tel ? (
            <a className={LINK} href={tel}>
              {phone}
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
