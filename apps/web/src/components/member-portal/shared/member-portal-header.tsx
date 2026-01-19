"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Crown,
  Gift,
  Shield,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type MemberPortalHeaderProps = {
  userName: string;
  userAvatar?: string | null;
  campus: string;
  membershipExpiry: string;
  daysRemaining: number;
  isMember?: boolean;
  benefitsCount?: number;
};

export function MemberPortalHeader({
  userName,
  userAvatar,
  campus,
  membershipExpiry,
  daysRemaining,
  isMember = true,
  benefitsCount = 0,
}: MemberPortalHeaderProps) {
  const t = useTranslations("memberPortal");
  const firstName = userName.split(" ")[0];
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient with animated elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-gradient-to via-brand-gradient-from to-brand-gradient-to">
        {/* Animated background shapes */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          className="-left-20 -top-20 absolute h-96 w-96 rounded-full bg-white/10 blur-3xl"
          transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY }}
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          className="-bottom-20 -right-20 absolute h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl"
          transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY }}
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          className="absolute top-1/4 left-1/3 h-64 w-64 rounded-full bg-brand-accent/10 blur-2xl"
          transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 py-12">
        <div className="mx-auto max-w-7xl px-4">
          {/* Back link */}
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            initial={{ opacity: 0, x: -20 }}
          >
            <Link
              className="mb-8 inline-flex items-center gap-2 text-white/80 transition-colors hover:text-white"
              href="/"
            >
              <ArrowLeft className="h-5 w-5" />
              {t("backToHome")}
            </Link>
          </motion.div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            {/* User info section */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
            >
              {/* Avatar with glow effect */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/20 blur-xl" />
                <Avatar className="relative h-24 w-24 border-4 border-white/30 shadow-2xl lg:h-28 lg:w-28">
                  {userAvatar && (
                    <AvatarImage alt={userName} src={userAvatar} />
                  )}
                  <AvatarFallback className="bg-white/20 text-3xl text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {isMember && (
                  <div className="-bottom-1 -right-1 absolute flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent to-yellow-400 shadow-lg">
                    <Crown className="h-4 w-4 text-brand-gradient-to" />
                  </div>
                )}
              </div>

              <div>
                <motion.h1
                  animate={{ opacity: 1 }}
                  className="mb-2 font-bold text-3xl text-white lg:text-4xl"
                  initial={{ opacity: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {t("welcome", { name: firstName })}
                </motion.h1>
                <div className="flex flex-wrap items-center gap-3">
                  {isMember ? (
                    <>
                      <Badge className="border-white/30 bg-white/20 text-white backdrop-blur-sm">
                        <Shield className="mr-1.5 h-3.5 w-3.5" />
                        {t("common.member")}
                      </Badge>
                      <span className="text-white/80">
                        {campus} {t("common.campus")}
                      </span>
                    </>
                  ) : (
                    <Badge className="border-brand-accent/50 bg-brand-accent/20 text-brand-accent backdrop-blur-sm">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {t("header.nonMemberBadge")}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stats cards - only show for members */}
            {isMember && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-4"
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-white/20 bg-white/10 px-6 py-4 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                    <Gift className="h-4 w-4" />
                    {t("header.benefits")}
                  </div>
                  <div className="font-bold text-2xl text-white">
                    {benefitsCount}
                  </div>
                </Card>

                <Card className="border-white/20 bg-white/10 px-6 py-4 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                    <Calendar className="h-4 w-4" />
                    {t("common.membershipExpires")}
                  </div>
                  <div className="font-bold text-white text-xl">
                    {new Date(membershipExpiry).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </Card>

                <Card className="border-white/20 bg-white/10 px-6 py-4 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                    <Clock className="h-4 w-4" />
                    {t("common.daysRemaining")}
                  </div>
                  <div className="font-bold text-2xl text-white">
                    {daysRemaining}
                    <span className="ml-1 font-normal text-base text-white/70">
                      {t("header.days")}
                    </span>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* CTA for non-members */}
            {!isMember && (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                initial={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.3 }}
              >
                <Link href="/membership">
                  <Button
                    className="h-14 bg-white px-8 text-brand-gradient-to text-lg shadow-xl hover:bg-white/90"
                    size="lg"
                  >
                    <Crown className="mr-2 h-5 w-5" />
                    {t("header.becomeMember")}
                  </Button>
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Wave decoration at bottom */}
      <div className="-bottom-1 absolute right-0 left-0">
        <svg
          aria-hidden="true"
          className="w-full text-background dark:text-background"
          fill="currentColor"
          preserveAspectRatio="none"
          viewBox="0 0 1440 48"
        >
          <path d="M0,48L60,42.7C120,37,240,27,360,26.7C480,27,600,37,720,42.7C840,48,960,48,1080,42.7C1200,37,1320,27,1380,21.3L1440,16L1440,48L1380,48C1320,48,1200,48,1080,48C960,48,840,48,720,48C600,48,480,48,360,48C240,48,120,48,60,48L0,48Z" />
        </svg>
      </div>
    </div>
  );
}
