import type { EditorLocale } from "@/editor/types";

/** The input look shared by the signup and form blocks. */
export const FIELD_CLASS =
  "type-body w-full min-w-0 rounded-biso-md border border-edge bg-surface-raised px-4 py-3 text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export type AnswerValue = string | string[] | boolean;

const COPY = {
  en: {
    choose: "Choose…",
    back: "Back",
    emailLabel: "Email address",
    emailInvalid: "Enter a valid email address.",
    failed: "Something went wrong. Please try again.",
    formDone: "Your message has been sent. We'll be in touch soon.",
    next: "Next",
    required: "This field is required.",
    sending: "Sending…",
    signupButton: "Sign up",
    signupDone: "Thanks, we'll be in touch.",
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    submit: "Submit",
  },
  no: {
    choose: "Velg…",
    back: "Tilbake",
    emailLabel: "E-postadresse",
    emailInvalid: "Skriv inn en gyldig e-postadresse.",
    failed: "Noe gikk galt. Prøv igjen.",
    formDone: "Meldingen din er sendt. Vi tar kontakt snart.",
    next: "Neste",
    required: "Dette feltet må fylles ut.",
    sending: "Sender…",
    signupButton: "Meld meg på",
    signupDone: "Takk, vi tar kontakt.",
    step: (n: number, total: number) => `Steg ${n} av ${total}`,
    submit: "Send",
  },
} as const;

/** Fixed strings for the visitor's language; anything unknown is Norwegian. */
export function formCopy(locale: EditorLocale | undefined) {
  return locale === "en" ? COPY.en : COPY.no;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}

/**
 * Posts answers for one block. Only the block id, the page's storage slug and
 * the locale say WHICH form this is; the server reads the recipient, mode,
 * topic and access team from the published page itself.
 */
export async function postSubmission(request: {
  blockId: string;
  data: Record<string, AnswerValue>;
  locale: EditorLocale | undefined;
  slug: string | undefined;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/form/submit", {
      body: JSON.stringify({
        blockId: request.blockId,
        data: request.data,
        locale: request.locale === "en" ? "en" : "no",
        slug: request.slug ?? "",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await res.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    return res.ok && body?.success === true;
  } catch {
    return false;
  }
}
