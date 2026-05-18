// Seed data — campuses, departments, sample jobs reflecting the schema.

const CAMPUSES = [
  { id: "oslo",  name: "BI Oslo",       short: "OSL", color: "#6b1e1e" },
  { id: "bgn",   name: "BI Bergen",     short: "BGN", color: "#2a4a7a" },
  { id: "trd",   name: "BI Trondheim",  short: "TRD", color: "#2f5d3a" },
  { id: "stv",   name: "BI Stavanger",  short: "STV", color: "#b08a3e" },
];

const DEPARTMENTS = [
  { id: "marketing",  name: "Marketing",            campus: "oslo", crest: "M" },
  { id: "career",     name: "Career Services",      campus: "oslo", crest: "C" },
  { id: "consulting", name: "BI Consulting",        campus: "oslo", crest: "B" },
  { id: "esn",        name: "Erasmus Student Network", campus: "oslo", crest: "E" },
  { id: "finance",    name: "Finance Society",      campus: "oslo", crest: "F" },
  { id: "sustain",    name: "Sustainability",       campus: "oslo", crest: "S" },
  { id: "tech",       name: "BISO Tech",            campus: "oslo", crest: "T" },
  { id: "media",      name: "BISO Media",           campus: "oslo", crest: "M" },
];

// Sample jobs that exist in the dashboard
const SAMPLE_JOBS = [
  {
    id: "j1", slug: "marketing-coordinator-spring-26",
    titleNo: "Markedskoordinator – Vår 2026",
    titleEn: "Marketing Coordinator – Spring 2026",
    department: "marketing", campus: "oslo",
    status: "published",
    deadline: "2026-06-02",
    applications: 47, views: 1284,
    publishedAt: "2026-05-04",
    summary: "Drive campaigns across BISO Oslo's social channels and on-campus activations.",
    commitment: "10 h/week · 1 year",
    isMember: true,
  },
  {
    id: "j2", slug: "head-of-finance-25-26",
    titleNo: "Økonomiansvarlig",
    titleEn: "Head of Finance",
    department: "finance", campus: "oslo",
    status: "published",
    deadline: "2026-05-29",
    applications: 19, views: 612,
    publishedAt: "2026-04-28",
    summary: "Oversee budget, reimbursement flow and quarterly reporting for the unit.",
    commitment: "8 h/week · 1 year",
    isMember: true,
  },
  {
    id: "j3", slug: "esn-buddy-coordinator",
    titleNo: "Buddy-koordinator",
    titleEn: "Buddy Coordinator",
    department: "esn", campus: "oslo",
    status: "draft",
    deadline: "",
    applications: 0, views: 0,
    publishedAt: null,
    summary: "Match international students with local buddies through orientation week.",
    commitment: "6 h/week · 1 semester",
    isMember: false,
  },
  {
    id: "j4", slug: "bi-consulting-analyst",
    titleNo: "Junior Analyst",
    titleEn: "Junior Consulting Analyst",
    department: "consulting", campus: "oslo",
    status: "published",
    deadline: "2026-05-22",
    applications: 134, views: 3201,
    publishedAt: "2026-04-18",
    summary: "Work on real client cases with senior BI alumni mentors.",
    commitment: "12 h/week · 1 year",
    isMember: true,
  },
  {
    id: "j5", slug: "sustainability-lead",
    titleNo: "Bærekraftsansvarlig",
    titleEn: "Sustainability Lead",
    department: "sustain", campus: "oslo",
    status: "closed",
    deadline: "2026-03-14",
    applications: 28, views: 740,
    publishedAt: "2026-02-20",
    summary: "Set the unit's annual sustainability roadmap and run quarterly audits.",
    commitment: "6 h/week · 1 year",
    isMember: true,
  },
  {
    id: "j6", slug: "media-photographer",
    titleNo: "Fotograf",
    titleEn: "Event Photographer",
    department: "media", campus: "oslo",
    status: "draft",
    deadline: "",
    applications: 0, views: 0,
    publishedAt: null,
    summary: "",
    commitment: "Flexible · per event",
    isMember: false,
  },
];

// The job we'll be composing in the editor (Buddy Coordinator – draft j3)
const DRAFT_DEFAULT = {
  id: "j3",
  status: "draft",
  campus: "oslo",
  department: "esn",
  slug: "esn-buddy-coordinator",
  titleNo: "Buddy-koordinator",
  titleEn: "Buddy Coordinator",
  shortEn: "Match international students with local buddies and run the welcome week alongside the ESN board.",
  shortNo: "Match internasjonale studenter med lokale buddyer og kjør velkomstuken sammen med ESN-styret.",
  descEn: [
    { type: "h", text: "About the role" },
    { type: "p", text: "Each semester, hundreds of exchange students arrive at BI Oslo with two questions on their mind: where do I live, and who do I talk to. As Buddy Coordinator you answer the second one — at scale." },
    { type: "p", text: "You'll pair every incoming student with a Norwegian buddy, run two orientation weekends, and keep a Slack of 400+ buddies alive through the semester. You report directly to the ESN Vice President." },
    { type: "h", text: "What you'll own" },
    { type: "l", items: [
      "Matching logic and pairing rounds (we use a small internal tool, no coding needed)",
      "Welcome-week schedule and the buddy-handbook refresh each August and January",
      "Weekly check-ins with section leads",
      "Conflict resolution when pairings don't click",
    ]},
    { type: "h", text: "We're looking for" },
    { type: "l", items: [
      "Someone organised — Notion, calendars, the works",
      "Comfortable speaking in front of a 200-person auditorium",
      "Norwegian and English, fluent",
      "Open to staying on through both Fall '26 and Spring '27 semesters",
    ]},
  ],
  commitment: "6 h/week",
  term: "1 semester",
  startDate: "2026-08-15",
  deadline: "2026-06-10",
  location: "BI Oslo · Nydalen campus",
  isMemberOnly: true,
  isPaid: false,
  contactName: "Kari Berg",
  contactRole: "ESN Vice President",
  contactEmail: "esn-vp@biso.no",
  tags: ["Volunteer", "Leadership", "International"],
  coverPattern: 1,
};

window.CAMPUSES = CAMPUSES;
window.DEPARTMENTS = DEPARTMENTS;
window.SAMPLE_JOBS = SAMPLE_JOBS;
window.DRAFT_DEFAULT = DRAFT_DEFAULT;

// Helpers
window.dept = (id) => DEPARTMENTS.find(d => d.id === id);
window.campus = (id) => CAMPUSES.find(c => c.id === id);
window.fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
window.daysLeft = (iso) => {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const now = new Date("2026-05-13").getTime();
  return Math.round((d - now) / 86400000);
};
