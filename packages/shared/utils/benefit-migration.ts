import { createHash } from "node:crypto";
import {
  BENEFIT_CATEGORY_LABELS,
  BENEFIT_SECTION_LABELS,
  BENEFIT_SECTIONS,
  type BenefitCategoryKey,
  type BenefitSection,
  CAMPUS_IDS,
  isBenefitCategory,
  isBenefitSection,
  mapLegacyBenefitCategory,
  NATIONAL_CAMPUS_ID,
} from "./benefit-catalog";
import {
  type BenefitMatch,
  compareBenefitTexts,
  isMergeMatch,
  isPossibleMatch,
  normalizeBenefitText,
  partnerKey,
  suggestPartnerName,
} from "./benefit-match";

export interface CampusDataInput {
  $id: string;
  [column: string]: unknown;
}

export interface ExistingBenefitInput {
  $createdAt: string;
  $id: string;
  $permissions: string[];
  campus_id: string;
  category?: string | null;
  description_nb?: string | null;
  kind?: string | null;
  partner_id?: string | null;
  partner_logo_url?: string | null;
  partner_name?: string | null;
  redemption_value?: string | null;
  section?: string | null;
  status: string;
  title_en?: string | null;
  title_nb: string;
}

export interface MigrationInput {
  benefits: ExistingBenefitInput[];
  campusData: CampusDataInput[];
  generatedAt: string;
}

export interface PlannedLine {
  action: "create" | "merge" | "skip";
  /** "1".."4", or "5" when collapsed into a national line */
  campusId: string;
  /** Row id used when action = create */
  id: string;
  /** Existing row ids when action = merge */
  mergeInto: string[];
  note: string | null;
  /** Member lines only */
  partnerKey: string | null;
  /** Best dice against same-section candidates */
  score: number | null;
  section: BenefitSection;
  sortOrder: number;
  sourceCampusIds: string[];
  titleEn: string;
  titleNb: string;
}

export interface PlannedRowUpdate {
  campusId: string;
  category: BenefitCategoryKey | null;
  makePublic: boolean;
  partnerKey: string | null;
  rowId: string;
  section: BenefitSection;
  sortOrder: number | null;
  title: string;
}

export interface PlannedPartner {
  campusId: string;
  id: string;
  key: string;
  logoUrl: string | null;
  name: string;
  suggested: boolean;
}

export interface PlannedCode {
  rowId: string;
  value: string;
}

export interface PlannedDeletion {
  approved: boolean;
  rowId: string;
  title: string;
}

export interface MigrationPlan {
  codes: PlannedCode[];
  deletions: PlannedDeletion[];
  generatedAt: string;
  lines: PlannedLine[];
  partners: PlannedPartner[];
  rowUpdates: PlannedRowUpdate[];
  version: 1;
}

export interface MigrationSummary {
  codes: number;
  created: number;
  deletions: number;
  merged: number;
  partners: number;
  skipped: number;
  sourceLines: number;
  updated: number;
}

const LIST_SECTIONS: readonly (readonly [string, BenefitSection])[] = [
  ["studentBenefits", "member"],
  ["careerAdvantages", "career"],
  ["socialNetwork", "social"],
  ["safety", "safety"],
  ["businessBenefits", "business"],
];
const LINE_ACTIONS: readonly string[] = ["create", "merge", "skip"];
const CAMPUS_NAMES: Record<string, string> = {
  "1": "Oslo",
  "2": "Bergen",
  "3": "Trondheim",
  "4": "Stavanger",
  [NATIONAL_CAMPUS_ID]: "Hele BISO",
};
const REVIEW_CAMPUS_ORDER = [...CAMPUS_IDS, NATIONAL_CAMPUS_ID];
const OSLO_CAMPUS_ID = "1";
const PUBLIC_READ = 'read("any")';
const ID_HEX_LENGTH = 20;
const MISSING_ENGLISH = "Mangler engelsk tekst";
const DUPLICATE = "Duplikat";
const NOTE_SEPARATOR = "; ";
const EMPTY_CELL = "–";

const CAREER_PERK = /karriere|bedriftspresentasjon|kurs\b|intervju|\bcv\b/i;
const SOCIAL_PERK = /verv|undergrupp/i;
const HAS_UPPER = /\p{Lu}/u;
const HAS_LOWER = /\p{Ll}/u;
const TABLE_PIPE = /\|/g;
const LINE_BREAKS = /\s*[\r\n]+\s*/g;

