"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ExternalLink, Share2, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";

type EventActionsProps = {
  ticketUrl?: string | null;
  title: string;
  description: string;
};

export function EventActions({
  ticketUrl,
  title,
  description,
}: EventActionsProps) {
  const t = useTranslations("events");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <Card className="border-0 bg-linear-to-br from-brand-gradient-to to-brand-gradient-from p-6 shadow-lg">
      <h3 className="mb-4 font-bold text-white text-xl">
        {ticketUrl ? t("actions.getTicket") : t("actions.registerNow")}
      </h3>
      <p className="mb-6 text-sm text-white/90">
        {ticketUrl
          ? t("actions.ticketDescription")
          : t("actions.registerDescription")}
      </p>
      {ticketUrl ? (
        <Button
          className="mb-3 w-full bg-background text-brand-dark hover:bg-background/90"
          onClick={() => window.open(ticketUrl, "_blank")}
        >
          <Ticket className="mr-2 h-4 w-4" />
          {t("actions.buyOnTickster")}
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button className="mb-3 w-full bg-background text-brand-dark hover:bg-background/90">
          <Ticket className="mr-2 h-4 w-4" />
          {t("actions.registerNow")}
        </Button>
      )}
      <Button
        className="w-full border-white text-white hover:bg-background/10"
        onClick={handleShare}
        variant="outline"
      >
        <Share2 className="mr-2 h-4 w-4" />
        {t("actions.shareEvent")}
      </Button>
    </Card>
  );
}
