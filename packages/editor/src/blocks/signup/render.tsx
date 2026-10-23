"use client";

import { type FormEvent, useState } from "react";
import { buttonClass } from "@/blocks/_v2/button-link";
import {
  FIELD_CLASS,
  formCopy,
  looksLikeEmail,
  postSubmission,
} from "@/blocks/_v2/submit-form";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { SignupBlock } from "@/editor/types";

interface Props {
  block: SignupBlock;
  edit: boolean;
  onPatch: PatchFn;
}

type State = "idle" | "invalid" | "pending" | "done" | "error";

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function SignupRender({ block, edit, onPatch }: Props) {
  const { locale, slug } = usePageFeedSource();
  const copy = formCopy(locale);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const heading = text(block.heading);
  const baseId = text(block.id) || "signup";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (edit || state === "pending") {
      return;
    }
    if (!looksLikeEmail(email)) {
      setState("invalid");
      return;
    }
    setState("pending");
    const ok = await postSubmission({
      blockId: text(block.id),
      data: { email: email.trim() },
      locale,
      slug,
    });
    setState(ok ? "done" : "error");
  }

  const heading_ =
    edit || heading.trim() ? (
      <EditableText
        className="type-heading-section m-0 min-w-0 hyphens-auto break-words text-ink"
        edit={edit}
        onChange={(v) => onPatch("heading", v)}
        tag="h2"
        value={heading}
      />
    ) : null;

  if (state === "done") {
    return (
      <div className="flex flex-col gap-4 break-words">
        {heading_}
        <p className="type-body m-0 text-ink" role="status">
          {copy.signupDone}
        </p>
      </div>
    );
  }

  const message =
    state === "invalid" ? copy.emailInvalid : state === "error" && copy.failed;

  return (
    <div className="flex flex-col gap-4 break-words">
      {heading_}
      <form
        className="flex max-w-xl @sm:flex-row flex-col gap-3"
        noValidate
        onSubmit={handleSubmit}
      >
        <input
          aria-describedby={message ? `${baseId}-msg` : undefined}
          aria-invalid={state === "invalid" || undefined}
          aria-label={copy.emailLabel}
          autoComplete="email"
          className={`${FIELD_CLASS} @sm:flex-1`}
          disabled={state === "pending"}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={text(block.placeholder) || "you@bi.no"}
          readOnly={edit}
          type="email"
          value={edit ? "" : email}
        />
        <button
          className={`${buttonClass("primary")} justify-center disabled:opacity-60`}
          disabled={state === "pending"}
          type="submit"
        >
          {state === "pending" ? copy.sending : copy.signupButton}
        </button>
      </form>
      {message ? (
        <p
          className="type-body-sm m-0 text-danger"
          id={`${baseId}-msg`}
          role="alert"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
