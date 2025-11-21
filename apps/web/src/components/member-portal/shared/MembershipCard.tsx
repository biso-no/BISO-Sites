import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

interface MembershipCardProps {
  userName: string;
  studentId: string;
  membershipType: string;
  expiryDate: string;
}

export function MembershipCard({
  userName,
  studentId,
  membershipType,
  expiryDate,
}: MembershipCardProps) {
  const t = useTranslations("memberPortal.membership");

  return (
    <Card className="p-6 bg-linear-to-br from-[#001731] to-[#3DA9E0] text-white border-0">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="text-white/70 text-sm mb-1">{t("bisoMember")}</div>
          <div className="text-white font-semibold">{userName}</div>
        </div>
        <Badge className="bg-white/20 text-white border-white/30">
          {membershipType}
        </Badge>
      </div>

      <div className="space-y-2 mb-8">
        <div className="text-white/70 text-sm">{t("studentId")}</div>
        <div className="text-white text-lg font-mono">{studentId}</div>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <div className="text-white/70 text-xs">{t("validUntil")}</div>
          <div className="text-white text-sm">
            {new Date(expiryDate).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
          <QrCode className="w-10 h-10 text-white" />
        </div>
      </div>
    </Card>
  );
}
