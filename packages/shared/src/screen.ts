import type { Route, Tag, TruthRow } from './domain';

/**
 * Fixed blocks, free words.
 * Code fills every block's data from the database. The agent only chooses which blocks
 * show, in what order, and writes `title` / `body`. React renders from this list, so the
 * agent cannot produce UI that breaks.
 */

export interface ServiceRef {
  id: string;
  name: string;
  url: string;
  why?: string;
}

export interface BlockAction {
  label: string;
  kind: 'answer' | 'link' | 'chat' | 'shortlist' | 'upload' | 'open_approval' | 'service';
  value?: string;
}

export interface LinkRef {
  label: string;
  url: string;
}

interface Base {
  id: string;
  title?: string;
  body?: string;
}

export type ItemStatus = 'verified' | 'missing' | 'planned' | 'pending' | 'said' | 'ready' | 'gaps' | 'checking';
export type MatrixStatus = 'meets' | 'missing' | 'pending' | 'start_now' | 'info' | 'not_needed';

export interface NextStepBlock extends Base {
  type: 'next_step';
  actions: BlockAction[];
  tags: Tag[];
  service?: ServiceRef;
}
export interface QuestionBlock extends Base {
  type: 'question';
  questionId: string;
  prompt: string;
  why: string;
  options: string[];
}
export interface ChecklistBlock extends Base {
  type: 'checklist';
  items: { label: string; status: ItemStatus; note?: string }[];
}
export interface DocumentsBlock extends Base {
  type: 'documents';
  items: { id: string; name: string; kind: string; status: 'queued' | 'reading' | 'done' | 'unclear' }[];
}
export interface TruthMapBlock extends Base {
  type: 'truth_map';
  rows: TruthRow[];
}
export interface RouteBlock extends Base {
  type: 'route';
  primary: Route;
  alternatives: Route[];
  reasons: string[];
  chancenkarte?: { total: number; needed: number; lines: { label: string; points: number }[] };
}
export interface OpportunitiesBlock extends Base {
  type: 'opportunities';
  items: { id: string; title: string; subtitle: string; url: string; kind: 'programme' | 'opening'; why: string; shortlisted: boolean }[];
}
export interface ShortlistBlock extends Base {
  type: 'shortlist';
  items: { id: string; title: string; subtitle: string; status: ItemStatus; gapCount: number; url: string }[];
}
export interface MatrixBlock extends Base {
  type: 'requirement_matrix';
  shortlistId: string;
  rows: { requirement: string; needs: string; has: string; status: MatrixStatus; tag: Tag; sourceUrl: string | null }[];
  exams: { name: string; status: 'done' | 'pending' | 'not_started' | 'not_needed' }[];
  deadline?: { label: string; date: string | null; daysLeft: number | null };
}
export interface GapPlanBlock extends Base {
  type: 'gap_plan';
  gaps: {
    id: string;
    title: string;
    what: string;
    where: string;
    howLong: string;
    cost: string;
    links: LinkRef[];
    service?: ServiceRef;
  }[];
}
export interface ReadinessBlock extends Base {
  type: 'readiness';
  overall: number;
  outcome: 'ready' | 'ready_after_plan' | 'better_route';
  meters: { label: string; value: number }[];
}
export interface BudgetBlock extends Base {
  type: 'budget';
  city: string;
  lines: { label: string; amount: number; note?: string }[];
  total: number;
  compare: { city: string; total: number }[];
  sources: LinkRef[];
}
export interface TimelineBlock extends Base {
  type: 'timeline';
  items: { date: string; label: string; kind: 'deadline' | 'exam' | 'task' | 'event' | 'interview' }[];
}
export interface ServicesBlock extends Base {
  type: 'services';
  services: ServiceRef[];
}
export interface PlacesBlock extends Base {
  type: 'places';
  city: string;
  center: { lat: number; lon: number };
  groups: {
    kind: string;
    label: string;
    places: {
      name: string;
      lat: number;
      lon: number;
      address?: string;
      distanceM?: number;
      /** Opens the pin in Google Maps. */
      mapsUrl?: string;
      /** Opens public-transport directions from the applicant's address to the pin. */
      directionsUrl?: string;
    }[];
  }[];
}
export interface LettersBlock extends Base {
  type: 'letters';
  drafts: { approvalId: string; title: string; to: string; status: string }[];
}
export interface ArrivalBlock extends Base {
  type: 'arrival';
  phases: { title: string; items: { label: string; done: boolean; note?: string }[] }[];
}
export interface NoteBlock extends Base {
  type: 'note';
  tone: 'info' | 'warn' | 'success';
}

/**
 * Rooms and flats near where they are actually going, with the commute to the place that decides
 * their day — the hospital or the campus. Rent on its own does not tell anyone whether they can
 * live somewhere: 80 euros cheaper and 50 minutes each way is not cheaper.
 */
