"use client";

import { Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MemberListItem } from "../../_actions/members";
import { EmptyState } from "../../_components/empty-state";
import { SearchToolbar } from "../../_components/search-toolbar";
import { STUDIO, StudioCrest } from "../../_components/studio";

interface MembersListClientProps {
  initialQuery: string;
  initialStatus: string;
  labels: {
    empty: string;
    emptyDescription: string;
    filterActive: string;
    filterAll: string;
    filterInactive: string;
    noCampus: string;
    noExpiry: string;
    noPlan: string;
    searchPlaceholder: string;
    statusActive: string;
    statusInactive: string;
    unnamed: string;
  };
  members: MemberListItem[];
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleDateString();
}

export function MembersListClient({
  initialQuery,
  initialStatus,
  labels,
  members,
}: MembersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  function updateParams(next: { q?: string; status?: string }) {
    const q = next.q ?? initialQuery;
    const status = next.status ?? initialStatus;

    const params = new URLSearchParams();
    if (q.trim()) {
      params.set("q", q.trim());
    }
    if (status) {
      params.set("status", status);
    }
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  const statusFilters = [
    { label: labels.filterAll, value: "" },
    { label: labels.filterActive, value: "active" },
    { label: labels.filterInactive, value: "inactive" },
  ];

  return (
    <>
      <SearchToolbar
        activeFilter={initialStatus}
        defaultSearch={initialQuery}
        filters={statusFilters}
        onFilterChange={(status) => updateParams({ status })}
        onSearch={(q) => updateParams({ q })}
        placeholder={labels.searchPlaceholder}
      />

      {members.length === 0 ? (
        <EmptyState
          description={labels.emptyDescription}
          icon={<UsersIcon size={28} />}
          title={labels.empty}
        />
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const expiry = formatDate(member.expiryDate);
            return (
              <Link
                className="group grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-5 py-4 transition-all hover:border-[#3DA9E0]/35"
                href={`/members/${encodeURIComponent(member.id)}`}
                key={member.id}
                style={{
                  background: "rgba(255,255,255,0.46)",
                  border: `0.5px solid ${STUDIO.rule}`,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StudioCrest icon={UsersIcon} label={member.name ?? ""} />
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

                <div className="min-w-0">
                  <p
                    className="truncate text-xs"
                    style={{ color: STUDIO.ink3 }}
                  >
                    {member.campusName ?? labels.noCampus}
                  </p>
                  <p
                    className="mt-1 truncate text-xs"
                    style={{ color: STUDIO.ink4 }}
                  >
                    {member.planName ?? labels.noPlan}
                  </p>
                </div>

                <div className="min-w-0">
                  <p
                    className="truncate text-xs"
                    style={{ color: STUDIO.ink3 }}
                  >
                    {expiry ?? labels.noExpiry}
                  </p>
                </div>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs"
                  style={{
                    background: member.isMember
                      ? "rgba(47,93,58,0.08)"
                      : STUDIO.paper2,
                    color: member.isMember ? STUDIO.leaf : STUDIO.ink3,
                  }}
                >
                  {member.isMember
                    ? labels.statusActive
                    : labels.statusInactive}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
