"use client";

import { FeedSection } from "@/blocks/_v2/feed-section";
import { listOf } from "@/blocks/_v2/list";
import { sizedImageSrc } from "@/blocks/_v2/media";
import { PersonCard } from "@/blocks/_v2/person-card";
import type { PatchFn } from "@/blocks/types";
import { usePageFeedSource } from "@/editor/page-feed-context";
import { BOARD_FEED_LIMIT, pageFeedKey, teamSource } from "@/editor/page-feeds";
import type { TeamBlock, TeamMember } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface Props {
  block: TeamBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const AVATAR_WIDTH = 128;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function photoOf(member: TeamMember): string | null {
  const src = text(member.photo?.src);
  return src ? sizedImageSrc(src, AVATAR_WIDTH, member.photo?.mime) : null;
}

export function TeamRender({ block, edit, onPatch }: Props) {
  const { department, locale } = usePageFeedSource();
  const isBoard = teamSource(block.source) === "board";
  const { items: live } = useAutoFeed<TeamMember>({
    enabled: isBoard && !!department,
    key: pageFeedKey("board", department),
    url: `/api/pages/board?dept=${encodeURIComponent(department)}`,
  });
  const resolved = isBoard ? live : block.members;
  const members =
    resolved === null
      ? null
      : listOf<TeamMember>(resolved)
          .filter((member) => text(member.name).trim() !== "")
          .slice(0, BOARD_FEED_LIMIT);
  // Missing means the default, which shows contact details.
  const showContact = block.showContact !== false;

  return (
    <FeedSection
      columns={4}
      dept={isBoard ? department : ""}
      edit={edit}
      heading={text(block.heading)}
      items={members}
      locale={locale}
      noun={isBoard ? "board members" : "members to show yet"}
      onPatch={onPatch}
      requireDept={isBoard}
      seeAll={false}
      seeAllHref=""
    >
      {(members ?? []).map((member, i) => (
        <li key={`${member.name}-${i}`}>
          <PersonCard
            email={showContact ? text(member.email) : null}
            imageSrc={photoOf(member)}
            name={text(member.name)}
            // Board numbers are never published, whatever a feed carries.
            phone={showContact && !isBoard ? text(member.phone) : null}
            position={text(member.role)}
          />
        </li>
      ))}
    </FeedSection>
  );
}
