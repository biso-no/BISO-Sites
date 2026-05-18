// Seed data for the EVENT editor — mirrors appwrite Events / ContentTranslations / Collection schema.

const EVENT_CATEGORIES = [
  { id: "social",   name: "Social",        crest: "S" },
  { id: "career",   name: "Career",        crest: "C" },
  { id: "workshop", name: "Workshop",      crest: "W" },
  { id: "talk",     name: "Talk & panel",  crest: "T" },
  { id: "party",    name: "Party",         crest: "P" },
  { id: "sport",    name: "Sport",         crest: "Σ" },
  { id: "academic", name: "Academic",      crest: "A" },
  { id: "trip",     name: "Trip",          crest: "→" },
];

// EventStatus enum: DRAFT | PUBLISHED | CANCELLED
const SAMPLE_EVENTS = [
  {
    id: "e1", slug: "career-day-spring-26",
    titleEn: "Career Day — Spring 2026",
    titleNo: "Karrieredag — Vår 2026",
    department: "career", campus: "oslo", category: "career",
    status: "published",
    startDate: "2026-05-22T10:00",
    endDate:   "2026-05-22T17:00",
    location: "BI Oslo · Forum",
    capacity: 800, registered: 612,
    price: 0, memberPrice: 0,
    memberOnly: false,
    isCollection: false,
    image: "p2",
  },
  {
    id: "e2", slug: "consulting-case-night",
    titleEn: "BI Consulting Case Night",
    titleNo: "BI Consulting Case-kveld",
    department: "consulting", campus: "oslo", category: "career",
    status: "published",
    startDate: "2026-05-19T18:00",
    endDate:   "2026-05-19T22:00",
    location: "BI Oslo · Auditorium B2-040",
    capacity: 220, registered: 198,
    price: 0, memberPrice: 0,
    memberOnly: true,
    isCollection: false,
    image: "p1",
  },
  {
    id: "e3", slug: "buddy-speed-dating",
    titleEn: "Buddy Speed Dating",
    titleNo: "Buddy Speed Dating",
    department: "esn", campus: "oslo", category: "social",
    status: "draft",
    startDate: "",
    endDate: "",
    location: "",
    capacity: 0, registered: 0,
    price: 0, memberPrice: 0,
    memberOnly: false,
    isCollection: false,
    image: "p3",
  },
  {
    id: "e4", slug: "sustainability-forum-26",
    titleEn: "Sustainability Forum 2026",
    titleNo: "Bærekraftsforum 2026",
    department: "sustain", campus: "oslo", category: "talk",
    status: "draft",
    startDate: "2026-09-12T13:00",
    endDate:   "2026-09-12T18:30",
    location: "BI Oslo · A-blokka",
    capacity: 320, registered: 0,
    price: 75, memberPrice: 0,
    memberOnly: false,
    isCollection: false,
    image: "p4",
  },
  {
    id: "e5", slug: "finance-trading-game",
    titleEn: "Finance Society Trading Game",
    titleNo: "Finansforeningen tradingkonkurranse",
    department: "finance", campus: "oslo", category: "workshop",
    status: "published",
    startDate: "2026-05-28T17:00",
    endDate:   "2026-05-28T20:00",
    location: "BI Oslo · D2-180",
    capacity: 60, registered: 60,
    price: 0, memberPrice: 0,
    memberOnly: true,
    isCollection: false,
    image: "p5",
  },
  {
    id: "e6", slug: "fadderuke-26",
    titleEn: "Fadderuke 2026 — full week pass",
    titleNo: "Fadderuke 2026 — uketicket",
    department: "esn", campus: "oslo", category: "party",
    status: "published",
    startDate: "2026-08-17T12:00",
    endDate:   "2026-08-22T03:00",
    location: "BI Oslo & Grünerløkka",
    capacity: 1200, registered: 854,
    price: 1490, memberPrice: 990,
    memberOnly: false,
    isCollection: true, collectionPricing: "bundle",
    image: "p1",
  },
  {
    id: "e7", slug: "holiday-mixer",
    titleEn: "Holiday Mixer",
    titleNo: "Julemiks",
    department: "media", campus: "oslo", category: "party",
    status: "cancelled",
    startDate: "2025-12-12T20:00",
    endDate:   "2025-12-13T01:00",
    location: "BI Oslo · Kantina",
    capacity: 400, registered: 311,
    price: 220, memberPrice: 150,
    memberOnly: false,
    isCollection: false,
    image: "p5",
  },
];

