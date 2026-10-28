/**
 * Made-up data for the docs-only Appwrite project that the guide's
 * screenshots are taken from. Everything here is invented: the people, the
 * department, the vacancies and the answers. Every email is @example.org.
 *
 * Deterministic: fixed ids and dates from BASE_DATE, so seeding twice gives
 * the same project and `seed.ts` can upsert by id.
 *
 * The rows are shaped like the ones the admin and the public site write
 * (`apps/admin/src/app/(portal)/_actions/{jobs,interviews}.ts`,
 * `packages/shared/recruitment/apply.ts`), so the screens show what staff see.
 */
import { Permission, Role } from "@repo/api";
import {
  type Campus,
  type CandidateProfiles,
  CandidateProfilesEmbeddingStatus,
  type ContentTranslations,
  ContentTranslationsContentType,
  ContentTranslationsLocale,
  type Departments,
  type JobApplicationAnswers,
  JobApplicationAnswersAnswerType,
  type JobApplications,
  JobApplicationsEmbeddingStatus,
  JobApplicationsStatus,
  type JobInterviewParticipants,
  JobInterviewParticipantsResponseStatus,
  JobInterviewParticipantsRole,
  type JobInterviewScorecards,
  JobInterviewScorecardsRecommendation,
  type JobInterviews,
  JobInterviewsStatus,
  type Jobs,
  JobsStatus,
  type TourProgress,
  TourProgressStatus,
} from "@repo/api/types/appwrite";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import {
  computeRecruitmentRetentionUntil,
  computeScreeningNormalizedScore,
  type RecruitmentAiScreening,
  type RecruitmentApplicationReviewMetadata,
  type RecruitmentCustomQuestion,
  type RecruitmentScorecardCriterion,
  type RecruitmentScreeningRubric,
  type RecruitmentVacancyMetadata,
} from "@repo/shared/types/recruitment";

export const DATABASE_ID = "app";
export const BASE_DATE = "2026-09-01T00:00:00.000Z";

const BASE_MS = Date.parse(BASE_DATE);
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** A date `day` days after BASE_DATE, at hh:mm UTC. Never relative to now. */
function at(day: number, hour = 0, minute = 0): string {
  return new Date(
    BASE_MS + day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS
  ).toISOString();
}

export type StaffRole = "hr" | "globaladmin" | "department";

export type SeedTableId =
  | "campus"
  | "departments"
  | "jobs"
  | "candidate_profiles"
  | "job_applications"
  | "job_application_answers"
  | "job_interviews"
  | "job_interview_participants"
  | "job_interview_scorecards"
  | "tour_progress";

export interface SeedRow {
  data: Record<string, unknown>;
  permissions: string[];
  rowId: string;
  tableId: SeedTableId;
}

export interface SeedTeam {
  id: string;
  name: string;
}

export interface SeedUser {
  email: string;
  id: string;
  name: string;
  role: StaffRole;
  teamIds: string[];
}

export interface SeedData {
  baseDate: string;
  databaseId: string;
  /** In write order: a row's links always point at rows written before it. */
  rows: SeedRow[];
  /** The user `capture.ts` signs in as for each role. */
  sessionUsers: Record<StaffRole, string>;
  teams: SeedTeam[];
  users: SeedUser[];
}

// ---------------------------------------------------------------------------
// Row input types: each table's own columns from the generated types, plus the
// relationship links the admin writes as plain ids.
// ---------------------------------------------------------------------------

type RowMeta =
  | "$id"
  | "$sequence"
  | "$tableId"
  | "$databaseId"
  | "$createdAt"
  | "$updatedAt"
  | "$permissions";
type Scalar = string | number | boolean | null | readonly string[];
/** A row's columns, without Appwrite's `$` fields and relationship objects. */
type Columns<T> = {
  [K in Exclude<keyof T, RowMeta> as T[K] extends Scalar ? K : never]: T[K];
};
interface Timestamps {
  $createdAt: string;
  $updatedAt: string;
}

type CampusInput = Columns<Campus>;
type DepartmentInput = Pick<
  Columns<Departments>,
  "Id" | "Name" | "abbreviation" | "active" | "campus_id"
>;
type TranslationInput = Pick<
  Columns<ContentTranslations>,
  | "additional_fields"
  | "content_id"
  | "content_type"
  | "description"
  | "locale"
  | "short_description"
  | "title"
> & { $id: string; $permissions: string[] };
type JobInput = Columns<Jobs> &
  Timestamps & {
    campus: string;
    department: string;
    translations: TranslationInput[];
  };
