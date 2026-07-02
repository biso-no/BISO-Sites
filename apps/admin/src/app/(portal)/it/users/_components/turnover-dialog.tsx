"use client";

import { RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { triggerM365Turnover } from "../../../_actions/it-turnover";
import { PortalField, PortalInput } from "../../../_components/portal-fields";
import { buttonStyle, STUDIO } from "../../../_components/studio";

interface TurnoverDialogProps {
  userId: string;
  userPrincipalName: string;
}

export function TurnoverDialog({
  userId,
  userPrincipalName,
}: TurnoverDialogProps) {
  const t = useTranslations("adminPortal.it.users.turnover");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmUpn, setConfirmUpn] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    confirmUpn.trim().toLowerCase() === userPrincipalName.toLowerCase();

  function reset() {
    setFirstName("");
    setLastName("");
    setConfirmUpn("");
  }

  function handleClose() {
    if (isPending) {
      return;
    }
    setOpen(false);
    reset();
  }

  function handleSubmit() {
    if (!canSubmit) {
      toast.error(t("confirmMismatch"));
      return;
    }
    startTransition(async () => {
      const result = await triggerM365Turnover({
        userId,
        newFirstName: firstName,
        newLastName: lastName,
        confirmationUpn: confirmUpn,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const data = result.data;
      if (data?.retentionStarted) {
        const stopDate = new Date(data.retentionStopAt).toLocaleDateString();
        toast.success(t("success", { name: data.newDisplayName }), {
          description: t("retentionStops", { date: stopDate }),
        });
      } else {
        toast.warning(t("successNoRetention"));
      }
      for (const warning of data?.warnings ?? []) {
        toast.warning(warning);
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const effects = [
    t("effectRename"),
    t("effectMfa"),
    t("effectSessions"),
    t("effectPassword"),
    t("effectRetention"),
  ];

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-medium text-sm"
        onClick={() => setOpen(true)}
        style={buttonStyle("danger")}
        type="button"
      >
        <RefreshCw size={14} />
        {t("button")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.70)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{
              background: STUDIO.paper,
              border: `0.5px solid ${STUDIO.rule2}`,
            }}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="font-medium text-sm" style={{ color: STUDIO.ink }}>
                {t("title")}
              </h3>
              <button
                aria-label={t("cancel")}
                className="shrink-0 rounded-lg p-1"
                onClick={handleClose}
                style={{ background: STUDIO.paper2, color: STUDIO.ink3 }}
                type="button"
              >
                <X size={14} />
              </button>
            </div>

            <p className="mb-3 text-sm" style={{ color: STUDIO.ink3 }}>
              {t("intro")}
            </p>

            <p
              className="mb-1 font-medium text-xs"
              style={{ color: STUDIO.ink }}
            >
              {t("effectsHeading")}
            </p>
            <ul
              className="mb-5 list-disc space-y-1 pl-5 text-xs"
              style={{ color: STUDIO.ink3 }}
            >
              {effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <PortalField label={t("firstNameLabel")}>
                  <PortalInput
                    onChange={(event) => setFirstName(event.target.value)}
                    value={firstName}
                  />
                </PortalField>
                <PortalField label={t("lastNameLabel")}>
                  <PortalInput
                    onChange={(event) => setLastName(event.target.value)}
                    value={lastName}
                  />
                </PortalField>
              </div>
              <PortalField label={t("confirmUpnLabel")}>
                <PortalInput
                  onChange={(event) => setConfirmUpn(event.target.value)}
                  placeholder={t("confirmUpnPlaceholder")}
                  value={confirmUpn}
                />
              </PortalField>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-xl px-4 py-2 text-sm disabled:opacity-50"
                disabled={isPending}
                onClick={handleClose}
                style={buttonStyle("secondary")}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-xl px-4 py-2 font-medium text-sm disabled:opacity-50"
                disabled={isPending || !canSubmit}
                onClick={handleSubmit}
                style={buttonStyle("danger")}
                type="button"
              >
                {t("submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
