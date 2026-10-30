import type { TaskGroup } from "lib/landing";
import Link from "next/link";

/**
 * Common tasks by area. Each heading links to its collection, which is what
 * earns it the sun underline (the brand's marker for a collection heading).
 */
export function TaskGroups({ groups }: { groups: TaskGroup[] }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="task-groups-heading">
      <h2 className="sr-only" id="task-groups-heading">
        Common tasks
      </h2>
      <div className="grid gap-[26px] px-4 pt-6 pb-7 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.href}>
            <h3 className="font-bold font-display text-[15px] uppercase tracking-[0.04em]">
              <Link
                className="inline-block border-sun border-b-[3px] pb-[3px] text-ink"
                href={group.href}
              >
                {group.title}
              </Link>
            </h3>
            <ul className="mt-2.5 text-[13.5px]">
              {group.tasks.map((task) => (
                <li className="border-edge border-b py-[5px]" key={task.href}>
                  <Link
                    className="text-action hover:underline"
                    href={task.href}
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
