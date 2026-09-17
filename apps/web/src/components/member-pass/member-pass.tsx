"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { CircleAlert, Link2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { MemberPassCard } from "./member-pass-card";
import { useMemberPass } from "./use-member-pass";

function StateCard({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 border border-primary/10 p-6 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary-80">
        {icon}
      </div>
      <p className="font-semibold text-lg text-primary-100">{title}</p>
      {description ? (
        <p className="max-w-sm text-primary-60 text-sm">{description}</p>
      ) : null}
      {action}
    </Card>
  );
}

/** The signed-in member's live pass, or the next step toward one. */
export function MemberPass({ linkHref = "/profile" }: { linkHref?: string }) {
  const t = useTranslations("memberPass");
  const pass = useMemberPass();

  if (pass.loading && !pass.data) {
    return (
      <StateCard
        icon={<Loader2 className="h-6 w-6 animate-spin" />}
        title={t("states.loading")}
      />
    );
  }

  const data = pass.data;
  if (data?.state === "active") {
    return (
      <MemberPassCard
        current={pass.current}
        now={pass.now}
        offline={pass.offline && !pass.current}
        onRetry={pass.refresh}
        pass={data}
        secondsLeft={pass.secondsLeft}
      />
    );
  }

  if (data?.state === "no_bi_identity") {
    return (
      <StateCard
        action={
          <Button asChild>
            <Link href={linkHref}>{t("states.noBiIdentity.action")}</Link>
          </Button>
        }
        description={t("states.noBiIdentity.description")}
        icon={<Link2 className="h-6 w-6" />}
        title={t("states.noBiIdentity.title")}
      />
    );
  }

  if (data?.state === "not_member" || data?.state === "expired") {
    const key = data.state === "expired" ? "expired" : "notMember";
    return (
      <StateCard
        action={
          <Button asChild>
            <Link href="/membership/join">{t(`states.${key}.action`)}</Link>
          </Button>
        }
        description={t(`states.${key}.description`)}
        icon={<Sparkles className="h-6 w-6" />}
        title={t(`states.${key}.title`)}
      />
    );
  }

  return (
    <StateCard
      action={
        <Button onClick={pass.refresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("states.unavailable.action")}
        </Button>
      }
      description={t("states.unavailable.description")}
      icon={<CircleAlert className="h-6 w-6" />}
      title={t("states.unavailable.title")}
    />
  );
}