export interface RentalsBlock extends Base {
  type: 'rentals';
  city: string;
  center: { lat: number; lon: number };
  /** What they are commuting to, if we know it. */
  anchor: { label: string; lat: number; lon: number } | null;
  budgetEur: number | null;
  listings: {
    id: string;
    title: string;
    district: string;
    kind: 'wg_room' | 'studio' | 'flat';
    warmRentEur: number;
    sizeSqm: number | null;
    lat: number;
    lon: number;
    commuteMin: number | null;
    url: string | null;
    /** Opens the district in Google Maps. */
    mapsUrl?: string;
    /** Public-transport directions from here to whatever the commute is measured against. */
    directionsUrl?: string;
    affordable: boolean;
    note?: string;
  }[];
  source: string;
}

/**
 * People who were in the same position, anonymised, and how long each step actually took them.
 *
 * Every applicant asks "how long will this take". An average off a government page is not an
 * answer; what the people on this route actually took is. Only cohort members far enough along to
 * have real dates are counted, and the count is shown so nobody mistakes three people for a trend.
 */
export interface CohortBlock extends Base {
  type: 'cohort';
  route: string;
  /** How many anonymised files this is drawn from. */
  basis: number;
  steps: { label: string; medianWeeks: number; rangeWeeks: [number, number]; youAre: 'ahead' | 'on_track' | 'behind' | 'not_started' }[];
  peers: { label: string; headline: string; nowAt: string }[];
}

/**
 * Is this real?
 *
 * The people this product serves are the most defrauded group in the whole process: fake agents,
 * fake offer letters, a "landlord" who wants a deposit by Western Union for a flat that does not
 * exist. They are checking in a second language, under time pressure, from another continent. The
 * checks are boring and known — this just runs them before the money leaves.
 */
export interface ScamCheckBlock extends Base {
  type: 'scam_check';
  subject: { kind: 'university' | 'employer' | 'landlord' | 'agent' | 'offer'; name: string };
  verdict: 'looks_legitimate' | 'be_careful' | 'high_risk';
  score: number;
  signals: { label: string; status: 'good' | 'warn' | 'bad'; detail: string }[];
  /** Unfair terms found in a contract, in plain words, with what the law actually says. */
  contractFlags: { clause: string; why: string; lawSays: string; severity: 'unfair' | 'illegal' | 'watch' }[];
  neverDo: string[];
}

/** Money over time, not money this month: what they need, when, and what is still missing. */
export interface FinancePlanBlock extends Base {
  type: 'finance_plan';
  currency: 'EUR';
  inrPerEur: number;
  oneOff: { label: string; amountEur: number; whenMonth: string; paid: boolean; note?: string }[];
  monthlyEur: number;
  needBeforeTravelEur: number;
  haveEur: number | null;
  fundingGapEur: number | null;
  options: { label: string; detail: string }[];
}

/** People going to the same city at the same time, so nobody arrives alone. */
export interface CohortGroupBlock extends Base {
  type: 'cohort_group';
  city: string;
  month: string;
  members: { label: string; route: string; arrivingMonth: string; sharedInterest: string | null }[];
  flatShare: { seats: number; budgetEachEur: number; district: string } | null;
  travel: { label: string; detail: string } | null;
  joined: boolean;
}

/** What the route is actually like, including the parts a brochure leaves out. */
export interface RealityCheckBlock extends Base {
  type: 'reality_check';
  route: string;
  headline: string;
  shifts: { label: string; detail: string }[];
  money: { label: string; detail: string }[];
  hard: { stat: string; detail: string }[];
  voices: { who: string; quote: string }[];
  source: string;
}

/** One tap when something is wrong at work, and the rights that apply whatever the employer says. */
export interface HelpBlock extends Base {
  type: 'help';
  rights: { title: string; detail: string }[];
  contacts: { label: string; detail: string; url: string | null }[];
  reportHint: string;
}

/** The cohort channel, in the app: the same thread that lives in Discord. */
export interface CommunityBlock extends Base {
  type: 'community';
  channel: string | null;
  posts: {
    id: string;
    author: string;
    authorKind: 'applicant' | 'agent' | 'staff';
    text: string;
    createdAt: string;
    replies: number;
    viaDiscord: boolean;
  }[];
}

export type Block =
  | NextStepBlock
  | QuestionBlock
  | ChecklistBlock
  | DocumentsBlock
  | TruthMapBlock
  | RouteBlock
  | OpportunitiesBlock
  | ShortlistBlock
  | MatrixBlock
  | GapPlanBlock
  | ReadinessBlock
  | BudgetBlock
  | TimelineBlock
  | ServicesBlock
  | PlacesBlock
  | LettersBlock
  | ArrivalBlock
  | RentalsBlock
  | CohortBlock
  | CommunityBlock
  | ScamCheckBlock
  | FinancePlanBlock
  | CohortGroupBlock
  | RealityCheckBlock
  | HelpBlock
  | NoteBlock;

export type BlockType = Block['type'];

export interface Screen {
  applicantId: string;
  version: number;
  mode: 'onboarding' | 'planning' | 'germany';
  headline: string;
  footnote: string;
  blocks: Block[];
  composedBy: 'agent' | 'rules';
  updatedAt: string;
}
