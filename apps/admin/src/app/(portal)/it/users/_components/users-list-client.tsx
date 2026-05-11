"use client";

import type { M365UserListItem } from "@repo/shared/types/user-management";
import { CircleOff, Mail, Plus, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EmptyState } from "../../../_components/empty-state";
import { SearchToolbar } from "../../../_components/search-toolbar";

interface UsersListClientProps {
  initialQuery: string;
  labels: {
    create: string;
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    statusDisabled: string;
    statusEnabled: string;
    statusUnknown: string;
  };
  users: M365UserListItem[];
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleDateString();
}

function getStatus(
  user: M365UserListItem,
  labels: UsersListClientProps["labels"]
) {
  if (user.accountEnabled === true) {
    return {
      icon: ShieldCheck,
      label: labels.statusEnabled,
      color: "#4ade80",
      background: "rgba(74,222,128,0.10)",
    };
  }

  if (user.accountEnabled === false) {
    return {
      icon: CircleOff,
      label: labels.statusDisabled,
      color: "#f87171",
      background: "rgba(248,113,113,0.10)",
    };
  }

  return {
    icon: UserRound,
    label: labels.statusUnknown,
    color: "rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.05)",
  };
}

export function UsersListClient({
  users,
  initialQuery,
  labels,
}: UsersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleSearch(query: string) {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  return (
    <>
      <SearchToolbar
        defaultSearch={initialQuery}
        onSearch={handleSearch}
        placeholder={labels.searchPlaceholder}
      >
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm transition-all"
          href="/it/users/new"
          style={{
            background: "#3DA9E0",
            color: "#001731",
            boxShadow: "0 0 20px rgba(61,169,224,0.25)",
          }}
        >
          <Plus size={15} />
          {labels.create}
        </Link>
      </SearchToolbar>

      {users.length === 0 ? (
        <EmptyState
          description={labels.emptyDescription}
          icon={<UserRound size={28} />}
          title={labels.empty}
        />
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const status = getStatus(user, labels);
            const StatusIcon = status.icon;

            return (
              <Link
                className="group grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-5 py-4 transition-all hover:border-[#3DA9E0]/35"
                href={`/it/users/${encodeURIComponent(user.id)}`}
                key={user.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(61,169,224,0.10)",
                      border: "1px solid rgba(61,169,224,0.20)",
                    }}
                  >
                    <UserRound size={16} style={{ color: "#3DA9E0" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm text-white">
                      {user.displayName || user.userPrincipalName}
                    </p>
                    <p
                      className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs"
                      style={{ color: "rgba(255,255,255,0.38)" }}
                    >
                      <Mail size={12} />
                      {user.mail ?? user.userPrincipalName}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-white/70 text-xs">
                    {user.department ?? "No department"}
                  </p>
                  <p className="mt-1 truncate text-white/35 text-xs">
                    {user.jobTitle ?? "No job title"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-white/70 text-xs">
                    {user.officeLocation ?? "No office"}
                  </p>
                  <p className="mt-1 truncate text-white/35 text-xs">
                    Last sign-in: {formatDate(user.lastSignInDateTime)}
                  </p>
                </div>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs"
                  style={{ background: status.background, color: status.color }}
                >
                  <StatusIcon size={12} />
                  {status.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
