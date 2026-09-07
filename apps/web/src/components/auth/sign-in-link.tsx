"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The sign-in link on the 401 page, carrying the path the visitor was refused.
 *
 * The only reason any part of that page is client-side: there is no server API
 * for the current pathname inside `unauthorized.tsx`. Isolating it here is what
 * lets the page itself be a Server Component and read its copy with
 * `getTranslations`.
 */
export function SignInLink({ label }: { label: string }) {
  const pathname = usePathname();

  return (
    <Link
      className="type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      href={`/auth/login?redirectTo=${encodeURIComponent(pathname)}`}
    >
      <LogIn aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </Link>
  );
}