type CandidateProfileInput = Columns<CandidateProfiles>;
type ApplicationInput = Columns<JobApplications> &
  Timestamps & { candidate_profile: string; job: string };
type AnswerInput = Columns<JobApplicationAnswers> & { application: string };
type InterviewInput = Columns<JobInterviews> &
  Timestamps & { application: string };
type ParticipantInput = Columns<JobInterviewParticipants> & {
  interview: string;
};
type ScorecardInput = Columns<JobInterviewScorecards>;
type TourProgressInput = Columns<TourProgress>;

/** Typed when built, plain once in the seed: tests and seed.ts read it generically. */
function row<T extends object>(
  tableId: SeedTableId,
  rowId: string,
  data: T,
  permissions: string[]
): SeedRow {
  return {
    data: { ...data } as Record<string, unknown>,
    permissions,
    rowId,
    tableId,
  };
}

// ---------------------------------------------------------------------------
// Ids. Campus "1" is Oslo in the admin's CAMPUS_NAME_TO_ID
// (apps/admin/src/lib/campus-constants.ts), so campus teams and the reviewer
// panel resolve to it. Team ids follow the admin's sg-app-* conventions.
// ---------------------------------------------------------------------------

const CAMPUS_ID = "1";
const HR_DEPARTMENT_ID = "docs-dept-hr";
const EVENTS_DEPARTMENT_ID = "docs-dept-demo-events";

export const PUBLISHED_JOB_ID = "docs-job-event-coordinator";
export const DRAFT_JOB_ID = "docs-job-social-media";

const TEAM = {
  demoEvents: "sg-app-dept-demoevents",
  hr: "sg-app-dept-hr",
  national: "sg-app-campus-national",
  operations: "sg-app-dept-operationsunit",
  oslo: "sg-app-campus-oslo",
} as const;

const USER = {
  ingrid: "docs-user-ingrid",
  kari: "docs-user-kari",
  lars: "docs-user-lars",
  per: "docs-user-per",
} as const;

/** The candidates and rows the manifest's shots open. */
export const SHOWCASE = {
  drawerApplicationId: "docs-app-sofie",
  scheduleCandidateName: "Emil Larsen",
  scorecardCandidateName: "Jonas Dahl",
} as const;

const TOUR_ID = "recruitment-hr";
const TOUR_VERSION = 1;

// ---------------------------------------------------------------------------
// People and teams
// ---------------------------------------------------------------------------

/**
 * Team names are what the admin's role logic reads
 * (`parseTeamMemberships()` and `isHrDepartment()`): campus teams must be
 * named after a campus, and the HR team must be named "HR". The made-up unit
 * is the "Demo Events" department.
 */
const TEAMS: SeedTeam[] = [
  { id: TEAM.oslo, name: "Oslo" },
  { id: TEAM.national, name: "National" },
  { id: TEAM.hr, name: "HR" },
  { id: TEAM.operations, name: "Operations Unit" },
  { id: TEAM.demoEvents, name: "Demo Events" },
];

const USERS: SeedUser[] = [
  {
    email: "kari.nordmann@example.org",
    id: USER.kari,
    name: "Kari Nordmann",
    role: "hr",
    teamIds: [TEAM.oslo, TEAM.hr],
  },
  {
    // A second HR member, so the interview panel has more than one person.
    email: "per.olsen@example.org",
    id: USER.per,
    name: "Per Olsen",
    role: "hr",
    teamIds: [TEAM.oslo, TEAM.hr],
  },
  {
    email: "ingrid.berg@example.org",
    id: USER.ingrid,
    name: "Ingrid Berg",
    role: "globaladmin",
    teamIds: [TEAM.national, TEAM.operations],
  },
  {
    email: "lars.johansen@example.org",
    id: USER.lars,
    name: "Lars Johansen",
    role: "department",
    teamIds: [TEAM.oslo, TEAM.demoEvents],
  },
];

