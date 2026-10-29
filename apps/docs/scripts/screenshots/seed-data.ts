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
  type Announcements,
  AnnouncementsAudienceType,
  AnnouncementsSource,
  AnnouncementsStatus,
  type BenefitCodes,
  type BenefitPartners,
  type Campus,
  type CampusBenefits,
  CampusBenefitsKind,
  CampusBenefitsRedemptionType,
  CampusBenefitsSection,
  CampusBenefitsStatus,
  type CandidateProfiles,
  CandidateProfilesEmbeddingStatus,
  type ContentTranslations,
  ContentTranslationsContentType,
  ContentTranslationsLocale,
  type Departments,
  type Events,
  EventsCategory,
  EventsCoverPattern,
  EventsLocationMode,
  EventsPricingMode,
  EventsPublishMode,
  EventsStatus,
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
  type MemberRoster,
  type News,
  NewsStatus,
  type OrderItems,
  type OrderRefunds,
  OrderRefundsCurrency,
  OrderRefundsProvider,
  OrderRefundsStatus,
  type Orders,
  OrdersCurrency,
  OrdersStatus,
  type Pages,
  PagesStatus,
  PagesVisibility,
  type PageTranslations,
  PageTranslationsLocale,
  type TourProgress,
  TourProgressStatus,
  type Users,
  UsersLocale,
  type VarslingSettings,
  type WebshopProducts,
  WebshopProductsCoverPattern,
  WebshopProductsInventoryMode,
  WebshopProductsStatus,
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

export type StaffRole =
  | "hr"
  | "globaladmin"
  | "department"
  | "campusadmin"
  | "benefitseditor";

export type SeedTableId =
  | "campus"
  | "departments"
  | "user"
  | "pages"
  | "news"
  | "events"
  | "event_rsvps"
  | "webshop_products"
  | "orders"
  | "order_items"
  | "order_refunds"
  | "member_roster"
  | "benefit_partners"
  | "campus_benefits"
  | "benefit_codes"
  | "announcements"
  | "varsling_settings"
  | "jobs"
  | "candidate_profiles"
  | "job_applications"
  | "job_application_answers"
  | "job_interviews"
  | "job_interview_participants"
  | "job_interview_scorecards"
  | "tour_progress"
  | "m365_team_sync";

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
> &
  Partial<Pick<Columns<Departments>, "slug" | "type">>;
/** The columns the schema requires, and any others the screen shows. */
type Fill<T, Required extends keyof Columns<T>> = Pick<Columns<T>, Required> &
  Partial<Omit<Columns<T>, Required>>;
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
  ledelsenOslo: "sg-app-dept-ledelsenoslo",
  national: "sg-app-campus-national",
  operations: "sg-app-dept-operationsunit",
  oslo: "sg-app-campus-oslo",
} as const;

