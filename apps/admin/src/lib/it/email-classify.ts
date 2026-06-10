// Pure helpers for deciding which campus batch a user belongs to. This only
// chooses a batch + candidate list for the AI resolver; it never decides the
// user's department (the model does that).

export function emailLocalPart(email: string | null): string {
  if (!email) {
    return "";
  }
  const at = email.indexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  return local.toLowerCase().trim();
}

// Returns a campus *name* (e.g. "Oslo") or null. Email's trailing segment wins;
// officeLocation is a fallback; otherwise null (national / unplaceable).
export function extractCampusHint(
  email: string | null,
  officeLocation: string | null,
  tokenToCampus: Map<string, string>
): string | null {
  const local = emailLocalPart(email);
  if (local) {
    const segments = local.split(".");
    const last = segments.at(-1) ?? "";
    const fromEmail = tokenToCampus.get(last);
    if (fromEmail) {
      return fromEmail;
    }
  }
  const office = (officeLocation ?? "").trim().toLowerCase();
  if (office) {
    const fromOffice = tokenToCampus.get(office);
    if (fromOffice) {
      return fromOffice;
    }
  }
  return null;
}
