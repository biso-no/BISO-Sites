"use client";

import { clientFunctions } from "@repo/api/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
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

type MembershipCheckResult =
  | {
      ok: true;
      active: boolean;
      membership?: any;
      studentId?: number;
      categories?: number[];
    }
  | { ok: false; error: string };

type MembershipPayload = {
  membership?: { status?: string };
  active?: boolean;
  studentId?: number;
  categories?: number[];
  error?: string;
};

type StatusVisuals = {
  actionLabel: string;
  badgeClassName: string;
  badgeLabel: string;
  badgeVariant: "secondary" | "destructive";
  iconBackgroundClassName: string;
  iconClassName: string;
  IconComponent: LucideIcon;
  showPulse: boolean;
};

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
      badgeClassName: "bg-green-600 text-white hover:bg-green-600",
      badgeLabel: "Verified Member",
      badgeVariant: "secondary",
      iconBackgroundClassName: "bg-green-500/15",
      iconClassName: "text-green-600",
      IconComponent: CheckCircle2,
      showPulse: true,
    };
  }

  if (hasError) {
    return {
      actionLabel: "Become a member",
      badgeClassName: "bg-red-600 text-white hover:bg-red-600",
      badgeLabel: "Verification Error",
      badgeVariant: "destructive",
      iconBackgroundClassName: "bg-red-500/10",
      iconClassName: "text-red-600",
      IconComponent: CircleAlert,
      showPulse: false,
    };
  }

  return {
    actionLabel: "Become a member",
    badgeClassName: "bg-amber-500 text-white hover:bg-amber-500",
    badgeLabel: "Not Verified",
    badgeVariant: "secondary",
    iconBackgroundClassName: "bg-amber-500/10",
    iconClassName: "text-amber-600",
    IconComponent: CircleAlert,
    showPulse: false,
  };
};

const parseExecutionPayload = (exec: unknown): MembershipPayload => {
  if (!exec || typeof exec !== "object") {
    return {};
  }

  const maybeExec = exec as { responseBody?: string; response?: string };
  try {
    return JSON.parse(maybeExec.responseBody ?? maybeExec.response ?? "{}");
  } catch {
    return {};
  }
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
    (payload: MembershipPayload) => {
      const active =
        Boolean(payload.membership?.status) || payload.active === true;
      setState({
        ok: true,
        active,
        membership: payload.membership,
        studentId: payload.studentId,
        categories: payload.categories,
      });
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
        const exec = await clientFunctions.createExecution(
          "verify_biso_membership",
          undefined,
          false
        );
        const payload = parseExecutionPayload(exec);
        if (payload.error) {
          handleVerificationError(String(payload.error));
          return;
        }
        handleVerificationSuccess(payload);
      } catch (error) {
        handleVerificationError(extractErrorMessage(error));
      }
    });
  }, [handleVerificationError, handleVerificationSuccess, hasBIIdentity]);

  return (
    <Card className="relative overflow-hidden border border-primary/10  shadow-card-soft">
      <h2 className="sr-only">BI Student Membership</h2>
      {/* Background flair */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="-top-24 -right-24 absolute h-64 w-64 rounded-full bg-secondary-30 blur-3xl" />
        <div className="-bottom-28 -left-28 absolute h-64 w-64 rounded-full bg-blue-accent/30 blur-3xl" />
      </div>
      <CardContent className="relative z-10 flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
        {/* Left: logos + title */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <span
              className={`absolute inset-0 rounded-full ${statusVisuals.iconBackgroundClassName}`}
            />
            {(() => {
              const Icon = statusVisuals.IconComponent;
              return (
                <Icon
                  className={`relative h-8 w-8 ${statusVisuals.iconClassName}`}
                />
              );
            })()}
            {statusVisuals.showPulse && (
              <span className="absolute h-full w-full animate-ping-slow rounded-full bg-green-400/30" />
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Image
                  alt="BISO"
                  className="rounded-sm"
                  height={28}
                  src="/images/logo-light.png"
                  width={28}
                />
                <span className="font-semibold text-primary-100">BISO</span>
              </div>
              <span className="text-primary-40">•</span>
              <div className="flex items-center gap-2">
                <Image
                  alt="BI"
                  className="h-8 w-8"
                  height={32}
                  src="/images/BI_POSITIVE.svg"
                  width={32}
                />
                <span className="font-semibold text-primary-100">
                  BI Student
                </span>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                className={statusVisuals.badgeClassName}
                variant={statusVisuals.badgeVariant}
              >
                {statusVisuals.badgeLabel}
              </Badge>
              <span className="truncate text-primary-70 text-sm">
                {subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="rounded-lg"
              disabled={isRefreshing || !hasBIIdentity}
              onClick={onRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />{" "}
              {isRefreshing ? "Refreshing" : "Refresh status"}
            </Button>
            <Button asChild className="rounded-lg" variant="outline">
              <Link href={MEMBERSHIP_ROUTE}>{statusVisuals.actionLabel}</Link>
            </Button>
          </div>
          <p className="text-primary-60 text-xs">{infoText}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default MembershipStatusCard;
