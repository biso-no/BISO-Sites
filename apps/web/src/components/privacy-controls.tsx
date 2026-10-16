"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { AlertCircle, Download, Loader2, Shield, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import { deleteUserData } from "@/lib/actions/user";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * The dialog's two buttons start from the shared button variants; these
 * settle what the type role and the variants both set (size, weight, height).
 */
const dialogButtonFix = "h-auto font-semibold text-xs";

/**
 * Destructive actions in the danger colour. `text-surface` on `bg-danger`
 * holds in both themes: white on the light theme's red, navy on the dark
 * theme's lighter red — white on that one would fail contrast.
 */
const dangerFilled = `type-label inline-flex items-center gap-2 rounded-biso-pill bg-danger px-5 py-3 text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const dangerOutline = `type-label inline-flex items-center gap-2 rounded-biso-pill border border-danger/40 px-5 py-3 text-danger transition-colors hover:bg-danger/10 ${focusRing}`;

export function PrivacyControls() {
  const t = useTranslations("common.profile.privacy");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestingData, setRequestingData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  const handleDataRequest = async () => {
    setRequestingData(true);

    try {
      // This would be replaced with your actual API call
      // For example: await requestUserData();

      // Simulate API request
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success(t("toasts.requestSubmitted"), {
        description: t("toasts.requestSubmittedBody"),
      });
    } catch (_error) {
      toast.error(t("toasts.requestFailed"), {
        description: t("toasts.requestFailedBody"),
      });
    } finally {
      setRequestingData(false);
    }
  };

  const handleDataDeletion = async () => {
    setDeletingData(true);

    try {
      const deleted = await deleteUserData();

      if (deleted) {
        toast.success(t("toasts.deleted"), {
          description: t("toasts.deletedBody"),
        });
      } else {
        throw new Error("Failed to delete account");
      }

      setDeleteDialogOpen(false);
    } catch (_error) {
      toast.error(t("toasts.deleteFailed"), {
        description: t("toasts.deleteFailedBody"),
      });
    } finally {
      setDeletingData(false);
    }
  };

  return (
    <>
      <section className="rounded-biso-md border border-edge p-6">
        <h2 className="type-heading-card flex items-center gap-2 text-ink">
          <Shield
            aria-hidden="true"
            className="size-5 shrink-0 text-ink-accent"
          />
          {t("title")}
        </h2>
        <p className="type-body-sm mt-1 text-ink-muted">{t("subtitle")}</p>

        <p className="type-body-sm mt-6 rounded-biso-md bg-surface-sunken p-4 text-ink-muted">
          {t("processingBefore")}{" "}
          <Link
            className={`rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline ${focusRing}`}
            href="/privacy"
          >
            {t("policyLink")}
          </Link>{" "}
          {t("processingAfter")}
        </p>

        <ul className="mt-6 border-edge border-y">
          <li className="flex flex-wrap items-center justify-between gap-4 border-edge border-b py-4">
            <div className="min-w-0">
              <h3 className="type-body-sm font-semibold text-ink">
                {t("requestTitle")}
              </h3>
              <p className="type-body-sm text-ink-muted">{t("requestBody")}</p>
            </div>
            <button
              className={`${statusPanelSecondaryAction} disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={requestingData}
              onClick={handleDataRequest}
              type="button"
            >
              {requestingData ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="size-4" />
              )}
              {t("exportData")}
            </button>
          </li>

          <li className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <h3 className="type-body-sm flex items-center gap-1 font-semibold text-danger">
                <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
                {t("deleteTitle")}
              </h3>
              <p className="type-body-sm text-ink-muted">{t("deleteBody")}</p>
            </div>
            <button
              className={dangerOutline}
              onClick={() => setDeleteDialogOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {t("deleteAccount")}
            </button>
          </li>
        </ul>

        <p className="type-body-sm mt-4 text-ink-muted">{t("gdprNote")}</p>
      </section>

      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent className="rounded-biso-lg border border-edge bg-surface text-ink shadow-elev-2 sm:rounded-biso-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="type-heading-card font-bold text-ink">
              {t("confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="type-body-sm text-ink-muted">
              {t("confirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-edge border-t pt-4">
            <AlertDialogCancel
              className={`${statusPanelSecondaryAction} ${dialogButtonFix}`}
              disabled={deletingData}
            >
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className={`${dangerFilled} ${dialogButtonFix}`}
              disabled={deletingData}
              onClick={(e) => {
                e.preventDefault();
                handleDataDeletion();
              }}
            >
              {deletingData ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {t("deleteAccount")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
