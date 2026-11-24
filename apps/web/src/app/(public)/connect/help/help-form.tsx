"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState, useTransition } from "react";
import { requestConnectLink } from "@/app/actions/big-event-connect";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

type Outcome = "failed" | "sent" | null;

/**
 * One email field. The answer is the same whether or not the address is on
 * any list, so the page never tells anyone who bought a ticket.
 */
export function HelpForm() {
  const t = useTranslations("bigEvents.help");
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isSending, start] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOutcome(null);
    start(async () => {
      try {
        await requestConnectLink(email);
        setOutcome("sent");
      } catch {
        setOutcome("failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="flex flex-col gap-2">
          <label
            className="type-body-sm flex items-center gap-2 font-semibold text-ink"
            htmlFor={emailId}
          >
            <Mail aria-hidden="true" className="size-4 text-ink-accent" />
            {t("emailLabel")}
          </label>
          <input
            autoComplete="email"
            className="type-body w-full rounded-biso-md border border-edge bg-surface px-4 py-3 text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2"
            id={emailId}
            maxLength={320}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div>
          <button
            aria-busy={isSending}
            className={`${statusPanelPrimaryAction} disabled:opacity-60`}
            disabled={isSending}
            type="submit"
          >
            {isSending ? t("sending") : t("submit")}
          </button>
        </div>
      </form>

      {outcome ? (
        <p
          className={`type-body-sm rounded-biso-md border p-4 ${
            outcome === "failed"
              ? "border-danger/40 bg-danger/5 text-danger"
              : "border-success/40 bg-success/5 text-success"
          }`}
          role={outcome === "failed" ? "alert" : "status"}
        >
          {outcome === "failed" ? t("failed") : t("sent")}
        </p>
      ) : null}
    </div>
  );
}
