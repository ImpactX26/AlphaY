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
  groups: { kind: string; label: string; places: { name: string; lat: number; lon: number; address?: string; distanceM?: number }[] }[];
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
