import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface MemberOnlyNoticeProps {
  /**
   * Members get a reassuring "your membership covers this" instead of the
   * join pitch — the event is still listed for both, only the copy differs.
   */
  isMember?: boolean;
}

/**
 * Says out loud what the "Members only" badge implies: this event is open to
 * BISO members, and a non-member has to join before taking part.
 *
 * Member-only events are listed to everyone (see `queryEvents`), so this
 * notice is what keeps that honest — without it a non-member would find the
 * event, follow the ticket link and only discover the requirement at the door.
 */
export function EventMemberOnlyNotice({
  isMember = false,
}: MemberOnlyNoticeProps) {
  const t = useTranslations("events");

  return (
    <Card className="border-orange-200 border-l-4 bg-orange-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500">
          <Users aria-hidden className="h-5 w-5 text-white" />
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-foreground">
            {t("memberOnly.title")}
          </h4>
          <p className="text-muted-foreground text-sm">
            {isMember
              ? t("memberOnly.memberDescription")
              : t("memberOnly.description")}
          </p>
          {!isMember && (
            <Button
              asChild
              className="mt-4 border-0 bg-orange-500 text-white hover:bg-orange-600"
              size="sm"
            >
              <Link href="/membership">{t("memberOnly.cta")}</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
