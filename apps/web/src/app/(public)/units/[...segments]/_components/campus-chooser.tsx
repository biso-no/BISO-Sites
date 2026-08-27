import type { Departments } from "@repo/api/types/appwrite";
import {
  campusIdToLabel,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { setActiveCampus } from "@/app/actions/campus";

/**
 * Shown when /units/<slug> cannot resolve to one department: either the slug
 * is shared by 2+ campuses and no campus filter is set, or the visitor's
 * campus has no department with this slug.
 *
 * Choosing between 2+ campuses sets the site-wide campus filter and stays on
 * this URL, so the choice follows the visitor everywhere afterwards. When
 * there is only one destination (a national unit seen with a campus filter
 * on), it is a link instead — see `singleDestination`. Setting the cookie
 * already forces this page to re-render on the next request, so there is no
 * need to also `revalidatePath` — that would additionally purge every
 * `"use cache"` entry tagged for this path, a visitor-triggerable cache purge
 * in a codebase whose primary constraint is Appwrite fan-out.
 */
export function CampusChooser({
  matches,
  slug,
  unavailableAt,
}: {
  matches: Departments[];
  slug: string;
  unavailableAt: string | null;
}) {
  const title = matches[0]?.Name ?? slug;
  const campusWord = matches.length === 1 ? "campus" : "campuses";

  // "Not at Oslo. Available at: National" with a single button is not a choice
  // between campuses — it is a single destination. Making that button write the
  // site-wide campus cookie would silently move a student off their own campus
  // for every other page, which is far more than they asked for by opening one
  // national unit. Offer a plain link to the canonical URL instead; the
  // cookie-writing form below stays for the genuinely ambiguous case.
  const onlyMatch = matches.length === 1 ? matches[0] : undefined;
  const singleDestination =
    unavailableAt && onlyMatch
      ? unitCanonicalPath({
          campusId: onlyMatch.campus_id,
          slug: onlyMatch.slug,
        })
      : null;

  async function choose(formData: FormData) {
    "use server";
    const campusId = formData.get("campusId");
    // Only accept a campus actually offered on this page — never a value
    // handed back by the client verbatim.
    if (
      typeof campusId === "string" &&
      matches.some((department) => department.campus_id === campusId)
    ) {
      await setActiveCampus(campusId);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground">
        {unavailableAt
          ? `Not at ${unavailableAt}. Available at:`
          : `This unit exists at ${matches.length} ${campusWord}. Which is yours?`}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {singleDestination && onlyMatch ? (
          <Button asChild size="lg" variant="outline">
            <Link href={singleDestination}>
              {campusIdToLabel(onlyMatch.campus_id) ?? onlyMatch.campus_id}
            </Link>
          </Button>
        ) : (
          matches.map((department) => (
            <form action={choose} key={department.$id}>
              <input
                name="campusId"
                type="hidden"
                value={department.campus_id}
              />
              <Button size="lg" type="submit" variant="outline">
                {campusIdToLabel(department.campus_id) ?? department.campus_id}
              </Button>
            </form>
          ))
        )}
      </div>
    </div>
  );
}
