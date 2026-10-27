import type { ReadingPath } from "lib/landing";
import Link from "next/link";

/**
 * "Start with your role": one numbered reading path per role, in columns
 * divided by hairlines (four, two below 1024px, one below 640px). Every cell
 * draws its own right and bottom rule; the grid is pulled 1px out under the
 * wrapper's clip, so the outer column's and last row's rules fall away and
 * the wrapper's own top and bottom rules frame the set.
 */
export function RolePaths({ paths }: { paths: ReadingPath[] }) {
  if (paths.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="role-paths-heading">
      <h2
        className="px-4 pt-[26px] pb-2.5 font-bold font-display text-[15px] text-ink uppercase tracking-[0.04em] md:px-6"
        id="role-paths-heading"
      >
        Start with your role
      </h2>
      <div className="overflow-hidden border-edge border-y">
        <div className="-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-4">
          {paths.map((path) => (
            <div
              className="border-edge border-r border-b px-4 pt-4 pb-[18px] md:px-6"
              key={path.role}
            >
              <h3 className="mb-2 font-bold font-sans text-[15px] text-ink tracking-normal">
                {path.role}
              </h3>
              <ol className="list-decimal ps-[18px] text-[13px] text-ink-muted">
                {path.steps.map((step) => (
                  <li className="mb-[3px]" key={step.href}>
                    <Link
                      className="text-action hover:underline"
                      href={step.href}
                    >
                      {step.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
