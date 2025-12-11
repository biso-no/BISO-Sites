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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-section to-background p-4 dark:from-background dark:to-card">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
      >
        <Card className="border-0 p-8 text-center shadow-xl dark:bg-inverted/50 dark:backdrop-blur-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-4 font-bold text-2xl text-foreground dark:text-foreground">
            {t("states.signedOut.title")}
          </h2>
          <p className="mb-6 text-muted-foreground dark:text-muted-foreground">
            {t("states.signedOut.description")}
          </p>
          <Link href="/auth/login">
            <Button className="mb-4 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90">
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
