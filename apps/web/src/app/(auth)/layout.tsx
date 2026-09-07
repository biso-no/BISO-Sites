import "@/app/styles.css";

/**
 * The `(auth)` group renders outside `SiteShell` — no header, no footer, no
 * providers — so it needs its own `<main>`. Until RD-013 the root layout
 * supplied one for every route; removing that (it was swallowing the whole
 * page, nav and footer included) would otherwise have left the login tree with
 * no main landmark at all.
 *
 * No skip link here: there is no chrome to skip past.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main>{children}</main>;
}
