"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Facebook, Instagram, Linkedin } from "lucide-react";

/**
 * The only client-side part of the footer.
 *
 * Everything else is a Server Component; these links exist as an island purely
 * because outbound clicks are tracked, and `trackEvent` needs `onClick`. Keeping
 * the island this small is the point — the old footer shipped its entire markup
 * to the browser to get this one behaviour.
 */
const SOCIALS = [
  {
    icon: Instagram,
    href: "https://www.instagram.com/biso_no",
    label: "Instagram",
  },
  {
    icon: Linkedin,
    href: "https://www.linkedin.com/company/biso",
    label: "LinkedIn",
  },
  {
    icon: Facebook,
    href: "https://www.facebook.com/biso.no",
    label: "Facebook",
  },
];

export function FooterSocial() {
  return (
    <ul className="flex gap-2">
      {SOCIALS.map((social) => (
        <li key={social.label}>
          <a
            // Named for assistive tech: the link's only content is an icon.
            aria-label={social.label}
            // Bordered, so the buttons are visible before hover. The old footer
            // set `bg-inverted` on a `bg-inverted` footer, making them invisible
            // until hovered, and hovered to a purple/pink gradient with no
            // relationship to the palette.
            className="flex size-10 items-center justify-center rounded-biso-md border border-edge text-ink transition-colors hover:border-transparent hover:bg-action hover:text-action-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href={social.href}
            onClick={() =>
              trackEvent("outbound_click", {
                url: social.href,
                label: social.label,
                surface: "footer",
              })
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <social.icon aria-hidden="true" className="size-5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