// ── Planning ──────────────────────────────────────────────────────────────

interface PartnerVariant {
  campusId: string;
  explicit: boolean;
  key: string;
  logoUrl: string | null;
  name: string;
}

interface SourceLine {
  campusId: string;
  notes: string[];
  section: BenefitSection;
  sortOrder: number;
  titleEn: string;
  titleNb: string;
}

interface DraftLine extends SourceLine {
  duplicate: boolean;
  sourceCampusIds: string[];
}

interface ScoredRow {
  match: BenefitMatch;
  row: PlannedRowUpdate;
}

function hashPrefix(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, ID_HEX_LENGTH);
}

function lineId(campusId: string, section: string, titleNb: string): string {
  return `mb-${hashPrefix(`${campusId}|${section}|${normalizeBenefitText(titleNb)}`)}`;
}

function partnerId(key: string): string {
  return `bp-${hashPrefix(key)}`;
}

function campusName(campusId: string): string {
  return CAMPUS_NAMES[campusId] ?? campusId;
}

function rowTitle(row: ExistingBenefitInput): string {
  return row.title_nb?.trim() || row.title_en?.trim() || "";
}

function proposeSection(row: ExistingBenefitInput): BenefitSection {
  if (isBenefitSection(row.section)) {
    return row.section;
  }
  if (row.kind === "perk") {
    const title = rowTitle(row);
    if (CAREER_PERK.test(title)) {
      return "career";
    }
    if (SOCIAL_PERK.test(title)) {
      return "social";
    }
  }
  return "member";
}

function rowPartnerVariant(
  row: ExistingBenefitInput,
  section: BenefitSection
): PartnerVariant | null {
  if (section !== "member" || row.partner_id) {
    return null;
  }
  const explicit = row.partner_name?.trim();
  const name = explicit || suggestPartnerName(row.title_nb ?? "");
  if (!name) {
    return null;
  }
  return {
    campusId: row.campus_id,
    explicit: Boolean(explicit),
    key: partnerKey(name),
    logoUrl: row.partner_logo_url?.trim() || null,
    name,
  };
}

function proposeCategory(value: string | null | undefined): BenefitCategoryKey {
  return isBenefitCategory(value) ? value : mapLegacyBenefitCategory(value);
}

function isPublicOnly(permissions: string[]): boolean {
  return permissions.length === 1 && permissions[0] === PUBLIC_READ;
}

function proposeRowUpdates(benefits: ExistingBenefitInput[]): {
  updates: PlannedRowUpdate[];
  variants: PartnerVariant[];
} {
  const updates: PlannedRowUpdate[] = [];
  const variants: PartnerVariant[] = [];
  for (const row of benefits) {
    const section = proposeSection(row);
    const variant = rowPartnerVariant(row, section);
    if (variant) {
      variants.push(variant);
    }
    updates.push({
      campusId: row.campus_id,
      category: section === "member" ? proposeCategory(row.category) : null,
      makePublic: row.status === "published" && !isPublicOnly(row.$permissions),
      partnerKey: variant?.key ?? null,
      rowId: row.$id,
      section,
      sortOrder: null,
      title: rowTitle(row),
    });
  }
  return { updates, variants };
}

function collectCodes(benefits: ExistingBenefitInput[]): PlannedCode[] {
  return benefits.flatMap((row) =>
    row.redemption_value?.trim()
      ? [{ rowId: row.$id, value: row.redemption_value }]
      : []
  );
}

function collectDeletions(benefits: ExistingBenefitInput[]): PlannedDeletion[] {
  return benefits
    .filter((row) => row.status === "draft" && !row.description_nb?.trim())
    .map((row) => ({ approved: false, rowId: row.$id, title: rowTitle(row) }));
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function listSourceLines(
  campusId: string,
  section: BenefitSection,
  norwegian: unknown[],
  english: unknown[]
): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const [index, value] of norwegian.entries()) {
    const titleNb = cleanText(value);
    if (!titleNb) {
      continue;
    }
    const titleEn = cleanText(english[index]);
    lines.push({
      campusId,
      notes: titleEn ? [] : [MISSING_ENGLISH],
      section,
      sortOrder: index,
      titleEn: titleEn || titleNb,
      titleNb,
    });
  }
  return lines;
}

