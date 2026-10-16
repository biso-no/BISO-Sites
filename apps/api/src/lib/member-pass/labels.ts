import en from "@repo/i18n/messages/en/memberPass.json";
import no from "@repo/i18n/messages/no/memberPass.json";

/**
 * Wallet copy for the app's pass endpoints. `apps/api` has no `next-intl`
 * request context (no `getTranslations`), so this reads the same
 * `memberPass` message bundles the website renders from, directly by locale,
 * and formats just the handful of message shapes the wallet builders use:
 * plain values, `{placeholder}` interpolation, and the `{var, select, ...}`
 * form `term.semester` needs. Not a general ICU MessageFormat implementation.
 */

type MemberPassMessages = typeof en;
type MessageValues = Record<string, string | number>;
export type MemberPassTranslate = (
  key: string,
  values?: MessageValues
) => string;

const NORWEGIAN_TAGS = new Set(["no", "nb", "nn"]);
const MESSAGES: Record<"en" | "no", MemberPassMessages> = { en, no };

/** `no` / `nb` / `nn` (any region) → Norwegian; everything else → English. */
export function memberPassLocale(
  acceptLanguage: string | null | undefined
): "en" | "no" {
  const primaryTag = acceptLanguage
    ?.split(",")[0]
    ?.trim()
    .split(";")[0]
    ?.split("-")[0]
    ?.toLowerCase();
  return primaryTag && NORWEGIAN_TAGS.has(primaryTag) ? "no" : "en";
}

function readMessage(dict: MemberPassMessages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" && segment in node
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      dict
    );
  if (typeof value !== "string") {
    throw new Error(`[Member Pass] Missing wallet message: ${key}`);
  }
  return value;
}

const SELECT_RE = /\{(\w+),\s*select,\s*((?:\w+\s*\{[^}]*\}\s*)+)\}/;
const SELECT_OPTION_RE = /(\w+)\s*\{([^}]*)\}/g;
const PLACEHOLDER_RE = /\{(\w+)\}/g;

function resolveSelect(template: string, values: MessageValues): string {
  return template.replace(
    SELECT_RE,
    (_match, name: string, optionsSrc: string) => {
      const options: Record<string, string> = {};
      for (const [, option, text] of optionsSrc.matchAll(SELECT_OPTION_RE)) {
        options[option] = text;
      }
      const selected = String(values[name] ?? "");
      return options[selected] ?? options.other ?? "";
    }
  );
}

function interpolate(template: string, values: MessageValues): string {
  return template.replace(PLACEHOLDER_RE, (_match, name: string) =>
    name in values ? String(values[name]) : ""
  );
}

function translate(
  dict: MemberPassMessages,
  key: string,
  values: MessageValues = {}
): string {
  const template = readMessage(dict, key);
  const selected = template.includes(", select,")
    ? resolveSelect(template, values)
    : template;
  return interpolate(selected, values).trim();
}

/** A `t(key, values?)` translator over the `memberPass` bundle for `locale`. */
export function memberPassTranslator(
  acceptLanguage: string | null | undefined
): MemberPassTranslate {
  const dict = MESSAGES[memberPassLocale(acceptLanguage)];
  return (key, values) => translate(dict, key, values);
}
