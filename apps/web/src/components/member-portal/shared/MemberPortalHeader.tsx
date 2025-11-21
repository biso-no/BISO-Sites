"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type MemberPortalHeaderProps = {
  userName: string;
  userAvatar?: string | null;
  campus: string;
  membershipExpiry: string;
  daysRemaining: number;
};

export function MemberPortalHeader({
  userName,
  userAvatar,
  campus,
  membershipExpiry,
  daysRemaining,
}: MemberPortalHeaderProps) {
  const t = useTranslations("memberPortal");
  const firstName = userName.split(" ")[0];
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] py-8 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <Link
          className="mb-6 flex items-center gap-2 text-white/80 transition-colors hover:text-white"
          href="/"
        >
          <ArrowLeft className="h-5 w-5" />
          {t("backToHome")}
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-white/20">
              {userAvatar && <AvatarImage alt={userName} src={userAvatar} />}
              <AvatarFallback className="bg-white/20 text-2xl text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="mb-1 font-bold text-3xl text-white">
                {t("welcome", { name: firstName })}
              </h1>
              <p className="text-white/80">
                {t("common.member")} • {campus} {t("common.campus")}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Card className="border-white/20 bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="mb-1 text-sm text-white/70">
                {t("common.membershipExpires")}
              </div>
              <div className="flex items-center gap-2 text-white">
                <Calendar className="h-4 w-4" />
                {new Date(membershipExpiry).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </Card>
            <Card className="border-white/20 bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="mb-1 text-sm text-white/70">
                {t("common.daysRemaining")}
              </div>
              <div className="flex items-center gap-2 text-white">
                <Clock className="h-4 w-4" />
                {t("overview.daysRemaining", { days: daysRemaining })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
