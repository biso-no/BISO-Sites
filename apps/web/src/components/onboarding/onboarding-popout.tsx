"use client";

import { cn } from "@repo/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

const DISMISSED_KEY = "biso_onboarding_dismissed";
const SHOW_DELAY_MS = 1400;

function wasDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(DISMISSED_KEY));
  } catch {
    return false;
  }
}

/**
 * A nudge to finish the profile, for a signed-in account without one. A
 * notice, not a page: it appears once the page has settled and remembers
 * being dismissed.
 */
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
    if (wasDismissed()) {
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [needsOnboarding, pathname]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Without storage it simply returns on the next visit.
    }
    setVisible(false);
  };

  const startOnboarding = () => {
    setVisible(false);
    router.push("/onboarding");
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby="onboarding-popout-title"
          className="fixed bottom-6 left-6 z-50 w-72 max-w-[calc(100vw-3rem)] rounded-biso-lg border border-edge bg-surface-raised p-5 shadow-elev-2"
          exit={{ opacity: 0, y: 16 }}
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <button
            aria-label={t("dismiss")}
            className="absolute top-3 right-3 rounded-biso-sm p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2"
            onClick={dismiss}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>

          <p
            className="type-heading-card pr-6 text-ink"
            id="onboarding-popout-title"
          >
            {t("title")}
          </p>
          <p className="type-body-sm text-ink-muted">{t("subtitle")}</p>

          <p className="type-body-sm mt-3 mb-4 text-ink-muted">
            {t("description")}
          </p>

          <div className="flex gap-2">
            <button
              className={cn(
                statusPanelPrimaryAction,
                "flex-1 justify-center px-3 py-2"
              )}
              onClick={startOnboarding}
              type="button"
            >
              {t("getStarted")}
            </button>
            <button
              className={cn(statusPanelSecondaryAction, "px-3 py-2")}
              onClick={dismiss}
              type="button"
            >
              {t("later")}
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
