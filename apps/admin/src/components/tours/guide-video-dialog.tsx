"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useTranslations } from "next-intl";
import { SERIF_STACK, STUDIO } from "../../app/(portal)/_components/studio";
import { RECRUITMENT_GUIDE_VIDEO_URL } from "./recruitment-guide-video";

interface GuideVideoDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/**
 * Plays the recorded recruitment walkthrough in a modal. Controlled by the
 * caller so the dashboard can own its own trigger styling; the video element is
 * unmounted on close, which stops playback.
 */
export function GuideVideoDialog({
  open,
  onOpenChange,
}: GuideVideoDialogProps) {
  const t = useTranslations("adminPortal.tours.guideVideo");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-3xl"
        style={{
          background: STUDIO.paper,
          border: `0.5px solid ${STUDIO.rule}`,
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: STUDIO.ink,
            }}
          >
            {t("title")}
          </DialogTitle>
          <DialogDescription style={{ color: STUDIO.ink3 }}>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        {/* biome-ignore lint/a11y/useMediaCaption: the recorded walkthrough has no caption track yet. */}
        <video
          autoPlay
          controls
          playsInline
          preload="metadata"
          src={RECRUITMENT_GUIDE_VIDEO_URL}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            background: STUDIO.ink,
            border: `0.5px solid ${STUDIO.rule2}`,
            borderRadius: 10,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