function userById(id: string): SeedUser {
  const user = USERS.find((entry) => entry.id === id);
  if (!user) {
    throw new Error(`Unknown seed user ${id}`);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

const PUBLISHED_DEADLINE = at(135, 22, 59);
const DRAFT_DEADLINE = at(150, 22, 59);

const QUESTIONS: RecruitmentCustomQuestion[] = [
  {
    help_text: null,
    id: "hours",
    label: "How many hours a week can you give?",
    options: ["2–4 hours", "4–6 hours", "More than 6 hours"],
    required: true,
    type: "select",
  },
  {
    help_text: null,
    id: "motivation",
    label: "Why do you want this role?",
    options: [],
    required: true,
    type: "long_text",
  },
];

const RUBRIC: RecruitmentScreeningRubric = {
  criteria: [
    { description: null, key: "planning", label: "Planning", weight: 2 },
    { description: null, key: "teamwork", label: "Teamwork", weight: 1 },
    {
      description: null,
      key: "communication",
      label: "Communication",
      weight: 1,
    },
  ],
  must_have: ["Has planned or helped run an event", "Can give 4 hours a week"],
  nice_to_have: ["Has used a ticketing system", "Speaks Norwegian and English"],
};

interface VacancyText {
  descriptionEn: string;
  descriptionNo: string;
  shortEn: string;
  shortNo: string;
  titleEn: string;
  titleNo: string;
}

function vacancyMetadata(
  overrides: Partial<RecruitmentVacancyMetadata>
): RecruitmentVacancyMetadata {
  return {
    audience: "public",
    auto_screen: true,
    auto_translate: false,
    commitment: "4–6 hours a week",
    company: null,
    contact_email: "kari.nordmann@example.org",
    contact_name: "Kari Nordmann",
    contact_role: "HR, Oslo",
    cover_image_file_id: null,
    cover_image_url: null,
    cover_pattern: null,
    cv_required: false,
    employment_type: "volunteer",
    location: "Oslo",
    newsletter: false,
    paid: false,
    publication_mode: "now",
    push_to_inboxes: false,
    scheduled_publish_at: null,
    short_description: null,
    start_date: null,
    tags: ["Volunteer"],
    term: "Spring 2027",
    ...overrides,
  };
}

/** Mirrors `buildJobRowPermissions()` in apps/admin/src/lib/recruitment.ts. */
function jobPermissions(status: JobsStatus): string[] {
  const visibility =
    status === JobsStatus.PUBLISHED ? [Permission.read(Role.any())] : [];
  return [
    ...new Set([...visibility, ...buildRecruitmentStaffRowPermissions()]),
  ];
}

function vacancyRow(input: {
  createdAt: string;
  deadline: string;
  id: string;
  metadata: RecruitmentVacancyMetadata;
  slug: string;
  status: JobsStatus;
  text: VacancyText;
  updatedAt: string;
}): SeedRow {
  const permissions = jobPermissions(input.status);
  const translation = (
    locale: ContentTranslationsLocale,
    title: string,
    description: string,
    short: string
  ): TranslationInput => ({
    $id: `docs-tr-${input.slug}-${locale}`,
    $permissions: permissions,
    additional_fields: null,
    content_id: input.id,
    content_type: ContentTranslationsContentType.JOB,
    description,
    locale,
    short_description: short,
    title,
  });

  const data: JobInput = {
    $createdAt: input.createdAt,
    $updatedAt: input.updatedAt,
    application_deadline: input.deadline,
    auto_screen: true,
    campus: CAMPUS_ID,
    campus_id: CAMPUS_ID,
    custom_questions: JSON.stringify(QUESTIONS),
    department: EVENTS_DEPARTMENT_ID,
    department_id: EVENTS_DEPARTMENT_ID,
    embedding_id: null,
    interview_template: null,
    metadata: JSON.stringify(input.metadata),
    notify_push: false,
    scheduled_publish_at: null,
    screening_rubric: JSON.stringify(RUBRIC),
    slug: input.slug,
    status: input.status,
    translations: [
      translation(
        ContentTranslationsLocale.NO,
        input.text.titleNo,
        input.text.descriptionNo,
        input.text.shortNo
      ),
      translation(
        ContentTranslationsLocale.EN,
        input.text.titleEn,
        input.text.descriptionEn,
        input.text.shortEn
      ),
    ],
  };
  return row("jobs", input.id, data, permissions);
}

function vacancies(): SeedRow[] {
  const coordinatorShort =
    "Plan and run student evenings for Demo Events in Oslo this spring.";
  const coordinatorShortNo =
    "Planlegg og gjennomfør studentkvelder for Demo Events i Oslo i vår.";
  const socialShort =
    "Make posts and short videos about what Demo Events does.";
  const socialShortNo = "Lag innlegg og korte videoer om det Demo Events gjør.";

  return [
    vacancyRow({
      createdAt: at(0, 9),
      deadline: PUBLISHED_DEADLINE,
      id: PUBLISHED_JOB_ID,
      metadata: vacancyMetadata({
        short_description: coordinatorShortNo,
        start_date: at(153),
        tags: ["Volunteer", "Leadership"],
      }),
      slug: "event-coordinator",
      status: JobsStatus.PUBLISHED,
      text: {
        descriptionEn:
          "<h2>About the role</h2><p>You plan four student evenings with the Demo Events team: the venue, the programme and the volunteers on the night.</p><h2>What we look for</h2><ul><li>You have planned or helped run an event.</li><li>You can give 4 to 6 hours a week.</li></ul>",
        descriptionNo:
          "<h2>Om rollen</h2><p>Du planlegger fire studentkvelder sammen med Demo Events: lokale, program og frivillige på kvelden.</p><h2>Vi ser etter</h2><ul><li>Du har planlagt eller vært med på å gjennomføre et arrangement.</li><li>Du har 4 til 6 timer i uka.</li></ul>",
        shortEn: coordinatorShort,
        shortNo: coordinatorShortNo,
        titleEn: "Event coordinator",
        titleNo: "Arrangementskoordinator",
      },
      updatedAt: at(0, 9),
    }),
    vacancyRow({
      createdAt: at(2, 13),
      deadline: DRAFT_DEADLINE,
      id: DRAFT_JOB_ID,
      metadata: vacancyMetadata({
        commitment: "2–4 hours a week",
        short_description: socialShortNo,
        start_date: at(160),
        tags: ["Volunteer", "Marketing"],
      }),
      slug: "social-media-volunteer",
      status: JobsStatus.DRAFT,
      text: {
        descriptionEn:
          "<h2>About the role</h2><p>You make posts and short videos about Demo Events, and plan them a month ahead with the team.</p>",
        descriptionNo:
          "<h2>Om rollen</h2><p>Du lager innlegg og korte videoer om Demo Events, og planlegger dem en måned fram i tid sammen med gruppa.</p>",
        shortEn: socialShort,
        shortNo: socialShortNo,
        titleEn: "Social media volunteer",
        titleNo: "Frivillig i sosiale medier",
      },
      updatedAt: at(2, 13),
    }),
  ];
}

// ---------------------------------------------------------------------------
// Applicants: eight, across every application status.
// ---------------------------------------------------------------------------

interface Screening {
  communication: number;
  concerns: string[];
  matches: string[];
  missing: string[];
  overall: number;
  planning: number;
  recommended: RecruitmentAiScreening["recommended_status"];
  strengths: string[];
  summary: string;
  teamwork: number;
}

interface Applicant {
  answerHours: string;
  answerMotivation: string;
  appliedAt: string;
  coverLetter: string;
  currentRole: string;
  key: string;
  name: string;
  reviewedAt: string | null;
  screening: Screening | null;
  source: string;
  starred: boolean;
  status: JobApplicationsStatus;
}

const APPLICANTS: Applicant[] = [
  {
    answerHours: "4–6 hours",
    answerMotivation:
      "I ran our class party for 200 people and want to learn how a bigger team plans events.",
    appliedAt: at(6, 14, 20),
    coverLetter:
      "Hi! I study marketing and ran our class party last year. I would like to plan events with a bigger team.",
    currentRole: "Bachelor student, 1st year",
    key: "ola",
    name: "Ola Hansen",
    reviewedAt: null,
    screening: {
      communication: 3,
      concerns: ["Has not used a ticketing system"],
      matches: [
        "Has planned or helped run an event",
        "Can give 4 hours a week",
      ],
      missing: [],
      overall: 4,
      planning: 4,
      recommended: "interview",
      strengths: ["Has run an event for 200 guests", "Clear, short answers"],
      summary:
        "Ran a class party for 200 guests and wants to learn event budgeting.",
      teamwork: 4,
    },
    source: "linkedin",
    starred: false,
    status: JobApplicationsStatus.SUBMITTED,
  },
  {
    answerHours: "2–4 hours",
    answerMotivation: "I want to meet more students and help out.",
    appliedAt: at(7, 9, 5),
    coverLetter: "I am new in Oslo and want to get to know more students.",
    currentRole: "Bachelor student, 1st year",
    key: "nora",
    name: "Nora Bakken",
    reviewedAt: null,
    // Not screened yet, like an application that came in with AI screening off.
    screening: null,
    source: "biso",
    starred: false,
    status: JobApplicationsStatus.SUBMITTED,
  },
  {
    answerHours: "4–6 hours",
    answerMotivation:
      "I helped run a football tournament and liked the planning more than the playing.",
    appliedAt: at(2, 11, 40),
    coverLetter:
      "I helped run a five-a-side tournament for 16 teams and handled the suppliers.",
    currentRole: "Bachelor student, 2nd year",
    key: "emil",
    name: "Emil Larsen",
    reviewedAt: at(4, 10),
    screening: {
      communication: 4,
      concerns: ["Has not planned an evening event"],
      matches: [
        "Has planned or helped run an event",
        "Can give 4 hours a week",
      ],
      missing: [],
      overall: 4,
      planning: 4,
      recommended: "interview",
      strengths: ["Has worked with suppliers", "Steady and practical"],
      summary:
        "Helped run a 16-team tournament and is used to dealing with suppliers.",
      teamwork: 3,
    },
    source: "referral",
    starred: false,
    status: JobApplicationsStatus.REVIEWED,
  },
  {
    answerHours: "More than 6 hours",
    answerMotivation:
      "I coordinated volunteers at a three-day festival and want to do the same for students.",
    appliedAt: at(3, 16, 10),
    coverLetter:
      "Last summer I coordinated 30 volunteers at a three-day festival. I would love to bring that to Demo Events.",
    currentRole: "Bachelor student, 2nd year",
    key: "sofie",
    name: "Sofie Lie",
    reviewedAt: at(4, 10, 30),
    screening: {
      communication: 5,
      concerns: [],
      matches: [
        "Has planned or helped run an event",
        "Can give 4 hours a week",
        "Has used a ticketing system",
      ],
      missing: [],
      overall: 5,
      planning: 5,
      recommended: "interview",
      strengths: [
        "Coordinated 30 volunteers",
        "Has used a ticketing system",
        "Writes clearly",
      ],
      summary:
        "Coordinated 30 volunteers at a three-day festival and has used a ticketing system.",
      teamwork: 4,
    },
    source: "biso",
    starred: true,
    status: JobApplicationsStatus.REVIEWED,
  },
  {
    answerHours: "4–6 hours",
    answerMotivation:
      "I organise our study group's trips and want to plan something bigger.",
    appliedAt: at(1, 10),
    coverLetter:
      "I plan the trips for my study group, from booking to the budget, and want to try something bigger.",
    currentRole: "Master student, 1st year",
    key: "jonas",
    name: "Jonas Dahl",
    reviewedAt: at(4, 11),
    screening: {
      communication: 4,
      concerns: ["Busy with exams in December"],
      matches: [
        "Has planned or helped run an event",
        "Can give 4 hours a week",
      ],
      missing: [],
      overall: 4,
      planning: 4,
      recommended: "interview",
      strengths: ["Plans to a budget", "Works well in a team"],
      summary:
        "Plans study group trips from booking to budget and works well in a team.",
      teamwork: 5,
    },
    source: "linkedin",
    starred: false,
    status: JobApplicationsStatus.INTERVIEW,
  },
  {
    answerHours: "4–6 hours",
    answerMotivation:
      "I saw the poster on campus and I like making things happen.",
    appliedAt: at(4, 13, 30),
    coverLetter:
      "I saw your poster on campus. I helped with our student cabin trip and liked it.",
    currentRole: "Bachelor student, 3rd year",
    key: "maja",
    name: "Maja Solberg",
    reviewedAt: at(5, 9),
    screening: {
      communication: 3,
      concerns: ["Limited event experience"],
      matches: ["Can give 4 hours a week"],
      missing: ["Has planned or helped run an event"],
      overall: 3,
      planning: 3,
      recommended: "reviewed",
      strengths: ["Keen to learn", "Good at keeping in touch with people"],
      summary:
        "Helped with a cabin trip; keen to learn but has little event experience.",
      teamwork: 4,
    },
    source: "campus",
    starred: false,
    status: JobApplicationsStatus.INTERVIEW,
  },
  {
    answerHours: "More than 6 hours",
    answerMotivation:
      "I ran the welcome week for my programme and want to keep doing events.",
    appliedAt: at(1, 8, 15),
    coverLetter:
      "I led the welcome week for my programme: six events in five days, with a team of eight.",
    currentRole: "Bachelor student, 3rd year",
    key: "henrik",
    name: "Henrik Strand",
    reviewedAt: at(3, 9),
    screening: {
      communication: 4,
      concerns: [],
      matches: [
        "Has planned or helped run an event",
        "Can give 4 hours a week",
        "Speaks Norwegian and English",
      ],
      missing: [],
      overall: 5,
      planning: 5,
      recommended: "interview",
      strengths: ["Led a team of eight", "Ran six events in five days"],
      summary:
        "Led his programme's welcome week: six events in five days with a team of eight.",
      teamwork: 5,
    },
    source: "referral",
    starred: false,
    status: JobApplicationsStatus.ACCEPTED,
  },
  {
    answerHours: "2–4 hours",
    answerMotivation: "It sounds fun.",
    appliedAt: at(5, 20, 45),
    coverLetter: "I would like to help with events.",
    currentRole: "Bachelor student, 1st year",
    key: "ida",
    name: "Ida Haugen",
    reviewedAt: at(6, 10),
    screening: {
      communication: 2,
      concerns: ["Can give 2 to 4 hours a week", "No event experience yet"],
      matches: [],
      missing: [
        "Has planned or helped run an event",
        "Can give 4 hours a week",
      ],
      overall: 2,
      planning: 2,
      recommended: "rejected",
      strengths: ["Positive and keen"],
      summary:
        "Keen, but has no event experience yet and can give 2 to 4 hours a week.",
      teamwork: 3,
    },
    source: "biso",
    starred: false,
    status: JobApplicationsStatus.REJECTED,
  },
];

const applicationId = (applicant: Applicant) => `docs-app-${applicant.key}`;
const profileId = (applicant: Applicant) => `docs-candidate-${applicant.key}`;
const emailOf = (name: string) =>
  `${name.toLowerCase().replace(/\s+/g, ".")}@example.org`;

function applicantByKey(key: string): Applicant {
  const applicant = APPLICANTS.find((entry) => entry.key === key);
  if (!applicant) {
    throw new Error(`Unknown applicant ${key}`);
  }
  return applicant;
}

function aiScreening(
  screening: Screening,
  generatedAt: string
): RecruitmentAiScreening {
  const dimension_scores = [
    {
      name: "Planning",
      reason: "From the cover letter and the answers.",
      score: screening.planning,
    },
    {
      name: "Teamwork",
      reason: "From the cover letter and the answers.",
      score: screening.teamwork,
    },
    {
      name: "Communication",
      reason: "From how the answers are written.",
      score: screening.communication,
    },
  ];
  return {
    concerns: screening.concerns,
    dimension_scores,
    generated_at: generatedAt,
    model: "made-up-screening",
    must_have_matches: screening.matches,
    must_have_missing: screening.missing,
    normalized_score: computeScreeningNormalizedScore({
      dimension_scores,
      overall_score: screening.overall,
    }),
    overall_score: screening.overall,
    recommended_status: screening.recommended,
    red_flags: [],
    strengths: screening.strengths,
    summary: screening.summary,
    version: 1,
  };
}

function interviewStatusFor(
  applicant: Applicant
): RecruitmentApplicationReviewMetadata["interview_status"] {
  if (applicant.key === "jonas") {
    return "scheduled";
  }
  if (applicant.key === "henrik") {
    return "completed";
  }
  return "none";
}

function reviewMetadata(
  applicant: Applicant
): Partial<RecruitmentApplicationReviewMetadata> {
  return {
    ai_email_drafts: {},
    candidate_availability: [],
    hr_availability: [],
    interview_status: interviewStatusFor(applicant),
    ...(applicant.reviewedAt
      ? {
          last_reviewed_at: applicant.reviewedAt,
          last_reviewed_by: userById(USER.kari).email,
        }
      : {}),
    ...(applicant.starred ? { starred: true } : {}),
  };
}

function applicantRows(): SeedRow[] {
  const staff = buildRecruitmentStaffRowPermissions();
  const rows: SeedRow[] = [];

  for (const applicant of APPLICANTS) {
    const email = emailOf(applicant.name);
    const retention = computeRecruitmentRetentionUntil(
      PUBLISHED_DEADLINE,
      new Date(applicant.appliedAt)
    );
    const profile: CandidateProfileInput = {
      applications_count: 1,
      campus_id: CAMPUS_ID,
      consent_date: applicant.appliedAt,
      current_employer: null,
      current_role: applicant.currentRole,
      data_retention_until: retention,
      email,
      embedding_id: null,
      embedding_status: CandidateProfilesEmbeddingStatus.PENDING,
      full_name: applicant.name,
      gdpr_consent: true,
      last_application_at: applicant.appliedAt,
      linkedin_url: null,
      notes: null,
      phone: null,
      source: applicant.source,
      tags: null,
    };
    rows.push(row("candidate_profiles", profileId(applicant), profile, staff));
  }

  for (const applicant of APPLICANTS) {
    const screening = applicant.screening
      ? aiScreening(
          applicant.screening,
          new Date(Date.parse(applicant.appliedAt) + HOUR_MS).toISOString()
        )
      : null;
    const application: ApplicationInput = {
      $createdAt: applicant.appliedAt,
      $updatedAt: applicant.reviewedAt ?? applicant.appliedAt,
      ai_screening: screening ? JSON.stringify(screening) : null,
      applicant_email: emailOf(applicant.name),
      applicant_name: applicant.name,
      applicant_phone: null,
      candidate_profile: profileId(applicant),
      candidate_profile_id: profileId(applicant),
      consent_date: applicant.appliedAt,
      cover_letter: applicant.coverLetter,
      cover_letter_file_id: null,
      data_processing_purpose: "BISO recruitment process",
      data_retention_until: computeRecruitmentRetentionUntil(
        PUBLISHED_DEADLINE,
        new Date(applicant.appliedAt)
      ),
      embedding_status: JobApplicationsEmbeddingStatus.PENDING,
      gdpr_consent: true,
      job: PUBLISHED_JOB_ID,
      job_id: PUBLISHED_JOB_ID,
      resume_file_id: null,
      review_metadata: JSON.stringify(reviewMetadata(applicant)),
      screening_score: screening?.normalized_score ?? null,
      source: applicant.source,
      status: applicant.status,
    };
    rows.push(
      row("job_applications", applicationId(applicant), application, staff)
    );
  }

  for (const applicant of APPLICANTS) {
    const answers: [string, JobApplicationAnswersAnswerType, string][] = [
      ["hours", JobApplicationAnswersAnswerType.SELECT, applicant.answerHours],
      [
        "motivation",
        JobApplicationAnswersAnswerType.LONG_TEXT,
        applicant.answerMotivation,
      ],
    ];
    for (const [questionId, answerType, answer] of answers) {
      const question = QUESTIONS.find((entry) => entry.id === questionId);
      const data: AnswerInput = {
        answer,
        answer_type: answerType,
        application: applicationId(applicant),
        application_id: applicationId(applicant),
        job_id: PUBLISHED_JOB_ID,
        question_id: questionId,
        question_label: question?.label ?? questionId,
      };
      rows.push(
        row(
          "job_application_answers",
          `docs-ans-${applicant.key}-${questionId}`,
          data,
          staff
        )
      );
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Interviews: one scheduled (no scorecard yet) and one completed with a
// scorecard. Shaped like createInterview() and submitScorecard() write them.
// ---------------------------------------------------------------------------

interface InterviewPlan {
  applicant: Applicant;
  endsAt: string;
  location: string;
  responseStatus: JobInterviewParticipantsResponseStatus;
  startsAt: string;
  status: JobInterviewsStatus;
}

function interviewRows(): SeedRow[] {
  const staff = buildRecruitmentStaffRowPermissions();
  const plans: InterviewPlan[] = [
    {
      applicant: applicantByKey("jonas"),
      endsAt: at(14, 8, 45),
      location: "Teams",
      responseStatus: JobInterviewParticipantsResponseStatus.PENDING,
      startsAt: at(14, 8),
      status: JobInterviewsStatus.SCHEDULED,
    },
    {
      applicant: applicantByKey("henrik"),
      endsAt: at(9, 7, 45),
      location: "Hybrid",
      responseStatus: JobInterviewParticipantsResponseStatus.ACCEPTED,
      startsAt: at(9, 7),
      status: JobInterviewsStatus.COMPLETED,
    },
  ];
  const panel = [userById(USER.kari), userById(USER.per)];
  const rows: SeedRow[] = [];

  for (const plan of plans) {
    const interviewId = `docs-interview-${plan.applicant.key}-1`;
    const interview: InterviewInput = {
      $createdAt: at(8, 10),
      $updatedAt: at(8, 10),
      application: applicationId(plan.applicant),
      application_id: applicationId(plan.applicant),
      campus_id: CAMPUS_ID,
      cancelled_reason: null,
      created_by_user_id: USER.kari,
      department_id: EVENTS_DEPARTMENT_ID,
      ends_at: plan.endsAt,
      job_id: PUBLISHED_JOB_ID,
      location: plan.location,
      meeting_url: null,
      notes: null,
      outlook_event_id: null,
      round: 1,
      starts_at: plan.startsAt,
      status: plan.status,
      teams_meeting_id: null,
      timezone: "Europe/Oslo",
      title: `${plan.applicant.name} — Round 1`,
    };
    rows.push(row("job_interviews", interviewId, interview, staff));

    const candidate: ParticipantInput = {
      display_name: plan.applicant.name,
      email: emailOf(plan.applicant.name),
      interview: interviewId,
      interview_id: interviewId,
      is_lead: false,
      response_status: plan.responseStatus,
      role: JobInterviewParticipantsRole.CANDIDATE,
      user_id: null,
    };
    rows.push(
      row(
        "job_interview_participants",
        `docs-part-${plan.applicant.key}-1-cand`,
        candidate,
        staff
      )
    );
    for (const [index, member] of panel.entries()) {
      const participant: ParticipantInput = {
        display_name: member.name,
        email: member.email,
        interview: interviewId,
        interview_id: interviewId,
        is_lead: index === 0,
        response_status: plan.responseStatus,
        role: JobInterviewParticipantsRole.INTERVIEWER,
        user_id: member.id,
      };
      rows.push(
        row(
          "job_interview_participants",
          `docs-part-${plan.applicant.key}-1-${member.id.replace("docs-user-", "")}`,
          participant,
          staff
        )
      );
    }
  }

  const criteria: RecruitmentScorecardCriterion[] = [
    { comment: null, key: "communication", label: "Communication", score: 5 },
    { comment: null, key: "skills", label: "Relevant skills", score: 4 },
    { comment: null, key: "culture", label: "Culture add", score: 4 },
    { comment: null, key: "initiative", label: "Initiative", score: 5 },
    {
      comment: null,
      key: "problemSolving",
      label: "Problem-solving",
      score: 4,
    },
  ];
  const henrik = applicantByKey("henrik");
  // submitScorecard() writes interview_id but not the `interview` link, so the
  // seed leaves the link out too.
  const scorecard: ScorecardInput = {
    application_id: applicationId(henrik),
    concerns: "Has not managed volunteers on his own before.",
    criteria: JSON.stringify(criteria),
    interview_id: `docs-interview-${henrik.key}-1`,
    interviewer_user_id: USER.kari,
    overall_score: 4,
    private_notes: null,
    recommendation: JobInterviewScorecardsRecommendation.HIRE,
    strengths:
      "A clear plan for the spring evenings and good questions about the budget.",
    submitted_at: at(9, 10),
  };
  rows.push(
    row(
      "job_interview_scorecards",
      "docs-scorecard-henrik-kari",
      scorecard,
      staff
    )
  );

  return rows;
}

// ---------------------------------------------------------------------------
// Campus, departments and tour progress
// ---------------------------------------------------------------------------

function organisationRows(): SeedRow[] {
  const campus: CampusInput = { email: null, name: "Oslo" };
  const hr: DepartmentInput = {
    Id: "DEMO-HR",
    Name: "HR",
    abbreviation: "HR",
    active: true,
    campus_id: CAMPUS_ID,
  };
  const events: DepartmentInput = {
    Id: "DEMO-EVT",
    Name: "Demo Events",
    abbreviation: "DE",
    active: true,
    campus_id: CAMPUS_ID,
  };
  return [
    row("campus", CAMPUS_ID, campus, []),
    row("departments", HR_DEPARTMENT_ID, hr, []),
    row("departments", EVENTS_DEPARTMENT_ID, events, []),
  ];
}

/**
 * Marks the recruitment tour as dismissed for every seeded user, so it
 * doesn't open over the screens. Owner-only permissions, like
 * `saveTourProgress()` in the admin.
 */
function tourRows(): SeedRow[] {
  return USERS.map((user) => {
    const data: TourProgressInput = {
      completed_at: null,
      status: TourProgressStatus.DISMISSED,
      step_index: 0,
      tour_id: TOUR_ID,
      user_id: user.id,
      version: TOUR_VERSION,
    };
    return row(
      "tour_progress",
      `docs-tour-${user.id.replace("docs-user-", "")}`,
      data,
      [
        Permission.read(Role.user(user.id)),
        Permission.update(Role.user(user.id)),
        Permission.delete(Role.user(user.id)),
      ]
    );
  });
}

export function buildSeedData(): SeedData {
  return {
    baseDate: BASE_DATE,
    databaseId: DATABASE_ID,
    rows: [
      ...organisationRows(),
      ...vacancies(),
      ...applicantRows(),
      ...interviewRows(),
      ...tourRows(),
    ],
    sessionUsers: {
      department: USER.lars,
      globaladmin: USER.ingrid,
      hr: USER.kari,
    },
    teams: TEAMS.map((team) => ({ ...team })),
    users: USERS.map((user) => ({ ...user, teamIds: [...user.teamIds] })),
  };
}
