import { getTranslations } from "next-intl/server";
import { PersonCard } from "@/components/ui/person-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import type { UnitBoardMember } from "@/lib/data/unit-board";

interface UnitBoardSectionProps {
  members: UnitBoardMember[];
  unitName: string;
}

/**
 * The board, straight from Microsoft 365.
 *
 * This is the substance of a unit page for a student — "who do I talk to" —
 * so it sits directly under the introduction, ahead of news and merch, and is
 * rendered on the server rather than fetched after hydration. Roughly one unit
 * in sixteen has no directory entries; that case gets a real explanation and a
 * next step, not a spinner that never resolves.
 *
 * The directory also carries phone numbers; a unit board shows the email
 * address only, as it always has.
 */
export async function UnitBoardSection({
  members,
  unitName,
}: UnitBoardSectionProps) {
  const t = await getTranslations("units");

  return (
    <Section className="border-edge border-t" id="board" tone="paper">
      <SectionHeading className="mb-2">
        {t("detail.board.title")}
      </SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {t("detail.board.subtitle", { name: unitName })}
      </p>

      {members.length === 0 ? (
        <div className="max-w-(--measure) rounded-biso-md border border-edge p-8">
          <h3 className="type-heading-card text-ink">
            {t("detail.board.emptyTitle")}
          </h3>
          <p className="type-body-sm mt-2 text-ink-muted">
            {t("detail.board.emptyBody")}
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((member) => (
              <li key={`${member.name}-${member.email ?? ""}`}>
                <PersonCard
                  className="h-full"
                  email={member.email}
                  emailLabel={t("detail.board.emailAction", {
                    name: member.name,
                  })}
                  imageUrl={member.imageUrl}
                  name={member.name}
                  position={member.role}
                />
              </li>
            ))}
          </ul>
          <p className="type-body-sm mt-6 text-ink-muted">
            {t("detail.board.source")}
          </p>
        </>
      )}
    </Section>
  );
}
