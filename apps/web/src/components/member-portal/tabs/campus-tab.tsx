"use client";

import { TabsContent } from "@repo/ui/components/ui/tabs";
import { BookOpen, MapPin, Users } from "lucide-react";
import { useTranslations } from "next-intl";

const CARDS = [
  { key: "localResources", icon: BookOpen },
  { key: "campusManagement", icon: Users },
  { key: "campusEvents", icon: MapPin },
] as const;

export function CampusTab() {
  const t = useTranslations("memberPortal.campus");

  return (
    <TabsContent className="flex flex-col gap-8" value="campus">
      <div>
        <h2 className="type-display-sm text-ink">{t("title")}</h2>
        <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
          {t("description")}
        </p>
      </div>

      <ul className="grid gap-5 md:grid-cols-3">
        {CARDS.map(({ key, icon: Icon }) => (
          <li className="rounded-biso-md border border-edge p-6" key={key}>
            <h3 className="type-heading-card flex items-center gap-2 text-ink">
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-ink-accent"
              />
              {t(`${key}.title`)}
            </h3>
            <p className="type-body-sm mt-2 text-ink-muted">
              {t(`${key}.description`)}
            </p>
          </li>
        ))}
      </ul>
    </TabsContent>
  );
}
