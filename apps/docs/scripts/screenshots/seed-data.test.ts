import { expect, setSystemTime, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  JobApplicationsStatus,
  JobInterviewsStatus,
  JobsStatus,
} from "@repo/api/types/appwrite";
import { RECRUITMENT_STAFF_TEAMS } from "@repo/shared/recruitment";
import {
  parseScorecardCriteria,
  recruitmentAiScreeningSchema,
  recruitmentApplicationReviewMetadataSchema,
  recruitmentCustomQuestionsSchema,
  recruitmentScreeningRubricSchema,
  recruitmentVacancyMetadataSchema,
} from "@repo/shared/types/recruitment";
import {
  getManagedCampuses,
  isNationalOperations,
  KNOWN_CAMPUS_NAMES,
} from "@repo/shared/utils/team-roles";
import {
  BASE_DATE,
  buildSeedData,
  DRAFT_JOB_ID,
  PUBLISHED_JOB_ID,
  type SeedData,
  type SeedRow,
  SHOWCASE,
} from "./seed-data";

const REPO_ROOT = join(import.meta.dir, "../../../..");
const readRepoFile = (path: string): string =>
  readFileSync(join(REPO_ROOT, path), "utf8");

interface SchemaColumn {
  elements?: string[];
  key: string;
  relatedTable?: string;
  required?: boolean;
  size?: number;
  type: string;
}
interface SchemaTable {
  $id: string;
  columns: SchemaColumn[];
  databaseId: string;
}

const SCHEMA = JSON.parse(
  readRepoFile("packages/api/appwrite.config.json")
) as { tables: SchemaTable[] };

function schemaTable(tableId: string): SchemaTable {
  const table = SCHEMA.tables.find(
    (entry) => entry.$id === tableId && entry.databaseId === "app"
  );
  if (!table) {
    throw new Error(`No table "${tableId}" in appwrite.config.json`);
  }
  return table;
}

const seed = buildSeedData();
const rowsOf = (tableId: string): SeedRow[] =>
  seed.rows.filter((row) => row.tableId === tableId);

