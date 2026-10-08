/**
 * In-memory mock database (persisted to localStorage, synced across tabs with BroadcastChannel).
 * Only used when the app runs in mock mode.
 */
import type {
  ApplicantDTO,
  ApprovalDTO,
  BriefDTO,
  BroadcastDTO,
  CalendarEventDTO,
  ChatMessageDTO,
  EmailDTO,
  FactDTO,
  FileDTO,
  GapDTO,
  InterviewDTO,
  MailTrackerDetailDTO,
  MatchDTO,
  OpeningDTO,
  QuestionDTO,
  ReadinessDTO,
  Role,
  ShortlistDTO,
  TraceDTO,
  TranscriptDTO,
  TruthRow,
} from '@educaro/shared';

export type PersonaKey = 'ananya' | 'rohan' | 'fresh' | 'extra';

export interface MockApplicant {
  id: string;
  persona: PersonaKey;
  profile: ApplicantDTO;
  files: FileDTO[];
  transcript: TranscriptDTO | null;
  facts: FactDTO[];
  truth: TruthRow[];
  questions: QuestionDTO[];
  chat: ChatMessageDTO[];
  shortlist: ShortlistDTO[];
  gaps: GapDTO[];
  readiness: ReadinessDTO;
  approvals: ApprovalDTO[];
  emails: EmailDTO[];
  calendar: CalendarEventDTO[];
  interviews: InterviewDTO[];
  trace: TraceDTO[];
  brief: BriefDTO;
  screenVersion: number;
  /** Script progress flags (ingest stage, letter drafted, …). */
  flags: Record<string, string | number | boolean>;
  /** Summary numbers for applicants that only exist to fill the pipeline. */
  extras?: { readiness: number; openGaps: number; openQuestions: number; pendingApprovals: number; conflicts: number };
}

export interface MockUser {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  applicantId: string | null;
}

export interface MockDB {
  v: number;
  seq: number;
  users: MockUser[];
  applicants: Record<string, MockApplicant>;
  openings: OpeningDTO[];
  matches: MatchDTO[];
  broadcasts: BroadcastDTO[];
  mail: MailTrackerDetailDTO[];
  openaiSpent: number;
}

export const DB_VERSION = 7;
const KEY = 'educaro.mock.db';

// ---------- time + ids ----------
export const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
export const minutesAgo = (m: number) => nowIso(-m * 60_000);
export const hoursAgo = (h: number) => nowIso(-h * 3_600_000);
export const daysAgo = (d: number) => nowIso(-d * 86_400_000);
export const daysFromNow = (d: number, hour?: number, minute = 0) => {
  const t = new Date(Date.now() + d * 86_400_000);
  if (hour !== undefined) t.setHours(hour, minute, 0, 0);
  return t.toISOString();
};

let idCounter = Math.floor(Math.random() * 1000);
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36).slice(-5)}${idCounter.toString(36)}`;
}

// ---------- persistence ----------
let db: MockDB | null = null;
let seedFn: (() => MockDB) | null = null;
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('educaro-mock') : null;

export function configureSeed(fn: () => MockDB) {
  seedFn = fn;
}

function load(): MockDB | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockDB;
    return parsed.v === DB_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function getDb(): MockDB {
  if (db) return db;
  db = load();
  if (!db) {
    if (!seedFn) throw new Error('mock seed not configured');
    db = seedFn();
    persist(false);
  }
  return db;
}

let saveTimer: number | null = null;
function persist(broadcast = true) {
  if (!db) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota: keep going in memory */
  }
  if (broadcast) channel?.postMessage({ kind: 'db' });
}

/** Mark the db dirty; writes are batched. */
export function save() {
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persist();
  }, 60);
}

export function resetDb() {
  if (!seedFn) return;
  db = seedFn();
  persist();
}

export function replaceDb(next: MockDB) {
  db = next;
  persist();
}

type DbListener = () => void;
const dbListeners = new Set<DbListener>();
export function onExternalDbChange(cb: DbListener) {
  dbListeners.add(cb);
  return () => {
    dbListeners.delete(cb);
  };
}
type MsgListener = (payload: unknown) => void;
const msgListeners = new Set<MsgListener>();
export function onExternalMessage(cb: MsgListener) {
  msgListeners.add(cb);
  return () => {
    msgListeners.delete(cb);
  };
}
export function broadcastMessage(payload: unknown) {
  channel?.postMessage({ kind: 'msg', payload });
}

channel?.addEventListener('message', (e: MessageEvent) => {
  const data = e.data as { kind?: string; payload?: unknown };
  if (data?.kind === 'db') {
    const fresh = load();
    if (fresh) {
      db = fresh;
      for (const l of dbListeners) l();
    }
  } else if (data?.kind === 'msg') {
    for (const l of msgListeners) l(data.payload);
  }
});

export function applicantOrThrow(id: string): MockApplicant {
  const a = getDb().applicants[id];
  if (!a) throw Object.assign(new Error('Applicant not found'), { status: 404 });
  return a;
}
