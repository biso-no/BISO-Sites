"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { TourProvider } from "@repo/tours/provider";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  loadTourProgress,
  saveTourProgress,
} from "../../app/(portal)/_actions/tour-progress";
import { getRecruitmentTourContext } from "../../app/(portal)/jobs/_actions/tour-context";
import { buildRecruitmentRegistry, TOUR_TRIGGERS } from "./registry";
import { StudioTourCard } from "./studio-tour-card";

/**
 * Host wrapper that binds the shared <TourProvider> to admin concerns:
 * Appwrite-backed persistence (server actions), Umami analytics, Next router
 * navigation for multi-page tours, and route-based auto-start. Mounted in the
 * recruitment layout so its state survives navigation across `/jobs/*`.
 */
export function AdminTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("adminPortal.tours");
  const [vacancyId, setVacancyId] = useState<string | null>(null);
  const [contextReady, setContextReady] = useState(false);

  const trigger = useMemo(
    () => TOUR_TRIGGERS.find((entry) => entry.match(pathname)) ?? null,
    [pathname]
  );

  // Resolve the runtime context (sample vacancy id) only when a tour could
  // actually fire on this route.
  useEffect(() => {
    if (!trigger) {
      return;
    }
    let cancelled = false;
    getRecruitmentTourContext()
      .then((context) => {
        if (!cancelled) {
          setVacancyId(context.vacancyId);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setContextReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trigger]);

  const registry = useMemo(
    () => buildRecruitmentRegistry({ vacancyId }),
    [vacancyId]
  );

  const persistence = useMemo(
    () => ({ load: loadTourProgress, save: saveTourProgress }),
    []
  );

  // Only offer the tour once the vacancy context has settled, so the registry is
  // in its final (multi-page) shape before TourProvider resumes a saved step.
  // Otherwise a returning user's step is clamped to the shorter no-workspace tour
  // and that clamped value overwrites their real progress.
  const autoStart =
    trigger && contextReady ? { tourId: trigger.tourId, eligible: true } : null;

  return (
    <TourProvider
      autoStart={autoStart}
      labels={{
        skip: t("controls.skip"),
        back: t("controls.back"),
        next: t("controls.next"),
        finish: t("controls.finish"),
        close: t("controls.close"),
        progress: (current, total) =>
          t("controls.progress", { current, total }),
      }}
      navigate={(path) => router.push(path)}
      onEvent={(event) => trackEvent(event.name, event.data)}
      persistence={persistence}
      registry={registry}
      renderStepCard={(context) => <StudioTourCard {...context} />}
      translate={(key) => t(key)}
    >
      {children}
    </TourProvider>
  );
}
