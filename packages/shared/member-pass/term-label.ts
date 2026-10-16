import type { MemberPassHolder } from "./types";

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string;

export function termLabel(t: Translate, holder: MemberPassHolder): string {
  const { term } = holder;
  if (!term) {
    return holder.membershipName;
  }
  if (term.season) {
    return t("term.semester", { season: term.season, year: term.fromYear });
  }
  return t("term.span", { from: term.fromYear, to: term.toYear });
}
