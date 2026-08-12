"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Button } from "@repo/ui/components/ui/button";
import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface ArticleShareProps {
  articleId: string;
  lead: string;
  title: string;
}

const COPIED_RESET_MS = 2500;

/**
 * One control: the native share sheet where the browser offers it, a clipboard
 * copy everywhere else. The label reports which one happened.
 */
export function ArticleShare({ articleId, title, lead }: ArticleShareProps) {
  const t = useTranslations("news.article");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    []
  );

  const handleShare = async () => {
    trackEvent("share", { type: "news", newsId: articleId });
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text: lead, url });
        return;
      } catch {
        // Dismissed or unavailable — fall through to the clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard blocked — the address bar still holds the link.
    }
  };

  return (
    <Button
      className="w-full justify-center gap-2 border-brand-border-strong text-brand-dark hover:bg-brand-muted hover:text-brand-dark"
      onClick={handleShare}
      type="button"
      variant="outline"
    >
      {copied ? (
        <Check aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Share2 aria-hidden="true" className="h-4 w-4" />
      )}
      {copied ? t("linkCopied") : t("share")}
    </Button>
  );
}
