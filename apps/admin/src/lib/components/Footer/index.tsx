import Link from "next/link";
import { ReactNode } from "react";
import { Instagram, Linkedin, Mail } from "lucide-react";

import { cn } from '@repo/ui/lib/utils';

type FooterLinkProps = {
  children: ReactNode;
  href?: string;
};

const isExternalHref = (href: string) => /^https?:\/\//.test(href);

const FOOTER_STATS = [
  { label: "Medlemmer", value: "10 000+" },
  { label: "Verv", value: "60+" },
  { label: "Arrangementer", value: "150+" },
];

const SOCIAL_LINKS = [
  { href: "https://linkedin.com", label: "LinkedIn", icon: Linkedin },
  { href: "https://instagram.com", label: "Instagram", icon: Instagram },
  { href: "mailto:post@biso.no", label: "E-post", icon: Mail },
];

const FooterLink = ({ children, href }: FooterLinkProps) => {
  const baseClasses =
    "text-sm text-primary-80 transition hover:text-primary hover:underline underline-offset-4";

  if (!href) {
    return (
      <li>
        <span className={baseClasses}>{children}</span>
      </li>
    );
  }

  if (href && isExternalHref(href)) {
    return (
      <li>
        <a href={href} target="_blank" rel="noreferrer" className={baseClasses}>
          {children}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className={baseClasses}>
        {children}
      </Link>
    </li>
  );
};

const FooterList = ({ children, title }: { children: ReactNode; title: string }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">{title}</h3>
    <ul className="space-y-2 text-sm text-primary-80">{children}</ul>
  </div>
);

interface FooterProps {
  children: React.ReactNode;
  className?: string;
}

const Footer = ({ children, className }: FooterProps) => {
  const madeByString = (
    <>
      💻 with ❤️ by{" "}
      <Link href="https://github.com/MHeien" target="_blank" className="font-semibold text-primary hover:text-primary-40">
        Markus Heien
      </Link>
    </>
  );

  return (
    <footer className={cn("relative border-t border-primary/10 bg-white text-primary-90", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-6 rounded-3xl border border-primary/10 bg-surface-card/60 px-6 py-6 shadow-card-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
              BI Student Organisation
            </p>
            <h2 className="font-heading text-2xl font-semibold text-primary-90 sm:text-3xl">
              Et moderne studentfellesskap for alle BI-campuser.
            </h2>
            <p className="max-w-xl text-sm text-primary-70">
              Vi samler arrangementer, verv og ressurser som gjør det enklere å delta i studentmiljøet – uansett hvor du studerer.
            </p>
          </div>
          <div className="flex flex-wrap justify-start gap-3">
            {FOOTER_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-2xl border border-primary/15 bg-white px-4 py-3 text-left shadow-sm"
              >
                <span className="text-lg font-semibold text-primary-90">{stat.value}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-primary/60">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

        <div className="flex flex-col gap-6 rounded-3xl border border-primary/10 bg-white px-6 py-5 shadow-card-soft md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-primary/60">Hold kontakten</p>
            <p className="text-sm text-primary-70">
              Følg oss i sosiale medier eller send oss en e-post for samarbeid og henvendelser.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {SOCIAL_LINKS.map((social) => (
              <Link
                key={social.href}
                href={social.href}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 text-primary-70 transition hover:bg-primary-10 hover:text-primary-80"
              >
                <social.icon className="h-4 w-4" />
                <span className="sr-only">{social.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-primary/10 pt-4 text-sm text-primary/60 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-primary/70">{madeByString}</span>
          <span>Org nr. 913 589 367 • Besøk oss i lokalene ved BI campus</span>
        </div>
      </div>
    </footer>
  );
};

Footer.List = FooterList;
Footer.Link = FooterLink;

export { Footer };