/** Every string anywhere in the seed, including inside nested rows. */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      allStrings(item, out);
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      allStrings(item, out);
    }
  }
  return out;
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ROW_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EXAMPLE_EMAIL = /@example\.org$/;
const PRODUCTION_DOMAIN = /biso\.no/i;
const BI_EMAIL = /@(?:[a-z0-9-]+\.)*bi\.no\b/i;
const CAMPUS_TEAM_TEMPLATE =
  /`sg-app-campus-\$\{campusName\.toLowerCase\(\)\.replace\(/;
const TOUR_DEFINITION = /return \{ id: "([^"]+)", version: (\d+)/;
const HR_DEPARTMENT_KEYS = new Set(["hr", "hrunit"]);

test("is deterministic", () => {
  const first: SeedData = buildSeedData();
  const second: SeedData = buildSeedData();
  expect(first).toEqual(second);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
});

test("does not depend on the current date", () => {
  const today: SeedData = buildSeedData();
  setSystemTime(new Date("2031-06-15T12:34:56.789Z"));
  try {
    expect(buildSeedData()).toEqual(today);
  } finally {
    setSystemTime();
  }
});

test("every email ends in @example.org", () => {
  const emails = allStrings(seed).flatMap((text) =>
    Array.from(text.matchAll(EMAIL_PATTERN), (match) => match[0])
  );
  expect(emails.length).toBeGreaterThan(0);
  for (const email of emails) {
    expect(email).toMatch(EXAMPLE_EMAIL);
  }
  for (const user of seed.users) {
    expect(user.email).toMatch(EXAMPLE_EMAIL);
  }
  for (const row of rowsOf("job_applications")) {
    expect(row.data.applicant_email as string).toMatch(EXAMPLE_EMAIL);
  }
});

test("every application status from the generated types appears", () => {
  const statuses = new Set(
    rowsOf("job_applications").map((row) => row.data.status)
  );
  for (const status of Object.values(JobApplicationsStatus)) {
    expect(statuses.has(status)).toBe(true);
  }
});

test("no field holds biso.no or a real campus email", () => {
  for (const text of allStrings(seed)) {
    expect(text).not.toMatch(PRODUCTION_DOMAIN);
    expect(text).not.toMatch(BI_EMAIL);
  }
  for (const row of rowsOf("campus")) {
    expect(row.data.email ?? null).toBeNull();
  }
});

test("holds what the shots need", () => {
  expect(rowsOf("campus")).toHaveLength(1);
  const departmentNames = rowsOf("departments").map((row) => row.data.Name);
  expect(departmentNames).toContain("HR");
  expect(departmentNames).toContain("Demo Events");

  const jobs = rowsOf("jobs");
  expect(jobs.map((row) => row.data.status).sort()).toEqual([
    JobsStatus.DRAFT,
    JobsStatus.PUBLISHED,
  ]);
  expect(jobs.find((row) => row.rowId === PUBLISHED_JOB_ID)?.data.status).toBe(
    JobsStatus.PUBLISHED
  );
  expect(jobs.find((row) => row.rowId === DRAFT_JOB_ID)?.data.status).toBe(
    JobsStatus.DRAFT
  );

  const applications = rowsOf("job_applications");
  expect(applications).toHaveLength(8);
  for (const row of applications) {
    expect(row.data.job_id).toBe(PUBLISHED_JOB_ID);
  }

  const interviews = rowsOf("job_interviews");
  expect(
    interviews.filter(
      (row) => row.data.status === JobInterviewsStatus.SCHEDULED
    ).length
  ).toBeGreaterThanOrEqual(1);
  expect(rowsOf("job_interview_scorecards").length).toBeGreaterThanOrEqual(1);

  const roles = seed.users.map((user) => user.role);
  for (const role of ["hr", "globaladmin", "department"] as const) {
    expect(roles).toContain(role);
    const sessionUser = seed.users.find(
      (user) => user.id === seed.sessionUsers[role]
    );
    expect(sessionUser?.role).toBe(role);
  }
});

test("the showcase points at seeded rows", () => {
  const applicationIds = rowsOf("job_applications").map((row) => row.rowId);
  expect(applicationIds).toContain(SHOWCASE.drawerApplicationId);
  const names = rowsOf("job_applications").map(
    (row) => row.data.applicant_name
  );
  expect(names).toContain(SHOWCASE.scheduleCandidateName);
  expect(names).toContain(SHOWCASE.scorecardCandidateName);
  const scheduled = rowsOf("job_applications").find(
    (row) => row.data.applicant_name === SHOWCASE.scheduleCandidateName
  );
  // The schedule dialog is opened from a Shortlist card.
  expect(scheduled?.data.status).toBe(JobApplicationsStatus.REVIEWED);
  const scored = rowsOf("job_applications").find(
    (row) => row.data.applicant_name === SHOWCASE.scorecardCandidateName
  );
  // The scorecard is written for a candidate with a scheduled interview.
  expect(
    rowsOf("job_interviews").some(
      (row) =>
        row.data.application_id === scored?.rowId &&
        row.data.status === JobInterviewsStatus.SCHEDULED
    )
  ).toBe(true);
});

test("row ids are unique, fixed and valid Appwrite ids", () => {
  const ids = new Set<string>();
  for (const row of seed.rows) {
    expect(row.rowId).toMatch(ROW_ID_PATTERN);
    const key = `${row.tableId}/${row.rowId}`;
    expect(ids.has(key)).toBe(false);
    ids.add(key);
  }
  for (const id of [
    ...seed.users.map((user) => user.id),
    ...seed.teams.map((team) => team.id),
  ]) {
    expect(id).toMatch(ROW_ID_PATTERN);
  }
});

function checkColumns(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
) {
  const table = schemaTable(tableId);
  const columns = new Map(table.columns.map((column) => [column.key, column]));
  for (const key of Object.keys(data)) {
    if (key === "$id" || key === "$permissions") {
      continue;
    }
    if (key === "$createdAt" || key === "$updatedAt") {
      expect(data[key] as string).toMatch(ISO_DATE_PATTERN);
      continue;
    }
    const column = columns.get(key);
    if (!column) {
      throw new Error(`${tableId}/${rowId}: "${key}" is not a column`);
    }
    const value = data[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (column.elements) {
      expect(column.elements).toContain(value as string);
    }
    if (
      column.type === "string" &&
      typeof column.size === "number" &&
      (value as string).length > column.size
    ) {
      throw new Error(`${tableId}/${rowId}: "${key}" is too long`);
    }
    if (column.type === "datetime") {
      expect(value as string).toMatch(ISO_DATE_PATTERN);
    }
  }
  for (const column of table.columns) {
    if (column.required && (data[column.key] ?? null) === null) {
      throw new Error(`${tableId}/${rowId}: "${column.key}" is required`);
    }
  }
}

test("rows use real columns, fill required ones and respect enums", () => {
  for (const row of seed.rows) {
    checkColumns(row.tableId, row.rowId, row.data);
    if (row.tableId === "jobs") {
      for (const translation of row.data.translations as Record<
        string,
        unknown
      >[]) {
        checkColumns(
          "content_translations",
          translation.$id as string,
          translation
        );
      }
    }
  }
});

test("relationship links point at seeded rows", () => {
  const exists = (tableId: string, id: unknown) =>
    seed.rows.some((row) => row.tableId === tableId && row.rowId === id);
  for (const row of rowsOf("jobs")) {
    expect(exists("campus", row.data.campus)).toBe(true);
    expect(exists("departments", row.data.department)).toBe(true);
    expect(row.data.campus).toBe(row.data.campus_id);
    expect(row.data.department).toBe(row.data.department_id);
  }
  for (const row of rowsOf("job_applications")) {
    expect(exists("jobs", row.data.job)).toBe(true);
    expect(exists("candidate_profiles", row.data.candidate_profile)).toBe(true);
  }
  for (const row of rowsOf("job_interviews")) {
    expect(exists("job_applications", row.data.application)).toBe(true);
  }
  for (const row of rowsOf("job_interview_participants")) {
    expect(exists("job_interviews", row.data.interview)).toBe(true);
  }
  for (const row of rowsOf("job_interview_scorecards")) {
    expect(exists("job_interviews", row.data.interview_id)).toBe(true);
    // The admin's submitScorecard never writes the `interview` link, so the
    // seed leaves it out too and the screens match production.
    expect(row.data.interview).toBeUndefined();
  }
  for (const row of rowsOf("job_application_answers")) {
    expect(exists("job_applications", row.data.application)).toBe(true);
  }
});

test("JSON columns parse with the shared recruitment schemas", () => {
  for (const row of rowsOf("jobs")) {
    recruitmentVacancyMetadataSchema.parse(
      JSON.parse(row.data.metadata as string)
    );
    recruitmentCustomQuestionsSchema.parse(
      JSON.parse(row.data.custom_questions as string)
    );
    recruitmentScreeningRubricSchema.parse(
      JSON.parse(row.data.screening_rubric as string)
    );
  }
  for (const row of rowsOf("job_applications")) {
    recruitmentApplicationReviewMetadataSchema.parse(
      JSON.parse(row.data.review_metadata as string)
    );
    if (row.data.ai_screening !== null) {
      recruitmentAiScreeningSchema.parse(
        JSON.parse(row.data.ai_screening as string)
      );
    }
  }
  for (const row of rowsOf("job_interview_scorecards")) {
    expect(parseScorecardCriteria(row.data.criteria)).toHaveLength(5);
  }
});

test("dates come from the fixed base date", () => {
  expect(BASE_DATE).toBe("2026-09-01T00:00:00.000Z");
  for (const text of allStrings(seed)) {
    if (ISO_DATE_PATTERN.test(text)) {
      expect(Date.parse(text)).toBeGreaterThanOrEqual(Date.parse(BASE_DATE));
    }
  }
});

test("staff rows grant access only to the recruitment staff teams", () => {
  const staffTables = [
    "job_applications",
    "job_application_answers",
    "candidate_profiles",
    "job_interviews",
    "job_interview_participants",
    "job_interview_scorecards",
  ];
  for (const row of seed.rows.filter((entry) =>
    staffTables.includes(entry.tableId)
  )) {
    for (const permission of row.permissions) {
      expect(
        RECRUITMENT_STAFF_TEAMS.some((team) =>
          permission.includes(`team:${team}`)
        )
      ).toBe(true);
    }
  }
  const draft = rowsOf("jobs").find((row) => row.rowId === DRAFT_JOB_ID);
  expect(draft?.permissions.some((p) => p.includes('"any"'))).toBe(false);
  const published = rowsOf("jobs").find(
    (row) => row.rowId === PUBLISHED_JOB_ID
  );
  expect(published?.permissions).toContain('read("any")');
});

test("each staff user's teams give exactly the intended role", () => {
  const teamById = new Map(seed.teams.map((team) => [team.id, team]));
  for (const user of seed.users) {
    const teams = user.teamIds.map((id) => {
      const team = teamById.get(id);
      if (!team) {
        throw new Error(`${user.id}: unknown team ${id}`);
      }
      return team;
    });
    // Mirrors parseTeamMemberships() in apps/admin/src/lib/authorization-team-memberships.ts.
    const campusNames = teams
      .filter((team) => KNOWN_CAMPUS_NAMES.has(team.name))
      .map((team) => team.name);
    const departmentNames = teams
      .filter((team) => team.id.startsWith("sg-app-dept-"))
      .map((team) => team.name);
    expect(campusNames.length + departmentNames.length).toBe(teams.length);

    // Mirrors isHrDepartment() in apps/admin/src/lib/recruitment.ts.
    const isHr = departmentNames.some((name) =>
      HR_DEPARTMENT_KEYS.has(name.replace(/\s+/g, "").toLowerCase())
    );
    const isGlobalAdmin = isNationalOperations(campusNames, departmentNames);
    const managed = getManagedCampuses(campusNames, departmentNames);

    expect(managed).toEqual([]);
    expect(campusNames.length).toBe(1);
    if (user.role === "hr") {
      expect(isHr).toBe(true);
      expect(isGlobalAdmin).toBe(false);
      expect(campusNames).toEqual(["Oslo"]);
    } else if (user.role === "globaladmin") {
      expect(isGlobalAdmin).toBe(true);
      expect(isHr).toBe(false);
    } else {
      expect(departmentNames.length).toBeGreaterThan(0);
      expect(isHr).toBe(false);
      expect(isGlobalAdmin).toBe(false);
    }
  }
});

test("team and campus ids follow the admin's conventions", () => {
  const teamIds = seed.teams.map((team) => team.id);
  for (const staffTeam of RECRUITMENT_STAFF_TEAMS) {
    expect(teamIds).toContain(staffTeam);
  }
  const jobsActions = readRepoFile(
    "apps/admin/src/app/(portal)/_actions/jobs.ts"
  );
  expect(jobsActions).toContain('const HR_TEAM_ID = "sg-app-dept-hr";');
  expect(jobsActions).toContain(
    'const NATIONAL_CAMPUS_TEAM_ID = "sg-app-campus-national";'
  );
  expect(jobsActions).toMatch(CAMPUS_TEAM_TEMPLATE);
  expect(teamIds).toContain("sg-app-campus-oslo");
  expect(teamIds).toContain("sg-app-campus-national");

  const campusConstants = readRepoFile(
    "apps/admin/src/lib/campus-constants.ts"
  );
  const campus = rowsOf("campus")[0];
  expect(campusConstants).toContain(
    `${campus.data.name as string}: "${campus.rowId}",`
  );

  const recruitment = readRepoFile("apps/admin/src/lib/recruitment.ts");
  expect(recruitment).toContain('const HR_DEPARTMENT_KEY = "hr";');
});

test("tour progress matches the admin's recruitment tour", () => {
  const source = readRepoFile(
    "apps/admin/src/components/tours/recruitment-hr.ts"
  );
  const match = source.match(TOUR_DEFINITION);
  expect(match).not.toBeNull();
  const tours = rowsOf("tour_progress");
  expect(tours.length).toBe(seed.users.length);
  for (const row of tours) {
    expect(row.data.tour_id).toBe(match?.[1]);
    expect(row.data.version).toBe(Number(match?.[2]));
    expect(["completed", "dismissed"]).toContain(row.data.status as string);
    expect(row.permissions).toEqual([
      `read("user:${row.data.user_id as string}")`,
      `update("user:${row.data.user_id as string}")`,
      `delete("user:${row.data.user_id as string}")`,
    ]);
  }
});