// The event being composed (Buddy Speed Dating — draft e3)
const EVENT_DRAFT_DEFAULT = {
  id: "e3",
  status: "draft",
  campus: "oslo",
  department: "esn",
  category: "social",
  slug: "buddy-speed-dating",
  titleEn: "Buddy Speed Dating",
  titleNo: "Buddy Speed Dating",
  shortEn: "Three minutes, six tables, one shot at finding the friend group that gets you through the semester.",
  shortNo: "Tre minutter, seks bord, én sjanse til å finne vennegjengen som tar deg gjennom semesteret.",
  descEn: [
    { type: "h", text: "What's the night" },
    { type: "p", text: "Forty incoming exchange students and forty Oslo locals, all rotating around six themed tables. You sit, you talk, the bell rings, you move. By the time the last bell goes you'll have met more people than you would in a full week of orientation." },
    { type: "p", text: "Each table has a different prompt — \"the best place you've travelled\", \"a hobby you secretly take seriously\". Drinks and snacks on us." },
    { type: "h", text: "How it works" },
    { type: "l", items: [
      "18:00 doors and drink ticket pickup",
      "18:30 first round — three minutes per table",
      "20:00 open mingle with house DJ",
      "22:00 we close the room (the night does not have to)",
    ]},
    { type: "h", text: "Who shows up" },
    { type: "l", items: [
      "Exchange students from 27 countries (Spring '26 cohort)",
      "Local BI Oslo students signed up via the buddy program",
      "ESN volunteers running the bell and the music",
    ]},
  ],
  // Schedule
  startDate: "2026-08-28T18:00",
  endDate:   "2026-08-28T22:00",
  registrationDeadline: "2026-08-27T20:00",
  // Venue
  location: "BI Oslo · Kantina (Nydalen)",
  locationMode: "physical", // physical | online | hybrid
  onlineUrl: "",
  // Capacity
  capacity: 80,
  waitlist: true,
  // Pricing
  pricingMode: "free", // free | paid
  price: 0,
  memberPrice: 0,
  // Collection
  isCollection: false,
  collectionPricing: "individual", // bundle | individual
  // Audience
  memberOnly: false,
  // Visibility
  publishMode: "now", // now | schedule
  // Contact
  contactName: "Kari Berg",
  contactRole: "ESN Vice President",
  contactEmail: "esn-vp@biso.no",
  // Media
  coverPattern: 3,
  tags: ["Welcome week", "International", "Free"],
};

window.EVENT_CATEGORIES = EVENT_CATEGORIES;
window.SAMPLE_EVENTS    = SAMPLE_EVENTS;
window.EVENT_DRAFT_DEFAULT = EVENT_DRAFT_DEFAULT;
window.evCat = (id) => EVENT_CATEGORIES.find(c => c.id === id);

// Formatters specific to events
window.fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
window.fmtTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
window.fmtDay = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
};
window.fmtMonth = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
};
window.fmtDayNum = (iso) => {
  if (!iso) return "";
  return new Date(iso).getDate().toString().padStart(2, "0");
};
window.daysUntil = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const now = new Date("2026-05-13").getTime();
  return Math.round((t - now) / 86400000);
};
window.durationHrs = (start, end) => {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = ms / 3600000;
  if (h < 24) return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
};
window.fmtNOK = (n) => {
  if (n == null || n === 0) return "Free";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
};