const USER = {
  anders: "docs-user-anders",
  ingrid: "docs-user-ingrid",
  kari: "docs-user-kari",
  lars: "docs-user-lars",
  marit: "docs-user-marit",
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
 * The admin's role logic reads exact team ids (`rolesFromTeams()`); a
 * department's name only counts when it matches its id, so each name below is
 * the id's name ("HR" for `sg-app-dept-hr`). A team also counts only when its
 * id is in the user's `m365_team_sync` row, which `syncRows()` seeds. The
 * made-up unit is the "Demo Events" department.
 */
const TEAMS: SeedTeam[] = [
  { id: TEAM.oslo, name: "Oslo" },
  { id: TEAM.national, name: "National" },
  { id: TEAM.hr, name: "HR" },
  { id: TEAM.operations, name: "Operations Unit" },
  { id: TEAM.demoEvents, name: "Demo Events" },
  { id: TEAM.ledelsenOslo, name: "Ledelsen Oslo" },
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
  {
    // roles.ts: the campus team plus the Ledelsen team of the same city.
    email: "marit.dahl@example.org",
    id: USER.marit,
    name: "Marit Dahl",
    role: "campusadmin",
    teamIds: [TEAM.oslo, TEAM.ledelsenOslo],
  },
  {
    // Marked as the benefits editor, but has no role in the docs project:
    // the admin gives that role only to a Microsoft sign-in listed in
    // BENEFITS_EDITOR_EMAILS, which a seeded user can't have (README.md).
    email: "anders.moen@example.org",
    id: USER.anders,
    name: "Anders Moen",
    role: "benefitseditor",
    teamIds: [TEAM.oslo],
  },
];

/**
 * One `m365_team_sync` row per staff user, keyed by the user id like the
 * admin's reader (`loadSyncedTeamIds()`). Without it the admin drops every
 * `sg-app-*` team and the user has no role. The table has no permissions: only
 * the service key reads it.
 */
function syncRows(): SeedRow[] {
  return USERS.map((user) =>
    row(
      "m365_team_sync",
      user.id,
      { synced_at: BASE_DATE, team_ids: [...user.teamIds] },
      []
    )
  );
}

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
    // The address of the department's own page: units/oslo/demo-events.
    slug: "demo-events",
    type: "society",
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

// ---------------------------------------------------------------------------
// The rest of the guide: pages, news, events, the shop, members, benefits,
// communications and the settings screens. Same made-up Oslo and "Demo
// Events" as above; every person is invented and every address is example.org.
// ---------------------------------------------------------------------------

export const PUBLISHED_PAGE_ID = "docs-page-volunteer-guide";
export const DRAFT_PAGE_ID = "docs-page-spring-social";
export const PUBLISHED_NEWS_ID = "docs-news-welcome-week";
export const DRAFT_NEWS_ID = "docs-news-quiz-recap";
export const OPEN_EVENT_ID = "docs-event-spring-quiz";
export const MEMBERS_EVENT_ID = "docs-event-members-night";
export const PUBLISHED_PRODUCT_ID = "docs-product-tote-bag";
export const DRAFT_PRODUCT_ID = "docs-product-hoodie";
export const PAID_ORDER_ID = "docs-order-paid";
export const REFUNDED_ORDER_ID = "docs-order-refunded";
/** The department whose own page the department shots open. */
export const DEMO_EVENTS_DEPARTMENT_ID = EVENTS_DEPARTMENT_ID;

const BENEFIT_ID = "docs-benefit-demo-cafe";
const PARTNER_ID = "docs-partner-demo-cafe";
/** An invented code. It lives only in `benefit_codes`, never on the public row. */
const BENEFIT_CODE = "DEMO10";
const ANNOUNCEMENT_ID = "docs-announcement-welcome";
const MEMBERSHIP_ID = "docs-membership-student";
const ROSTER_SYNC_RUN_ID = "docs-sync-run-1";

/** People who are members: on the roster, and the three RSVPs. */
const MEMBERS = [
  {
    companyId: 900_001,
    email: "nora.vik@example.org",
    key: "nora",
    name: "Nora Vik",
  },
  {
    companyId: 900_002,
    email: "henrik.moe@example.org",
    key: "henrik",
    name: "Henrik Moe",
  },
  {
    companyId: 900_003,
    email: "silje.aas@example.org",
    key: "silje",
    name: "Silje Aas",
  },
] as const;

const memberProfileId = (key: string) => `docs-member-${key}`;

/** Published content is public; a draft is left to the admin's service key. */
function contentPermissions(status: string): string[] {
  return status === "published" ? [Permission.read(Role.any())] : [];
}

function stamps(createdDay: number, updatedDay = createdDay): Timestamps {
  return { $createdAt: at(createdDay, 9), $updatedAt: at(updatedDay, 10) };
}

interface LocaleText {
  description: string;
  short?: string;
  title: string;
}

/** Both languages of one piece of content, as the admin writes them. */
function bothLanguages(input: {
  additionalFields?: (text: LocaleText) => Record<string, unknown>;
  contentId: string;
  contentType: ContentTranslationsContentType;
  en: LocaleText;
  no: LocaleText;
  permissions: string[];
}): TranslationInput[] {
  const translation = (
    locale: ContentTranslationsLocale,
    text: LocaleText
  ): TranslationInput => ({
    $id: `docs-tr-${input.contentId}-${locale}`,
    $permissions: input.permissions,
    additional_fields: input.additionalFields
      ? JSON.stringify(input.additionalFields(text))
      : null,
    content_id: input.contentId,
    content_type: input.contentType,
    description: text.description,
    locale,
    short_description: text.short ?? null,
    title: text.title,
  });
  return [
    translation(ContentTranslationsLocale.NO, input.no),
    translation(ContentTranslationsLocale.EN, input.en),
  ];
}

/**
 * Ownership as the admin writes it: relationship ids plus the scalar copies
 * (`department_id`, on the tables that have one; the legacy `departmentId` on
 * products holds four characters, so the seed leaves it out).
 */
interface OwnedBy {
  campus: string;
  campus_id: string;
  department: string | null;
}
interface OwnedByWithScalar extends OwnedBy {
  department_id: string | null;
}
const ownedByDemoEvents = (): OwnedBy => ({
  campus: CAMPUS_ID,
  campus_id: CAMPUS_ID,
  department: EVENTS_DEPARTMENT_ID,
});
const ownedByDemoEventsWithScalar = (): OwnedByWithScalar => ({
  ...ownedByDemoEvents(),
  department_id: EVENTS_DEPARTMENT_ID,
});

type WithTranslations<T> = T & { translation_refs: TranslationInput[] };

/** The people the members-only event's RSVPs are looked up from. */
function profileRows(): SeedRow[] {
  return MEMBERS.map((member) => {
    const data: Fill<Users, never> = {
      campus_id: CAMPUS_ID,
      email: member.email,
      isActive: true,
      locale: UsersLocale.EN,
      name: member.name,
    };
    return row("user", memberProfileId(member.key), data, []);
  });
}

// --- Pages -----------------------------------------------------------------

interface PageText {
  description: string;
  lede: string;
  title: string;
}

/** A page in the editor's document format (`PageDoc`, version 2). */
function pageDocument(
  text: PageText,
  slug: string,
  status: "draft" | "published"
): string {
  return JSON.stringify({
    header: {
      buttons: [],
      crumbs: [],
      eyebrow: "Demo Events",
      lede: text.lede,
      title: text.title,
      variant: "plain",
    },
    meta: {
      campus: CAMPUS_ID,
      department: EVENTS_DEPARTMENT_ID,
      description: text.description,
      slug,
      status,
      title: text.title,
    },
    sections: [],
    version: 2,
  });
}

type PageTranslationInput = Fill<PageTranslations, "page_id" | "title"> & {
  $id: string;
  $permissions: string[];
};

function pageRow(input: {
  day: number;
  id: string;
  slug: string;
  status: PagesStatus.DRAFT | PagesStatus.PUBLISHED;
  text: Record<"en" | "no", PageText>;
}): SeedRow {
  const published = input.status === PagesStatus.PUBLISHED;
  const permissions = contentPermissions(input.status);
  const translation = (
    locale: PageTranslationsLocale,
    text: PageText
  ): PageTranslationInput => {
    const document = pageDocument(text, input.slug, input.status);
    return {
      $id: `docs-tr-${input.id}-${locale}`,
      $permissions: permissions,
      description: text.description,
      draft_doc: document,
      is_published: published,
      locale,
      page_id: input.id,
      published_at: published ? at(input.day, 10) : null,
      published_doc: published ? document : null,
      title: text.title,
    };
  };
  const data: Fill<Pages, never> &
    Timestamps &
    OwnedByWithScalar & { translation_refs: PageTranslationInput[] } = {
    ...stamps(input.day, input.day + 1),
    ...ownedByDemoEventsWithScalar(),
    slug: input.slug,
    status: input.status,
    translation_refs: [
      translation(PageTranslationsLocale.NO, input.text.no),
      translation(PageTranslationsLocale.EN, input.text.en),
    ],
    visibility: PagesVisibility.PUBLIC,
  };
  return row("pages", input.id, data, permissions);
}

function pageRows(): SeedRow[] {
  return [
    pageRow({
      day: 3,
      id: PUBLISHED_PAGE_ID,
      slug: "volunteer-guide",
      status: PagesStatus.PUBLISHED,
      text: {
        en: {
          description: "How Demo Events volunteers plan an evening.",
          lede: "Everything a new volunteer needs for the first month.",
          title: "Volunteer guide",
        },
        no: {
          description: "Slik planlegger frivillige i Demo Events en kveld.",
          lede: "Alt en ny frivillig trenger den første måneden.",
          title: "Veiledning for frivillige",
        },
      },
    }),
    pageRow({
      day: 6,
      id: DRAFT_PAGE_ID,
      slug: "spring-social",
      status: PagesStatus.DRAFT,
      text: {
        en: {
          description: "A draft for the spring social.",
          lede: "Dates and tickets to come.",
          title: "Spring social",
        },
        no: {
          description: "Et utkast til vårfesten.",
          lede: "Datoer og billetter kommer.",
          title: "Vårfest",
        },
      },
    }),
  ];
}

// --- News ------------------------------------------------------------------

const NEWS_AUTHOR = "Kari Nordmann";

function newsRow(input: {
  day: number;
  id: string;
  slug: string;
  status: NewsStatus.DRAFT | NewsStatus.PUBLISHED;
  text: Record<"en" | "no", LocaleText>;
}): SeedRow {
  const permissions = contentPermissions(input.status);
  const data: WithTranslations<
    Fill<News, "campus_id" | "status"> & Timestamps & OwnedByWithScalar
  > = {
    ...stamps(input.day, input.day + 1),
    ...ownedByDemoEventsWithScalar(),
    author: NEWS_AUTHOR,
    notify_push: false,
    slug: input.slug,
    status: input.status,
    sticky: false,
    translation_refs: bothLanguages({
      additionalFields: () => ({ author: NEWS_AUTHOR, category: "general" }),
      contentId: input.id,
      contentType: ContentTranslationsContentType.NEWS,
      en: input.text.en,
      no: input.text.no,
      permissions,
    }),
  };
  return row("news", input.id, data, permissions);
}

function newsRows(): SeedRow[] {
  return [
    newsRow({
      day: 8,
      id: PUBLISHED_NEWS_ID,
      slug: "welcome-week",
      status: NewsStatus.PUBLISHED,
      text: {
        en: {
          description:
            "<p>Welcome week starts on Monday. Come by the Demo Events stand.</p>",
          title: "Welcome week starts Monday",
        },
        no: {
          description:
            "<p>Fadderuken starter på mandag. Kom innom standen til Demo Events.</p>",
          title: "Fadderuken starter mandag",
        },
      },
    }),
    newsRow({
      day: 12,
      id: DRAFT_NEWS_ID,
      slug: "quiz-recap",
      status: NewsStatus.DRAFT,
      text: {
        en: {
          description:
            "<p>A recap of the spring quiz, still being written.</p>",
          title: "Spring quiz recap",
        },
        no: {
          description: "<p>Oppsummering av vårquizen, under arbeid.</p>",
          title: "Oppsummering av vårquizen",
        },
      },
    }),
  ];
}

// --- Events ----------------------------------------------------------------

function eventRow(input: {
  day: number;
  id: string;
  memberOnly: boolean;
  slug: string;
  startDay: number;
  text: Record<"en" | "no", LocaleText>;
}): SeedRow {
  const permissions = contentPermissions(EventsStatus.PUBLISHED);
  const data: WithTranslations<
    Fill<Events, "campus_id" | "status"> & Timestamps & OwnedByWithScalar
  > = {
    ...stamps(input.day, input.day + 1),
    ...ownedByDemoEventsWithScalar(),
    capacity: 80,
    category: EventsCategory.SOCIAL,
    contact_email: "kari.nordmann@example.org",
    contact_name: "Kari Nordmann",
    contact_role: "Demo Events, Oslo",
    cover_pattern: EventsCoverPattern.DOTTED,
    end_date: at(input.startDay, 21),
    location: "Demo Hall, Oslo",
    location_mode: EventsLocationMode.PHYSICAL,
    member_only: input.memberOnly,
    notify_push: false,
    pricing_mode: EventsPricingMode.FREE,
    publish_mode: EventsPublishMode.NOW,
    registration_deadline: at(input.startDay - 1, 12),
    slug: input.slug,
    start_date: at(input.startDay, 18),
    status: EventsStatus.PUBLISHED,
    tags: ["Social"],
    translation_refs: bothLanguages({
      additionalFields: (text) => ({ short_description: text.short ?? null }),
      contentId: input.id,
      contentType: ContentTranslationsContentType.EVENT,
      en: input.text.en,
      no: input.text.no,
      permissions,
    }),
    waitlist: false,
  };
  return row("events", input.id, data, permissions);
}

/** `event_rsvps` has no generated type; the columns are in appwrite.config.json. */
interface EventRsvpInput {
  event_id: string;
  status: "going" | "maybe" | "not_going";
  user_id: string;
}

function rsvpRows(): SeedRow[] {
  return MEMBERS.map((member, index) => {
    const data: EventRsvpInput = {
      event_id: MEMBERS_EVENT_ID,
      status: index === MEMBERS.length - 1 ? "maybe" : "going",
      user_id: memberProfileId(member.key),
    };
    return row("event_rsvps", `docs-rsvp-${member.key}`, data, [
      Permission.read(Role.user(memberProfileId(member.key))),
    ]);
  });
}

function eventRows(): SeedRow[] {
  return [
    eventRow({
      day: 15,
      id: OPEN_EVENT_ID,
      memberOnly: false,
      slug: "spring-quiz",
      startDay: 120,
      text: {
        en: {
          description: "<p>A pub quiz for everyone. Teams of four.</p>",
          short: "A pub quiz for everyone.",
          title: "Spring quiz",
        },
        no: {
          description: "<p>En pubquiz for alle. Lag på fire.</p>",
          short: "En pubquiz for alle.",
          title: "Vårquiz",
        },
      },
    }),
    eventRow({
      day: 16,
      id: MEMBERS_EVENT_ID,
      memberOnly: true,
      slug: "members-night",
      startDay: 135,
      text: {
        en: {
          description: "<p>An evening for members only, with food.</p>",
          short: "An evening for members only.",
          title: "Members' night",
        },
        no: {
          description: "<p>En kveld bare for medlemmer, med mat.</p>",
          short: "En kveld bare for medlemmer.",
          title: "Medlemskveld",
        },
      },
    }),
    ...rsvpRows(),
  ];
}

// --- Shop ------------------------------------------------------------------

function productRow(input: {
  day: number;
  id: string;
  memberPrice: number;
  price: number;
  slug: string;
  status: WebshopProductsStatus.DRAFT | WebshopProductsStatus.PUBLISHED;
  stock: number;
  text: Record<"en" | "no", LocaleText>;
}): SeedRow {
  const permissions = contentPermissions(input.status);
  const data: WithTranslations<
    Fill<WebshopProducts, "campus_id" | "regular_price" | "slug" | "status"> &
      Timestamps &
      OwnedBy
  > = {
    ...stamps(input.day, input.day + 1),
    ...ownedByDemoEvents(),
    category: "Merch",
    cover_pattern: WebshopProductsCoverPattern.DOTTED,
    inventory_mode: WebshopProductsInventoryMode.TRACKED,
    member_only: false,
    member_price: input.memberPrice,
    regular_price: input.price,
    slug: input.slug,
    status: input.status,
    stock: input.stock,
    translation_refs: bothLanguages({
      contentId: input.id,
      contentType: ContentTranslationsContentType.PRODUCT,
      en: input.text.en,
      no: input.text.no,
      permissions,
    }),
    unlisted: false,
  };
  return row("webshop_products", input.id, data, permissions);
}

function shopRows(): SeedRow[] {
  return [
    productRow({
      day: 20,
      id: PUBLISHED_PRODUCT_ID,
      memberPrice: 90,
      price: 120,
      slug: "tote-bag",
      status: WebshopProductsStatus.PUBLISHED,
      stock: 40,
      text: {
        en: {
          description: "A canvas tote bag with the Demo Events logo.",
          short: "Canvas tote bag.",
          title: "Tote bag",
        },
        no: {
          description: "En handlenett i bomull med logoen til Demo Events.",
          short: "Handlenett i bomull.",
          title: "Handlenett",
        },
      },
    }),
    productRow({
      day: 22,
      id: DRAFT_PRODUCT_ID,
      memberPrice: 350,
      price: 450,
      slug: "hoodie",
      status: WebshopProductsStatus.DRAFT,
      stock: 25,
      text: {
        en: {
          description: "A navy hoodie with the Demo Events logo.",
          short: "Navy hoodie.",
          title: "Hoodie",
        },
        no: {
          description: "En marineblå hettegenser med logoen til Demo Events.",
          short: "Marineblå hettegenser.",
          title: "Hettegenser",
        },
      },
    }),
  ];
}

interface OrderSeed {
  buyerEmail: string;
  buyerName: string;
  day: number;
  id: string;
  quantity: number;
  status: OrdersStatus.PAID | OrdersStatus.REFUNDED;
}

const TOTE_BAG_PRICE = 120;

function orderRowsFor(order: OrderSeed): SeedRow[] {
  const total = TOTE_BAG_PRICE * order.quantity;
  const refunded = order.status === OrdersStatus.REFUNDED;
  const orderData: Fill<Orders, "currency" | "subtotal" | "total"> &
    Timestamps = {
    ...stamps(order.day),
    buyer_email: order.buyerEmail,
    buyer_name: order.buyerName,
    campus_id: CAMPUS_ID,
    currency: OrdersCurrency.NOK,
    discount_total: 0,
    membership_applied: false,
    payment_provider: "vipps",
    refunded_at: refunded ? at(order.day + 2, 14) : null,
    refunded_total: refunded ? total : 0,
    status: order.status,
    subtotal: total,
    total,
  };
  const itemData: Fill<OrderItems, never> & { order: string; product: string } =
    {
      line_total: total,
      name: "Tote bag",
      order: order.id,
      product: PUBLISHED_PRODUCT_ID,
      product_type: "product",
      quantity: order.quantity,
      unit_price: TOTE_BAG_PRICE,
    };
  const rows = [
    row("orders", order.id, orderData, []),
    row("order_items", `${order.id}-item`, itemData, []),
  ];
  if (refunded) {
    const refund: Fill<OrderRefunds, "amount"> & { order: string } = {
      amount: total,
      created_by: USER.ingrid,
      created_by_name: "Ingrid Berg",
      currency: OrderRefundsCurrency.NOK,
      order: order.id,
      provider: OrderRefundsProvider.VIPPS,
      reason: "Bought the wrong size",
      restock: true,
      status: OrderRefundsStatus.SUCCEEDED,
    };
    rows.push(row("order_refunds", `${order.id}-refund`, refund, []));
  }
  return rows;
}

function orderRows(): SeedRow[] {
  return [
    ...orderRowsFor({
      buyerEmail: "mari.solberg@example.org",
      buyerName: "Mari Solberg",
      day: 30,
      id: PAID_ORDER_ID,
      quantity: 2,
      status: OrdersStatus.PAID,
    }),
    ...orderRowsFor({
      buyerEmail: "tobias.lund@example.org",
      buyerName: "Tobias Lund",
      day: 31,
      id: REFUNDED_ORDER_ID,
      quantity: 1,
      status: OrdersStatus.REFUNDED,
    }),
  ];
}

// --- Members and benefits --------------------------------------------------

type RosterInput = Fill<
  MemberRoster,
  | "company_id"
  | "expiry_date"
  | "membership_id"
  | "membership_name"
  | "name"
  | "sync_run_id"
>;

function rosterRows(): SeedRow[] {
  return MEMBERS.map((member, index) => {
    const data: RosterInput = {
      campus_id: CAMPUS_ID,
      company_id: member.companyId,
      email: member.email,
      expiry_date: `2027-0${index + 6}-30`,
      invoiced_at: at(2),
      membership_id: MEMBERSHIP_ID,
      membership_name: "Demo student membership",
      name: member.name,
      sync_run_id: ROSTER_SYNC_RUN_ID,
    };
    return row("member_roster", `docs-roster-${member.key}`, data, []);
  });
}

function benefitRows(): SeedRow[] {
  const partner: Fill<BenefitPartners, "name"> = {
    campus_id: CAMPUS_ID,
    description_en: "A coffee shop near campus.",
    description_nb: "En kaffebar i nærheten av campus.",
    is_active: true,
    name: "Demo Cafe",
    website_url: "https://example.org/demo-cafe",
  };
  // The code is not on this row: the admin keeps it in `benefit_codes`,
  // which nobody can read.
  const benefit: Fill<
    CampusBenefits,
    "campus_id" | "status" | "title_en" | "title_nb"
  > &
    OwnedBy = {
    campus: CAMPUS_ID,
    campus_id: CAMPUS_ID,
    department: null,
    description_en: "Ten percent off your coffee. Show the code at the till.",
    description_nb: "Ti prosent rabatt på kaffen. Vis koden i kassen.",
    is_featured: false,
    is_member_only: true,
    kind: CampusBenefitsKind.OFFER,
    partner_id: PARTNER_ID,
    partner_name: "Demo Cafe",
    publish_start: at(5),
    redemption_type: CampusBenefitsRedemptionType.CODE,
    redemption_value: null,
    section: CampusBenefitsSection.MEMBER,
    sort_order: 0,
    status: CampusBenefitsStatus.PUBLISHED,
    teaser_en: "10% off coffee",
    teaser_nb: "10 % rabatt på kaffe",
    title_en: "Ten percent off coffee",
    title_nb: "Ti prosent rabatt på kaffe",
    updated_by: USER.anders,
  };
  const code: Fill<BenefitCodes, "benefit_id" | "value"> = {
    benefit_id: BENEFIT_ID,
    updated_by: USER.anders,
    value: BENEFIT_CODE,
  };
  return [
    row("benefit_partners", PARTNER_ID, partner, [Permission.read(Role.any())]),
    row("campus_benefits", BENEFIT_ID, benefit, [Permission.read(Role.any())]),
    row("benefit_codes", BENEFIT_ID, code, []),
  ];
}

// --- Communications and settings -------------------------------------------

function announcementRows(): SeedRow[] {
  const data: Fill<Announcements, "title_en"> & Timestamps & OwnedBy = {
    ...stamps(25),
    ...ownedByDemoEvents(),
    audience_type: AnnouncementsAudienceType.BROADCAST,
    body_en: "Welcome week starts on Monday. Come by the Demo Events stand.",
    body_no: "Fadderuken starter på mandag. Kom innom standen til Demo Events.",
    category: "general",
    created_by: USER.ingrid,
    push: true,
    sent_at: at(25, 10),
    source: AnnouncementsSource.MANUAL,
    status: AnnouncementsStatus.SENT,
    title_en: "Welcome week starts Monday",
    title_no: "Fadderuken starter mandag",
  };
  return [row("announcements", ANNOUNCEMENT_ID, data, [])];
}

type VarslingInput = Fill<
  VarslingSettings,
  "campus_id" | "email" | "role_name"
>;

function varslingRows(): SeedRow[] {
  const contacts: [string, VarslingInput][] = [
    [
      "docs-varsling-hr",
      {
        campus_id: CAMPUS_ID,
        email: "varsling.hr@example.org",
        is_active: true,
        role_name: "HR lead (demo)",
        sort_order: 1,
      },
    ],
    [
      "docs-varsling-campus",
      {
        campus_id: CAMPUS_ID,
        email: "varsling.campus@example.org",
        is_active: true,
        role_name: "Head of campus (demo)",
        sort_order: 2,
      },
    ],
  ];
  return contacts.map(([id, data]) => row("varsling_settings", id, data, []));
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
      ...profileRows(),
      ...pageRows(),
      ...newsRows(),
      ...eventRows(),
      ...shopRows(),
      ...orderRows(),
      ...rosterRows(),
      ...benefitRows(),
      ...announcementRows(),
      ...varslingRows(),
      ...tourRows(),
      ...syncRows(),
    ],
    sessionUsers: {
      benefitseditor: USER.anders,
      campusadmin: USER.marit,
      department: USER.lars,
      globaladmin: USER.ingrid,
      hr: USER.kari,
    },
    teams: TEAMS.map((team) => ({ ...team })),
    users: USERS.map((user) => ({ ...user, teamIds: [...user.teamIds] })),
  };
}
