"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { publishBusLists } from "../../../../_actions/big-event-buses";
import { PortalButton } from "../../../../_components/portal-button";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";
import type { MissingBusDetail } from "./bus-board-model";

interface PublishDialogProps {
  bigEventId: string;
  /** Bus details the messages would leave out; publishing still goes. */
  missing: MissingBusDetail[];
  onOpenChange: (open: boolean) => void;
  /** Everyone with a bus out: the people who get the message (N1). */
  riders: number;
}

const MISSING_KEYS: Record<MissingBusDetail["missing"], string> = {
  both: "missingBoth",
  departure: "missingDeparture",
  meeting_point: "missingMeetingPoint",
};

/**
 * "Publish bus lists": asks first, with how many people get a message and
 * which buses lack a departure time or meeting point the messages would
 * name.
 */
export function PublishDialog({
  bigEventId,
  missing,
  onOpenChange,
  riders,
}: PublishDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.buses.publish");
  const tb = useTranslations("adminPortal.bigEvents");
  const tc = useTranslations("adminPortal.common");
  const router = useRouter();
  const [isPublishing, startPublish] = useTransition();

  function publish() {
    startPublish(async () => {
      try {
        await publishBusLists(bigEventId);
        toast.success(t("done"));
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(tb("form.saveFailed"));
      }
    });
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!(open || isPublishing)) {
          onOpenChange(false);
        }
      }}
      open
    >
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("description", { count: riders })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {missing.length > 0 && (
          <div className="text-sm leading-6" style={{ color: STUDIO.ink2 }}>
            <p>{t("missingIntro")}</p>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((detail) => (
                <li key={`${detail.bus}-${detail.leg}`}>
                  {t(MISSING_KEYS[detail.missing], {
                    bus: detail.bus,
                    leg: detail.leg,
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isPublishing}>
            {tc("cancel")}
          </AlertDialogCancel>
          <PortalButton
            loading={isPublishing}
            onClick={publish}
            variant="primary"
          >
            {t("confirm")}
          </PortalButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
