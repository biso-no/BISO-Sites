"use client";

import { Users as UsersIcon } from "lucide-react";
import type { RosterMemberItem } from "../../_actions/members";
import { EmptyState } from "../../_components/empty-state";
import { SearchToolbar } from "../../_components/search-toolbar";
import { STUDIO, StudioCrest } from "../../_components/studio";
import { useListParams } from "../../_components/use-list-params";

interface MembersListClientProps {
  initialQuery: string;
  labels: {
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    unknownCampus: string;
    unnamed: string;
  };
  members: RosterMemberItem[];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

export function MembersListClient({
  initialQuery,
  labels,
  members,
}: MembersListClientProps) {
  const { setParams } = useListParams();

  return (
    <>
      <SearchToolbar
        defaultSearch={initialQuery}
        onSearch={(q) => setParams({ q: q.trim() || null })}
        placeholder={labels.searchPlaceholder}
      />

      {members.length === 0 ? (
        <EmptyState
          description={labels.emptyDescription}
          icon={<UsersIcon size={28} />}
          title={labels.empty}
        />
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 rounded-2xl px-5 py-4"
              key={member.id}
              style={{
                background: "rgba(255,255,255,0.46)",
                border: `0.5px solid ${STUDIO.rule}`,
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <StudioCrest icon={UsersIcon} label={member.name} />
                <div className="min-w-0">
                  <p
                    className="truncate font-medium text-sm"
                    style={{ color: STUDIO.ink }}
                  >
                    {member.name || labels.unnamed}
                  </p>
                  <p
                    className="mt-1 truncate text-xs"
                    style={{ color: STUDIO.ink4 }}
                  >
                    {member.email ?? "—"}
                  </p>
                </div>
              </div>

              <p className="truncate text-xs" style={{ color: STUDIO.ink3 }}>
                {member.campusName ?? labels.unknownCampus}
              </p>

              <div className="min-w-0">
                <p className="truncate text-xs" style={{ color: STUDIO.ink3 }}>
                  {member.planName}
                </p>
                <p
                  className="mt-1 truncate text-xs"
                  style={{ color: STUDIO.ink4 }}
                >
                  {formatDate(member.expiryDate)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
