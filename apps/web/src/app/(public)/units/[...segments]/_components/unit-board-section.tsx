import { ImageWithFallback } from "@repo/ui/components/image";
import { Card } from "@repo/ui/components/ui/card";
import { Mail, ShieldCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UnitBoardMember } from "@/lib/data/unit-board";
import { unitMonogram } from "@/lib/unit-monogram";

interface UnitBoardSectionProps {
  members: UnitBoardMember[];
  unitName: string;
}

/**
 * The board, straight from Microsoft 365.
 *
 * This is the substance of a unit page for a student — "who do I talk to" —
 * so it sits above the fold-ish, ahead of news and merch, and is rendered on
 * the server rather than fetched after hydration. Roughly one unit in sixteen
 * has no directory entries; that case gets a real explanation and a next step,
 * not a spinner that never resolves.
 */
export async function UnitBoardSection({
  members,
  unitName,
}: UnitBoardSectionProps) {
  const t = await getTranslations("units");

  return (
    <section id="board">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-2xl text-foreground">
            <Users className="h-6 w-6 text-brand" />
            {t("detail.board.title")}
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            {t("detail.board.subtitle", { name: unitName })}
          </p>
        </div>
        {members.length > 0 && (
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            {t("detail.board.source")}
          </p>
        )}
      </div>

      {members.length === 0 ? (
        <Card className="border-border/50 border-dashed bg-card/60 p-10 text-center">
          <Users className="mx-auto mb-4 h-9 w-9 text-muted-foreground/60" />
          <h3 className="font-semibold text-foreground">
            {t("detail.board.emptyTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
            {t("detail.board.emptyBody")}
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {members.map((member) => (
            <li key={`${member.name}-${member.email ?? ""}`}>
              <BoardMemberCard member={member} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function BoardMemberCard({ member }: { member: UnitBoardMember }) {
  const t = await getTranslations("units");
  const crest = unitMonogram(member.name);

  return (
    <Card className="group h-full border-border/50 bg-card/80 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
      <div className="flex flex-col items-center text-center">
        <span
          className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full font-semibold text-2xl text-white shadow-md"
          style={{ background: crest.background }}
        >
          {member.imageUrl ? (
            <ImageWithFallback
              alt={member.name}
              className="h-full w-full object-cover"
              height={96}
              src={member.imageUrl}
              width={96}
            />
          ) : (
            crest.initials
          )}
        </span>

        <h3 className="font-semibold text-base text-foreground">
          {member.name}
        </h3>
        {member.role && (
          <p className="mt-1 text-brand text-sm">{member.role}</p>
        )}

        {member.email && (
          <a
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:border-brand-border hover:text-brand"
            href={`mailto:${member.email}`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="max-w-[14rem] truncate">{member.email}</span>
            <span className="sr-only">
              {t("detail.board.emailAction", { name: member.name })}
            </span>
          </a>
        )}
      </div>
    </Card>
  );
}
