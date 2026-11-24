/**
 * The "connect your ticket" email and its reminder: Norwegian first, English
 * below, since the ticket holder has no account to read a language from.
 * One person gets a button; an address shared by several people lists each
 * person with their own link. The copy is fixed. Pure: no env reads, no I/O.
 */

import { renderEmail } from "./email-layout";

export interface ConnectEmailPerson {
  firstName: string;
  lastName: string | null;
  /** The person's own connect link. */
  url: string;
}

export interface ConnectEmailInput {
  eventNameEn: string | null;
  eventNameNo: string;
  helpUrl: string;
  people: ConnectEmailPerson[];
  reminder: boolean;
}

export interface ConnectEmail {
  html: string;
  subject: string;
  text: string;
}

interface Copy {
  body: (eventName: string) => string;
  button: string;
  footer: (helpUrl: string) => string;
  personLink: string;
  sendEachLink: string;
}

const NORWEGIAN: Copy = {
  body: (eventName) =>
    `Du er med på ${eventName}! Koble billetten til BISO-kontoen din, så får du bussen, rommet ditt og alle oppdateringer på ett sted. Logg inn med BI-kontoen din.`,
  button: "Koble billetten min",
  footer: (helpUrl) =>
    `Fikk du ikke e-posten, eller gjelder den ikke deg? ${helpUrl}`,
  personLink: "Koble til",
  sendEachLink: "Send hver lenke til personen den gjelder.",
};

const ENGLISH: Copy = {
  body: (eventName) =>
    `You're going to ${eventName}! Connect your ticket to your BISO account to get your bus, your room and every update in one place. Sign in with your BI account.`,
  button: "Connect my ticket",
  footer: (helpUrl) => `Wrong person, or lost the email? ${helpUrl}`,
  personLink: "Connect",
  sendEachLink: "Send each link to the person it belongs to.",
};

const REMINDER_PREFIX = "Påminnelse: ";

function fullName(person: ConnectEmailPerson): string {
  return [person.firstName, person.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function section(
  copy: Copy,
  lang: "no" | "en",
  eventName: string,
  people: ConnectEmailPerson[]
) {
  const body = copy.body(eventName);
  const [only] = people;
  if (people.length === 1 && only) {
    return {
      button: { label: copy.button, url: only.url },
      heading: eventName,
      lang,
      paragraphs: [body],
    };
  }
  return {
    heading: eventName,
    lang,
    links: people.map((person) => ({
      label: copy.personLink,
      text: fullName(person),
      url: person.url,
    })),
    paragraphs: [body, copy.sendEachLink],
  };
}

export function buildConnectEmail(input: ConnectEmailInput): ConnectEmail {
  if (input.people.length === 0) {
    throw new Error("A connect email needs at least one person.");
  }
  const nameNo = input.eventNameNo.trim();
  const nameEn = input.eventNameEn?.trim() || nameNo;

  const { html, text } = renderEmail({
    footer: [
      NORWEGIAN.footer(input.helpUrl),
      ENGLISH.footer(input.helpUrl),
    ].join("\n"),
    preheader: `Du er med på ${nameNo}! · You're going to ${nameEn}!`,
    sections: [
      section(NORWEGIAN, "no", nameNo, input.people),
      section(ENGLISH, "en", nameEn, input.people),
    ],
  });

  const subject = `Koble billetten din til BISO · Connect your ticket – ${nameNo}`;
  return {
    html,
    subject: input.reminder ? `${REMINDER_PREFIX}${subject}` : subject,
    text,
  };
}
