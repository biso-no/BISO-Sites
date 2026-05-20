"use client";

import { useState } from "react";
import type { PatchFn } from "@/blocks/types";
import type { SignupBlock } from "@/editor/types";

interface Props {
  block: SignupBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function SignupRender({ block, edit, onPatch }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || edit) {
      return;
    }
    setState("pending");
    try {
      const res = await fetch("/api/form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: block.submitMode ?? "database",
          topic: block.topic ?? "signup",
          formHeading: block.heading,
          data: { email },
          recipientEmail: block.recipientEmail,
          source: "signup",
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="pg-signup pg-block">
        <h2>{block.heading}</h2>
        <p style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 8 }}>
          Thanks — we'll be in touch!
        </p>
      </div>
    );
  }

  return (
    <div className="pg-signup pg-block">
      {edit ? (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
        <h2
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
          suppressContentEditableWarning
        >
          {block.heading}
        </h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <form className="pg-signup__form" onSubmit={handleSubmit}>
        <input
          aria-label="Email address"
          disabled={state === "pending"}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={block.placeholder || "you@bi.no"}
          readOnly={edit}
          type="email"
          value={edit ? "" : email}
        />
        <button disabled={state === "pending" || edit} type="submit">
          {state === "pending" ? "…" : "Subscribe"}
        </button>
      </form>
      {state === "error" && (
        <p style={{ fontSize: 12, color: "var(--claret)", marginTop: 6 }}>
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