function collectSourceLines(campusData: CampusDataInput[]): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const campusId of CAMPUS_IDS) {
    const row = campusData.find((candidate) => candidate.$id === campusId);
    if (!row) {
      continue;
    }
    for (const [key, section] of LIST_SECTIONS) {
      lines.push(
        ...listSourceLines(
          campusId,
          section,
          asList(row[`${key}_nb`]),
          asList(row[`${key}_en`])
        )
      );
    }
  }
  return lines;
}

function groupKey(line: SourceLine): string {
  return `${line.section}|${normalizeBenefitText(line.titleNb)}`;
}

function nationalLine(occurrences: SourceLine[], oslo: SourceLine): DraftLine {
  return {
    ...oslo,
    campusId: NATIONAL_CAMPUS_ID,
    duplicate: false,
    sortOrder: Math.min(...occurrences.map((line) => line.sortOrder)),
    sourceCampusIds: occurrences.map((line) => line.campusId),
  };
}

/** Rule 4: one national line per text on all four campuses; repeats skip. */
function collapseLines(sources: SourceLine[]): DraftLine[] {
  const firstPerCampus = new Map<string, Map<string, SourceLine>>();
  for (const line of sources) {
    const group =
      firstPerCampus.get(groupKey(line)) ?? new Map<string, SourceLine>();
    if (!group.has(line.campusId)) {
      group.set(line.campusId, line);
    }
    firstPerCampus.set(groupKey(line), group);
  }
  const drafts: DraftLine[] = [];
  for (const line of sources) {
    const group =
      firstPerCampus.get(groupKey(line)) ?? new Map<string, SourceLine>();
    const single = { ...line, sourceCampusIds: [line.campusId] };
    if (group.get(line.campusId) !== line) {
      drafts.push({ ...single, duplicate: true });
    } else if (group.size < CAMPUS_IDS.length) {
      drafts.push({ ...single, duplicate: false });
    } else if (line.campusId === OSLO_CAMPUS_ID) {
      drafts.push(nationalLine([...group.values()], line));
    }
  }
  return drafts;
}

function sectionLabel(section: string): string {
  return isBenefitSection(section)
    ? BENEFIT_SECTION_LABELS[section].nb
    : section;
}

function similarityNote(row: PlannedRowUpdate): string {
  return `Ligner på «${row.title}» (${campusName(row.campusId)}, ${sectionLabel(row.section)})`;
}

function otherCampusNote(
  line: DraftLine,
  rows: PlannedRowUpdate[]
): string | null {
  const campuses = CAMPUS_IDS.filter(
    (campusId) =>
      campusId !== line.campusId &&
      rows.some(
        (row) =>
          row.campusId === campusId &&
          row.section === line.section &&
          isMergeMatch(compareBenefitTexts(line.titleNb, row.title))
      )
  );
  if (campuses.length === 0) {
    return null;
  }
  return `Samme tilbud finnes på ${campuses.map(campusName).join(", ")} – vurder å gjøre det nasjonalt`;
}

function createPartnerKey(line: DraftLine): string | null {
  if (line.section !== "member") {
    return null;
  }
  const name = suggestPartnerName(line.titleNb);
  return name ? partnerKey(name) : null;
}

function baseLine(line: DraftLine): Omit<PlannedLine, "action" | "note"> {
  return {
    campusId: line.campusId,
    id: lineId(line.campusId, line.section, line.titleNb),
    mergeInto: [],
    partnerKey: null,
    score: null,
    section: line.section,
    sortOrder: line.sortOrder,
    sourceCampusIds: line.sourceCampusIds,
    titleEn: line.titleEn,
    titleNb: line.titleNb,
  };
}

/** Rule 5: merge into same-section candidates, or create with notes. */
function matchLine(line: DraftLine, rows: PlannedRowUpdate[]): PlannedLine {
  const scored: ScoredRow[] = rows
    .filter(
      (row) =>
        row.campusId === line.campusId || row.campusId === NATIONAL_CAMPUS_ID
    )
    .map((row) => ({
      match: compareBenefitTexts(line.titleNb, row.title),
      row,
    }));
  const sameSection = scored.filter(({ row }) => row.section === line.section);
  const targets = sameSection
    .filter(({ match }) => isMergeMatch(match))
    .map(({ row }) => row);
  const similar = scored
    .filter(
      ({ match, row }) =>
        !targets.includes(row) &&
        (isMergeMatch(match) || isPossibleMatch(match))
    )
    .map(({ row }) => similarityNote(row));
  const notes = [...line.notes, ...similar, otherCampusNote(line, rows)];
  const note = notes.filter(Boolean).join(NOTE_SEPARATOR) || null;
  const score =
    sameSection.length > 0
      ? Math.max(...sameSection.map(({ match }) => match.dice))
      : null;
  if (targets.length > 0) {
    return {
      ...baseLine(line),
      action: "merge",
      mergeInto: targets.map((row) => row.rowId),
      note,
      score,
    };
  }
  return {
    ...baseLine(line),
    action: "create",
    note,
    partnerKey: createPartnerKey(line),
    score,
  };
}

