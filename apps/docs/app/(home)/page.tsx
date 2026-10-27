import { AREAS } from "lib/areas";
import { source } from "lib/source";
import Link from "next/link";

/** A plain entry into the two areas. */
export default function Home() {
  return (
    <main className="flex-1">
      <section className="bg-deep" data-surface="deep">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h1 className="type-display-lg text-ink">BISO Docs</h1>
        </div>
      </section>
      <nav
        aria-label="Documentation areas"
        className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:grid-cols-2"
      >
        {AREAS.map((area) => (
          <Link
            className="block border-edge border-t pt-4"
            href={area.href}
            key={area.id}
          >
            <span className="block font-bold text-action text-lg">
              {area.title}
            </span>
            <span className="mt-1 block text-ink-muted">
              {source.getPage([area.id])?.data.description}
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
