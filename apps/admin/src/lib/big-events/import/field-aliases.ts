export const IMPORT_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "campus",
  "ticket_ref",
  "ticket_category",
  "group",
  "ignore",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Known header names per field (Tickster's purchasers export, plus common variants). */
export const FIELD_ALIASES: Record<
  Exclude<ImportField, "ignore">,
  readonly string[]
> = {
  first_name: ["Navn", "First name", "Fornavn", "Given name"],
  last_name: ["Etternavn", "Last name", "Surname", "Family name"],
  full_name: ["Name", "Fullt navn", "Full name"],
  email: ["E-post", "Email", "Epost", "E-mail", "Mail"],
  phone: ["Mobilnr", "Phone", "Mobil", "Telefon", "Mobile", "Tlf"],
  campus: ["Campus"],
  ticket_ref: ["Ref.nr.", "Order", "Ordrenr", "Reference", "Ordrenummer"],
  ticket_category: [
    "Billettkategori",
    "Ticket type",
    "Billettype",
    "Ticket category",
  ],
  group: ["Group", "Gruppe", "Faddergruppe", "Room", "Rom", "Bus", "Buss"],
};

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]/g;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(NON_ALPHANUMERIC, "");
}

const ALIAS_LOOKUP: ReadonlyMap<string, ImportField> = new Map(
  (
    Object.entries(FIELD_ALIASES) as [
      Exclude<ImportField, "ignore">,
      readonly string[],
    ][]
  ).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalize(alias), field] as const)
  )
);

/** Case-, accent- and punctuation-insensitive match of one header cell. */
export function matchHeader(header: string): ImportField | null {
  const key = normalize(header);
  if (!key) {
    return null;
  }
  return ALIAS_LOOKUP.get(key) ?? null;
}

/**
 * Matches a whole header row. Tickster's ambiguous "Navn" is the first name
 * when an "Etternavn" column follows; without one (and without a separate
 * full-name column) it is the full name. Unambiguous headers are left alone.
 */
export function matchHeaders(headers: string[]): (ImportField | null)[] {
  const matches = headers.map(matchHeader);
  if (matches.includes("last_name") || matches.includes("full_name")) {
    return matches;
  }
  return matches.map((field, index) =>
    field === "first_name" && normalize(headers[index] ?? "") === "navn"
      ? "full_name"
      : field
  );
}
