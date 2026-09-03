"use client";

import { Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "biso_onboarding_dismissed";

export function OnboardingPopout({
  needsOnboarding,
}: {
  needsOnboarding: boolean;
}) {
  const t = useTranslations("onboarding.popout");
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!needsOnboarding || pathname === "/onboarding") {
      setVisible(false);
      return;
    }
    if (localStorage.getItem(DISMISSED_KEY)) {
      return;
    }
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, [needsOnboarding, pathname]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const startOnboarding = () => {
    setVisible(false);
    router.push("/onboarding");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-6 left-6 z-50 w-72 overflow-hidden rounded-2xl border border-brand-border bg-background shadow-2xl"
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ damping: 28, stiffness: 300, type: "spring" }}
        >
          <div className="relative p-5">
            <button
              aria-label={t("dismiss")}
              className="absolute top-3 right-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={dismiss}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted">
                <Sparkles className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {t("title")}
                </p>
                <p className="text-muted-foreground text-xs">{t("subtitle")}</p>
              </div>
            </div>

            <p className="mb-4 text-muted-foreground text-xs leading-relaxed">
              {t("description")}
            </p>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl bg-brand px-3 py-2 font-medium text-brand-foreground text-sm transition-colors hover:bg-brand/90"
                onClick={startOnboarding}
                type="button"
              >
                {t("getStarted")}
              </button>
              <button
                className="rounded-xl border border-border px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted"
                onClick={dismiss}
                type="button"
              >
                {t("later")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
