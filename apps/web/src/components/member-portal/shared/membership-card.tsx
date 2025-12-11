import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

type MembershipCardProps = {
  userName: string;
  studentId: string;
  membershipType: string;
  expiryDate: string;
};

export function MembershipCard({
  userName,
  studentId,
  membershipType,
  expiryDate,
}: MembershipCardProps) {
  const t = useTranslations("memberPortal.membership");

  return (
    <Card className="border-0 bg-linear-to-br from-brand-gradient-to to-brand-gradient-from p-6 text-white">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-1 text-sm text-white/70">{t("bisoMember")}</div>
          <div className="font-semibold text-white">{userName}</div>
        </div>
        <Badge className="border-white/30 bg-background/20 text-white">
          {membershipType}
        </Badge>
      </div>

      <div className="mb-8 space-y-2">
        <div className="text-sm text-white/70">{t("studentId")}</div>
        <div className="font-mono text-lg text-white">{studentId}</div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-white/70 text-xs">{t("validUntil")}</div>
          <div className="text-sm text-white">
            {new Date(expiryDate).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-background/20">
          <QrCode className="h-10 w-10 text-white" />
        </div>
      </div>
    </Card>
  );
}