function matchLines(
  drafts: DraftLine[],
  rows: PlannedRowUpdate[]
): PlannedLine[] {
  return drafts.map(
    (line): PlannedLine =>
      line.duplicate
        ? { ...baseLine(line), action: "skip", note: DUPLICATE }
        : matchLine(line, rows)
  );
}

/** A merge target on the line's own campus takes the line's order; first wins. */
function applyMergeOrder(lines: PlannedLine[], rows: PlannedRowUpdate[]) {
  const byId = new Map(rows.map((row) => [row.rowId, row]));
  for (const line of lines) {
    if (line.action !== "merge") {
      continue;
    }
    for (const rowId of line.mergeInto) {
      const row = byId.get(rowId);
      if (row && row.campusId === line.campusId && row.sortOrder === null) {
        row.sortOrder = line.sortOrder;
      }
    }
  }
}

function lineVariants(lines: PlannedLine[]): PartnerVariant[] {
  return lines.flatMap((line) => {
    if (line.action !== "create" || !line.partnerKey) {
      return [];
    }
    const name = suggestPartnerName(line.titleNb);
    if (!name) {
      return [];
    }
    return [
      {
        campusId: line.campusId,
        explicit: false,
        key: line.partnerKey,
        logoUrl: null,
        name,
      },
    ];
  });
}

function isAllCaps(name: string): boolean {
  return HAS_UPPER.test(name) && !HAS_LOWER.test(name);
}

/** Rule 7: one partner per key, named after its first non-shouting variant. */
function collectPartners(variants: PartnerVariant[]): PlannedPartner[] {
  const byKey = new Map<string, PartnerVariant[]>();
  for (const variant of variants) {
    const group = byKey.get(variant.key) ?? [];
    group.push(variant);
    byKey.set(variant.key, group);
  }
  return [...byKey].map(([key, group]) => {
    const [first] = group;
    const campuses = new Set(group.map((variant) => variant.campusId));
    return {
      campusId: campuses.size === 1 ? first.campusId : NATIONAL_CAMPUS_ID,
      id: partnerId(key),
      key,
      logoUrl: group.find((variant) => variant.logoUrl)?.logoUrl ?? null,
      name:
        group.find((variant) => !isAllCaps(variant.name))?.name ?? first.name,
      suggested: !group.some((variant) => variant.explicit),
    };
  });
}

export function planBenefitMigration(input: MigrationInput): MigrationPlan {
  const { updates, variants } = proposeRowUpdates(input.benefits);
  const drafts = collapseLines(collectSourceLines(input.campusData));
  const lines = matchLines(drafts, updates);
  applyMergeOrder(lines, updates);
  return {
    codes: collectCodes(input.benefits),
    deletions: collectDeletions(input.benefits),
    generatedAt: input.generatedAt,
    lines,
    partners: collectPartners([...variants, ...lineVariants(lines)]),
    rowUpdates: updates,
    version: 1,
  };
}

// ── Validation ────────────────────────────────────────────────────────────

interface PlanLookups {
  partnerKeys: Set<string>;
  rowIds: Set<string>;
}

