"use client";

import {
  CheckCircle2,
  CircleAlert,
  type LucideIcon,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pill, type PillTone } from "@/components/ui/pill";

/** The icon takes the tone's own colour; the pill supplies its own tint. */
const TONE_ICON: Record<PillTone, string> = {
  accent: "text-ink-accent",
  danger: "text-danger",
  marker: "text-ink",
  neutral: "text-ink-muted",
  success: "text-success",
  warning: "text-warning",
};

export type MembershipCheckResult =
  | {
      ok: true;
      active: boolean;
      membership?: Record<string, unknown>;
      studentId?: number;
      categories?: number[];
    }
  | { ok: false; error: string };

/**
 * Shape returned by `GET /api/membership` (see
 * `src/app/api/membership/route.ts`), which wraps `MembershipStatus` from
 * `@repo/shared/utils/membership-status`. This component is a Client
 * Component, so it cannot import that server-only module directly — it fetches
 * the route instead and mirrors the fields it needs here.
 */
interface MembershipInfo {
  category: string | null;
  expiryDate: string;
  id: string;
  name: string;
  startDate: string;
}

interface MembershipStatusPayload {
  checkedAt?: number;
  finagoCategoryIds?: number[];
  isMember?: boolean;
  memberships?: MembershipInfo[];
  reason?: string;
}

interface StatusVisuals {
  actionLabel: string;
  badgeLabel: string;
  IconComponent: LucideIcon;
  /** Design-system tone; replaces four hand-picked palette classes per state. */
  tone: PillTone;
}

const MEMBERSHIP_ROUTE = "/membership";

const getSubtitle = (
  hasBIIdentity: boolean,
  hasError: boolean,
  isActive: boolean
) => {
  if (!hasBIIdentity) {
    return "Link your BI Student account to verify.";
  }
  if (hasError) {
    return "We couldn’t verify your status right now.";
  }
  if (isActive) {
    return "Your BI Student membership is active.";
  }
  return "No active membership found.";
};

const getInfoText = (hasBIIdentity: boolean) =>
  hasBIIdentity
    ? "Membership status is linked to your BI Student account."
    : "Link your BI Student account under Linked Accounts to verify.";

const getStatusVisuals = ({
  isActive,
  hasError,
}: {
  isActive: boolean;
  hasError: boolean;
}): StatusVisuals => {
  if (isActive) {
    return {
      actionLabel: "View benefits",
      badgeLabel: "Verified Member",
      IconComponent: CheckCircle2,
      tone: "success",
    };
  }

  if (hasError) {
    return {
      actionLabel: "Become a member",
      badgeLabel: "Verification Error",
      IconComponent: CircleAlert,
      tone: "danger",
    };
  }

  return {
    actionLabel: "Become a member",
    badgeLabel: "Not Verified",
    IconComponent: CircleAlert,
    tone: "warning",
  };
};

const extractErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
};

function MembershipStatusCard({
  initial,
  hasBIIdentity = false,
}: {
  initial: MembershipCheckResult | null;
  hasBIIdentity?: boolean;
}) {
  const [state, setState] = useState<MembershipCheckResult | null>(initial);
  const [isRefreshing, startTransition] = useTransition();

  const isActive =
    state && "ok" in state && state.ok ? Boolean(state.active) : false;
  const hasError = state && "ok" in state && !state.ok;

  const subtitle = useMemo(
    () => getSubtitle(hasBIIdentity, Boolean(hasError), isActive),
    [hasBIIdentity, hasError, isActive]
  );

  const statusVisuals = useMemo(
    () => getStatusVisuals({ isActive, hasError: Boolean(hasError) }),
    [isActive, hasError]
  );

  const infoText = useMemo(() => getInfoText(hasBIIdentity), [hasBIIdentity]);

  const handleVerificationError = useCallback((message: string) => {
    setState({ ok: false, error: message });
    toast.error(`Verification failed: ${message}`);
  }, []);

  const handleVerificationSuccess = useCallback(
    (payload: MembershipStatusPayload) => {
      const active = payload.isMember === true;
      // Merge into the previous "ok" state rather than replacing it wholesale
      // — `/api/membership` has no `studentId` field, so a plain replace would
      // silently drop it. Nothing renders `studentId` today, but a future
      // consumer shouldn't get surprised by it vanishing on refresh.
      setState((prev) => ({
        ...(prev?.ok ? prev : {}),
        ok: true,
        active,
        membership: payload.memberships?.[0]
          ? { ...payload.memberships[0] }
          : undefined,
        categories: payload.finagoCategoryIds,
      }));
      toast.success(active ? "Membership verified" : "No active membership", {
        description: active ? "Enjoy your benefits across BISO." : undefined,
      });
    },
    []
  );

  const onRefresh = useCallback(() => {
    if (!hasBIIdentity) {
      toast.error("BI Student not linked", {
        description:
          "Link your BI Student account under Linked Accounts to verify membership.",
      });
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch("/api/membership?refresh=true", {
          cache: "no-store",
        });
        const payload = (await response.json()) as MembershipStatusPayload;
        if (!response.ok) {
          handleVerificationError("Failed to verify membership status");
          return;
        }
        handleVerificationSuccess(payload);
      } catch (error) {
        handleVerificationError(extractErrorMessage(error));
      }
    });
  }, [handleVerificationError, handleVerificationSuccess, hasBIIdentity]);

  const Icon = statusVisuals.IconComponent;

  return (
    <section className="rounded-biso-md border border-edge p-6">
      <h2 className="sr-only">BI Student Membership</h2>
      {/* Two decorative blur orbs used to sit behind this card painted in
          `bg-secondary-30` and `bg-blue-accent/30`. Neither colour is
          registered with Tailwind, so neither utility was ever emitted and
          both orbs rendered as nothing. The pulse ring beside them used
          `animate-ping-slow`, a keyframe that is likewise not defined. */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Icon
            aria-hidden="true"
            className={`size-8 shrink-0 ${TONE_ICON[statusVisuals.tone]}`}
          />

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex items-center gap-2">
                <Image
                  alt=""
                  className="rounded-biso-sm"
                  height={28}
                  src="/images/logo-light.png"
                  width={28}
                />
                <span className="type-heading-card text-ink">BISO</span>
              </span>
              <span aria-hidden="true" className="text-ink-muted">
                ·
              </span>
              <span className="flex items-center gap-2">
                <Image
                  alt=""
                  className="size-8"
                  height={32}
                  src="/images/BI_POSITIVE.svg"
                  width={32}
                />
                <span className="type-heading-card text-ink">BI Student</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={statusVisuals.tone}>{statusVisuals.badgeLabel}</Pill>
              <span className="type-body-sm min-w-0 break-words text-ink-muted">
                {subtitle}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
              disabled={isRefreshing || !hasBIIdentity}
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="size-4 shrink-0" />
              {isRefreshing ? "Refreshing" : "Refresh status"}
            </button>
            <Link
              className="type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={MEMBERSHIP_ROUTE}
            >
              {statusVisuals.actionLabel}
            </Link>
          </div>
          <p className="type-body-sm text-ink-muted md:text-right">
            {infoText}
          </p>
        </div>
      </div>
    </section>
  );
}

export default MembershipStatusCard;
