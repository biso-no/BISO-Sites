"use client";

import { Button } from "@repo/ui/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { StateCard } from "../join/gate-states";

/** The app's membership screen listens for this link and re-verifies on it. */
const APP_MEMBERSHIP_LINKED_URL = "biso://membership?linked=1";

export function LinkedState({ email }: { email: string }) {
  const t = useTranslations("membership.link.linked");
  return (
    <StateCard
      body={t("body", { email })}
      icon={CheckCircle2}
      title={t("title")}
    >
      <Button asChild>
        <a href={APP_MEMBERSHIP_LINKED_URL}>{t("cta")}</a>
      </Button>
    </StateCard>
  );
}