function duplicateCreateProblems(lines: PlannedLine[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.action === "create") {
      counts.set(line.id, (counts.get(line.id) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `Linje-ID ${id} brukes av ${count} nye linjer`);
}

function lineProblems(line: PlannedLine, lookups: PlanLookups): string[] {
  const label = `Linje ${line.id} («${line.titleNb}»)`;
  const problems: string[] = [];
  if (!LINE_ACTIONS.includes(line.action)) {
    problems.push(
      `${label} har action «${line.action}», men må være create, merge eller skip`
    );
  }
  if (line.action === "merge" && line.mergeInto.length === 0) {
    problems.push(`${label} skal slås sammen, men mergeInto er tom`);
  }
  for (const rowId of line.mergeInto) {
    if (!lookups.rowIds.has(rowId)) {
      problems.push(`${label} viser til ukjent rad ${rowId} i mergeInto`);
    }
  }
  if (line.partnerKey !== null && !lookups.partnerKeys.has(line.partnerKey)) {
    problems.push(
      `${label} har partnerKey «${line.partnerKey}», som ikke finnes i partners`
    );
  }
  if (!isBenefitSection(line.section)) {
    problems.push(`${label} har ugyldig section «${line.section}»`);
  }
  if (line.action === "create" && !line.titleNb.trim()) {
    problems.push(`Linje ${line.id} er ny, men titleNb er tom`);
  }
  return problems;
}

function rowUpdateProblems(
  row: PlannedRowUpdate,
  lookups: PlanLookups
): string[] {
  const label = `Rad ${row.rowId} («${row.title}»)`;
  const problems: string[] = [];
  if (!isBenefitSection(row.section)) {
    problems.push(`${label} har ugyldig section «${row.section}»`);
  }
  if (row.category !== null && !isBenefitCategory(row.category)) {
    problems.push(`${label} har ugyldig category «${row.category}»`);
  }
  if (row.partnerKey !== null && !lookups.partnerKeys.has(row.partnerKey)) {
    problems.push(
      `${label} har partnerKey «${row.partnerKey}», som ikke finnes i partners`
    );
  }
  return problems;
}

function referenceProblems(plan: MigrationPlan, rowIds: Set<string>): string[] {
  const codes = plan.codes
    .filter((code) => !rowIds.has(code.rowId))
    .map((code) => `Kode for ukjent rad ${code.rowId}`);
  const deletions = plan.deletions
    .filter((deletion) => !rowIds.has(deletion.rowId))
    .map((deletion) => `Sletting av ukjent rad ${deletion.rowId}`);
  return [...codes, ...deletions];
}

/** Returns one readable problem per mistake; an empty list means valid. */
export function validateMigrationPlan(plan: MigrationPlan): string[] {
  const lookups: PlanLookups = {
    partnerKeys: new Set(plan.partners.map((partner) => partner.key)),
    rowIds: new Set(plan.rowUpdates.map((row) => row.rowId)),
  };
  return [
    ...(plan.version === 1
      ? []
      : [`Ukjent planversjon ${plan.version}, forventet 1`]),
    ...duplicateCreateProblems(plan.lines),
    ...plan.lines.flatMap((line) => lineProblems(line, lookups)),
    ...plan.rowUpdates.flatMap((row) => rowUpdateProblems(row, lookups)),
    ...referenceProblems(plan, lookups.rowIds),
  ];
}

// ── Summary and review ────────────────────────────────────────────────────

export function summarizeMigrationPlan(plan: MigrationPlan): MigrationSummary {
  const count = (action: PlannedLine["action"]) =>
    plan.lines.filter((line) => line.action === action).length;
  return {
    codes: plan.codes.length,
    created: count("create"),
    deletions: plan.deletions.length,
    merged: count("merge"),
    partners: plan.partners.length,
    skipped: count("skip"),
    sourceLines: plan.lines.reduce(
      (sum, line) => sum + line.sourceCampusIds.length,
      0
    ),
    updated: plan.rowUpdates.length,
  };
}

function cell(text: string): string {
  return text.replace(LINE_BREAKS, " ").replace(TABLE_PIPE, "\\|");
}

function table(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) {
    return ["Ingen.", ""];
  }
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
    "",
  ];
}

function partnerLabel(
  key: string | null,
  partners: Map<string, PlannedPartner>
): string | null {
  if (key === null) {
    return null;
  }
  return partners.get(key)?.name ?? key;
}

function lineAction(line: PlannedLine, titles: Map<string, string>): string {
  if (line.action === "merge") {
    const targets = line.mergeInto.map((id) => `«${titles.get(id) ?? id}»`);
    return `Slås sammen med ${targets.join(", ")}`;
  }
  return line.action === "skip" ? "Hoppes over" : "Ny";
}

