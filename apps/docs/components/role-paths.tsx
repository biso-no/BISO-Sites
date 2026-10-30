import { type ReadingPath, readingPaths } from "lib/landing";
import Link from "next/link";

type Area = "guide" | "developers";

function isUnder(path: ReadingPath, area: Area): boolean {
  return path.steps.every(
    (step) => step.href === `/${area}` || step.href.startsWith(`/${area}/`)
  );
}

/**
 * The reading paths of one area as an ordered list per role. Used on the
 * "Pick your role" page. A path is shown when every step is under the area.
 */
export function RolePaths({ area }: { area: Area }) {
  const paths = readingPaths.filter((path) => isUnder(path, area));

  return (
    <div className="not-prose my-6 space-y-8">
      {paths.map((path) => (
        <section key={path.role}>
          <h2 className="mb-2 font-bold font-display text-ink text-xl uppercase tracking-[0.04em]">
            {path.role}
          </h2>
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            {path.steps.map((step) => (
              <li key={step.href}>
                <Link className="text-action underline" href={step.href}>
                  {step.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
