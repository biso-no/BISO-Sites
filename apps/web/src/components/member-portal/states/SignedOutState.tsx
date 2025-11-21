"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowLeft, Lock, Mail } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function SignedOutState() {
  const t = useTranslations("memberPortal");

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
      >
        <Card className="border-0 p-8 text-center shadow-xl dark:bg-gray-900/50 dark:backdrop-blur-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731]">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-4 font-bold text-2xl text-gray-900 dark:text-gray-100">
            {t("states.signedOut.title")}
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            {t("states.signedOut.description")}
          </p>
          <Link href="/auth/login">
            <Button className="mb-4 w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
              <Mail className="mr-2 h-4 w-4" />
              {t("states.signedOut.signIn")}
            </Button>
          </Link>
          <Link href="/">
            <Button className="w-full" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToHome")}
            </Button>
          </Link>
        </Card>
      </motion.div>
    </div>
  );
}