function renderHeader(plan: MigrationPlan): string[] {
  const summary = summarizeMigrationPlan(plan);
  return [
    "# Migrering av fordeler fra campus_data",
    "",
    `Generert: ${plan.generatedAt}`,
    "",
    `- Kildelinjer: ${summary.sourceLines}`,
    `- Nye: ${summary.created}`,
    `- Slås sammen: ${summary.merged}`,
    `- Hoppes over: ${summary.skipped}`,
    `- Eksisterende fordeler som oppdateres: ${summary.updated}`,
    `- Nye partnere: ${summary.partners}`,
    `- Koder: ${summary.codes}`,
    `- Foreslått slettet: ${summary.deletions}`,
    "",
  ];
}

interface ReviewLookups {
  partners: Map<string, PlannedPartner>;
  titles: Map<string, string>;
}

function lineRow(line: PlannedLine, lookups: ReviewLookups): string[] {
  const partner = partnerLabel(line.partnerKey, lookups.partners);
  const details = [line.note, partner && `Partner: ${partner}`];
  return [
    line.titleNb,
    lineAction(line, lookups.titles),
    details.filter(Boolean).join(NOTE_SEPARATOR),
  ];
}

function renderCampusLines(
  campusId: string,
  lines: PlannedLine[],
  lookups: ReviewLookups
): string[] {
  const campusLines = lines.filter((line) => line.campusId === campusId);
  if (campusLines.length === 0) {
    return [];
  }
  const out = [`## ${campusName(campusId)}`, ""];
  for (const section of BENEFIT_SECTIONS) {
    const rows = campusLines
      .filter((line) => line.section === section)
      .map((line) => lineRow(line, lookups));
    if (rows.length > 0) {
      out.push(`### ${sectionLabel(section)}`, "");
      out.push(...table(["Tekst", "Handling", "Detaljer"], rows));
    }
  }
  return out;
}

function renderExisting(
  plan: MigrationPlan,
  partners: ReviewLookups["partners"]
): string[] {
  const rows = plan.rowUpdates.map((row) => [
    row.title,
    campusName(row.campusId),
    sectionLabel(row.section),
    row.category
      ? (BENEFIT_CATEGORY_LABELS[row.category]?.nb ?? row.category)
      : EMPTY_CELL,
    partnerLabel(row.partnerKey, partners) ?? EMPTY_CELL,
  ]);
  return [
    "## Eksisterende fordeler",
    "",
    ...table(["Tittel", "Campus", "Seksjon", "Kategori", "Partner"], rows),
  ];
}

function renderPartnersAndDeletions(plan: MigrationPlan): string[] {
  const partnerRows = plan.partners.map((partner) => [
    partner.suggested ? `${partner.name} (forslag)` : partner.name,
    campusName(partner.campusId),
  ]);
  const deletionRows = plan.deletions.map((deletion) => [
    deletion.title,
    deletion.approved ? "godkjent" : "krever godkjenning",
  ]);
  return [
    "## Nye partnere",
    "",
    ...table(["Navn", "Campus"], partnerRows),
    "## Foreslått slettet",
    "",
    ...table(["Tittel", "Status"], deletionRows),
    "## Koder",
    "",
    `Koder som flyttes: ${plan.codes.length}`,
    "",
  ];
}

const REVIEW_INSTRUCTIONS = [
  "## Slik godkjenner du planen",
  "",
  "1. Rett opp i `plan.json` der forslaget over er feil:",
  "   - `action` på en linje: `create` (ny), `merge` (slås sammen) eller `skip` (hoppes over).",
  "   - `mergeInto`: ID-ene til de eksisterende radene linjen slås sammen med.",
  "   - `partnerKey`: nøkkelen til en partner i `partners`, eller `null` for ingen partner.",
  "   - `approved`: sett til `true` på slettinger du godkjenner.",
  "2. Kjør apply fra `packages/shared`: `bun run migrate:benefits --apply --plan <sti til plan.json>`.",
  "",
];

/** Norwegian Markdown review of a plan. Never prints redemption code values. */
export function renderMigrationReview(plan: MigrationPlan): string {
  const lookups: ReviewLookups = {
    partners: new Map(plan.partners.map((partner) => [partner.key, partner])),
    titles: new Map(plan.rowUpdates.map((row) => [row.rowId, row.title])),
  };
  return [
    ...renderHeader(plan),
    ...REVIEW_CAMPUS_ORDER.flatMap((campusId) =>
      renderCampusLines(campusId, plan.lines, lookups)
    ),
    ...renderExisting(plan, lookups.partners),
    ...renderPartnersAndDeletions(plan),
    ...REVIEW_INSTRUCTIONS,
  ].join("\n");
}
