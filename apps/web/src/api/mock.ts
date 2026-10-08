/**
 * Mock mode (VITE_MOCK=1): the whole API in the browser, with the same live socket messages
 * the real server sends. Persona copy lives here and in ./fixtures, never in components.
 */
import type {
  CommunityPostDTO,
  ApplicantDTO,
  ApprovalDetailDTO,
  ApprovalDTO,
  AuthResponse,
  Block,
  BriefDTO,
  BroadcastDTO,
  ChatMessageDTO,
  DemoPersona,
  EmailDTO,
  FileDTO,
  InterviewDTO,
  MailTrackerDetailDTO,
  MailTrackerItemDTO,
  MatchDTO,
  MatrixBlock,
  MeDTO,
  OpeningDTO,
  PipelineCardDTO,
  PipelineStage,
  Screen,
  ServerMessage,
  ShortlistDTO,
  StaffQueueItemDTO,
  SystemStatusDTO,
  TraceDTO,
} from '@educaro/shared';
import { ApiError } from './errors';
import { loadSnapshot, saveSnapshot } from './mockStore';
import { ANANYA_ID, ananyaState } from './fixtures/ananya';
import { type ApplicantState, DAY, emptyScreen, freshState, guessKind, HOUR, SERVICES } from './fixtures/common';
import { communityPosts, nursingCohort, rentalsFor } from './fixtures/community';
import { germanyScreen } from './fixtures/germany';
import { ROHAN_ID, rohanState, RWTH_SHORTLIST } from './fixtures/rohan';
import { BATCH_PLAN, BROADCASTS, copilotAnswer, germanProfile, OPENINGS, OTHER_CARDS, rankedMatches } from './fixtures/staff';
import { mockBus } from './mockBus';
import { tokenStore } from './token';
import type { Api, ReplyKind, ShortlistInput } from './types';

// ---------- state ----------

const clone = <T>(v: T): T => structuredClone(v);

/** The cohort thread is shared across personas, so it lives beside the per-applicant state. */
const thread: CommunityPostDTO[] = clone(communityPosts);

const snapshot = loadSnapshot();

const states = new Map<string, ApplicantState>(
  snapshot
    ? (Object.entries(snapshot.states) as [string, ApplicantState][])
    : [
        [ANANYA_ID, clone(ananyaState())],
        [ROHAN_ID, clone(rohanState())],
      ],
);
const otherCards = new Map(OTHER_CARDS.map((c) => [c.applicantId, clone(c)]));
const openings: OpeningDTO[] = snapshot ? (snapshot.openings as OpeningDTO[]) : clone(OPENINGS);
const matchesByOpening = new Map<string, MatchDTO[]>(snapshot ? (Object.entries(snapshot.matches) as [string, MatchDTO[]][]) : []);
const broadcasts: BroadcastDTO[] = snapshot ? (snapshot.broadcasts as BroadcastDTO[]) : clone(BROADCASTS);
const interviews = new Map<string, { applicantId: string; dto: InterviewDTO; asked: number }>();
const uploadedBlobs = new Map<string, string>();
const consultantBookings = new Map<string, string>(snapshot ? Object.entries(snapshot.bookings) : []);
const globalTrace: TraceDTO[] = snapshot ? (snapshot.globalTrace as TraceDTO[]) : [];
let openaiSpent = snapshot?.openaiSpent ?? 3.42;
let seq = snapshot?.seq ?? 1000;

/** Mirror the demo into sessionStorage, so a reload mid-demo resumes instead of resetting. */
function persist(): void {
  saveSnapshot(() => ({
    states: Object.fromEntries(states),
    openings,
    matches: Object.fromEntries(matchesByOpening),
    broadcasts,
    bookings: Object.fromEntries(consultantBookings),
    globalTrace,
    openaiSpent,
    seq,
  }));
}

const uid = (prefix: string) => `${prefix}-${(++seq).toString(36)}`;
const nowIso = () => new Date().toISOString();
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const latency = () => wait(120 + Math.random() * 160);

const DEMO_USERS: Record<DemoPersona, MeDTO> = {
  ananya: { userId: 'u-ananya', role: 'applicant', name: 'Ananya Nair', email: 'ananya.nair@example.com', applicantId: ANANYA_ID },
  rohan: { userId: 'u-rohan', role: 'applicant', name: 'Rohan Mehta', email: 'rohan.mehta@example.com', applicantId: ROHAN_ID },
  staff: { userId: 'u-staff', role: 'staff', name: 'Lena Fischer', email: 'lena.fischer@educaro.example', applicantId: null },
  fresh: { userId: 'u-fresh', role: 'applicant', name: 'Priya Sharma', email: 'priya.sharma@example.com', applicantId: 'app-fresh' },
};

function encodeToken(user: MeDTO): string {
  return `mock.${btoa(unescape(encodeURIComponent(JSON.stringify(user))))}`;
}
function decodeToken(token: string | null): MeDTO | null {
  if (!token?.startsWith('mock.')) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(token.slice(5))))) as MeDTO;
  } catch {
    return null;
  }
}
function me(): MeDTO {
  const user = decodeToken(tokenStore.get());
  if (!user) throw new ApiError(401, 'Your session ended. Sign in again.');
  return user;
}
function requireStaff(): MeDTO {
  const user = me();
  if (user.role !== 'staff') throw new ApiError(403, 'Only Educaro staff can do this.');
  return user;
}
function state(applicantId: string): ApplicantState {
  const user = me();
  if (user.role !== 'staff' && user.applicantId !== applicantId) throw new ApiError(403, 'You can only see your own profile.');
  let s = states.get(applicantId);
  if (!s) {
    s = freshState(applicantId, user.role === 'staff' ? 'New applicant' : user.name, user.role === 'staff' ? null : user.email);
    states.set(applicantId, s);
  }
  return s;
}
function findApproval(approvalId: string): { s: ApplicantState; a: ApprovalDetailDTO } {
  for (const s of states.values()) {
    const a = s.approvals.find((x) => x.id === approvalId);
    if (a) return { s, a };
  }
  throw new ApiError(404, 'That approval no longer exists.');
}

// ---------- live messages ----------

const emit = (msg: ServerMessage) => mockBus.emit(msg);
const refresh = (applicantId: string, what: string[]) => {
  emit({ type: 'refresh', applicantId, what });
  persist();
};
const status = (applicantId: string, s: 'idle' | 'thinking' | 'working', detail?: string) =>
  emit({ type: 'agent_status', applicantId, status: s, detail });

function pushScreen(s: ApplicantState, patch: Partial<Screen> = {}): void {
  s.screen = { ...s.screen, ...patch, version: s.screen.version + 1, updatedAt: nowIso() };
  emit({ type: 'screen', screen: clone(s.screen) });
  persist();
}

function say(s: ApplicantState, author: ChatMessageDTO['author'], text: string, channel: ChatMessageDTO['channel'] = 'web'): ChatMessageDTO {
  const message: ChatMessageDTO = { id: uid('c'), applicantId: s.applicant.id, author, channel, text, createdAt: nowIso() };
  s.chat.push(message);
  emit({ type: 'chat', applicantId: s.applicant.id, message: clone(message) });
  persist();
  return message;
}

function trace(applicantId: string | null, kind: TraceDTO['kind'], name: string, detail: Record<string, unknown>, costUsd = 0): void {
  const t: TraceDTO = { id: uid('t'), applicantId, runId: null, kind, name, detail, costUsd, createdAt: nowIso() };
  const s = applicantId ? states.get(applicantId) : undefined;
  if (s) s.trace.push(t);
  else globalTrace.push(t);
  openaiSpent += costUsd;
  emit({ type: 'trace', trace: clone(t) });
  persist();
}

function moveStage(s: ApplicantState, stage: PipelineStage, reason: string, by: 'agent' | 'staff' = 'agent'): void {
  const from = s.applicant.stage;
  s.applicant = { ...s.applicant, stage, stageReason: reason };
  trace(s.applicant.id, 'move', 'stage', { from, to: stage, reason, by });
  emit({ type: 'pipeline', applicantId: s.applicant.id, stage, reason });
}

// ---------- screen helpers ----------

type Position = 'top' | 'afterNext' | 'end' | 'keep' | { after: string };

function setBlock(s: ApplicantState, block: Block, at: Position = 'keep'): void {
  const existing = s.screen.blocks.findIndex((b) => b.id === block.id);
  const blocks = s.screen.blocks.filter((b) => b.id !== block.id);
  let index: number;
  if (at === 'keep') index = existing >= 0 ? existing : blocks.length;
  else if (at === 'top') index = 0;
  else if (at === 'afterNext') index = blocks.findIndex((b) => b.type === 'next_step') + 1;
  else if (at === 'end') index = blocks.length;
  else {
    const anchor = blocks.findIndex((b) => b.id === at.after);
    index = anchor >= 0 ? anchor + 1 : blocks.length;
  }
  blocks.splice(index, 0, block);
  s.screen = { ...s.screen, blocks };
}
function dropBlock(s: ApplicantState, predicate: (b: Block) => boolean): void {
  s.screen = { ...s.screen, blocks: s.screen.blocks.filter((b) => !predicate(b)) };
}
function documentsBlock(s: ApplicantState): Block {
  return {
    id: `b-${s.applicant.id}-docs`,
    type: 'documents',
    title: 'Your documents',
    items: s.files.map((f) => ({ id: f.id, name: f.originalName, kind: f.kindLabel ?? 'Sorting…', status: f.status })),
  };
}

// ---------- the agent, simulated ----------

function replyTo(text: string, s: ApplicantState): string {
  const t = text.toLowerCase();
  const first = s.applicant.name.split(' ')[0];
  if (/\bb1\b|\bb2\b|german|course|batch/.test(t))
    return 'B1 is the level the recognition office expects before the next step, and employers ask for B2 to work as a nurse. Educaro’s online B1 batch starts on 2 November, evenings IST. You can sit the ÖSD B1 exam at Educaro’s own centre in February.';
  if (/\baps\b/.test(t))
    return 'APS checks that your degree and marksheets are genuine and that your university is recognised. You book online, send certified copies, and get the certificate in about 3 to 4 weeks. German universities won’t process an Indian degree without it.';
  if (/anerkennung|recogni/.test(t))
    return 'Anerkennung is the official recognition of your qualification. The office compares your training with the German one and lists any gaps. An adaptation course or the Kenntnisprüfung closes them. educaro Akademie can file it for you.';
  if (/budget|money|rent|cost|blocked/.test(t))
    return 'Rent is the big number. A room in a shared flat in Aachen is around €430 a month, in Munich closer to €700. I put a full monthly budget on your screen with the sources.';
  if (/visa/.test(t))
    return 'Your visa type depends on the route. I’ll prepare the checklist once your offer or contract is in. Never book a VFS slot through an agent who asks for extra money.';
  if (/interview/.test(t))
    return 'Open the interview coach from your plan. I’ll ask the questions this employer is likely to ask and score each answer against your profile.';
  if (/thank/.test(t)) return `You’re welcome, ${first}. I’ll ping you here when something changes.`;
  return 'Got it. I’ve added that to your profile as something you said, and I’ll use it when I update your plan. If a document proves it, upload it and I’ll mark it Verified.';
}

async function agentAnswer(s: ApplicantState, text: string): Promise<void> {
  status(s.applicant.id, 'thinking');
  await wait(900 + Math.random() * 600);
  trace(s.applicant.id, 'llm', 'chat_reply', { tier: 'cheap', model: 'openai/gpt-oss-120b', cached: false }, 0);
  say(s, 'agent', replyTo(text, s));
  status(s.applicant.id, 'idle');
}

const run = (task: () => Promise<void>) => {
  task().catch((err: unknown) => console.error('[mock]', err));
};

async function readFiles(s: ApplicantState, fileIds: string[]): Promise<void> {
  const id = s.applicant.id;
  if (s.screen.mode === 'onboarding') {
    setBlock(s, documentsBlock(s), 'top');
    pushScreen(s, { headline: 'Thanks. I’m reading your files now. Your screen fills in as I go.', composedBy: 'rules' });
  }
  for (const fid of fileIds) {
    const file = s.files.find((f) => f.id === fid);
    if (!file) continue;
    await wait(220);
    file.status = 'reading';
    status(id, 'working', file.kind === 'video' ? 'Transcribing your video' : `Reading ${file.originalName}`);
    setBlock(s, documentsBlock(s));
    pushScreen(s);
    refresh(id, ['files']);
    await wait(file.kind === 'video' ? 2400 : 420 + Math.random() * 480);
    if (file.kind === 'video') {
      file.status = 'done';
      s.transcript = {
        fileId: file.id,
        provider: 'mock',
        text: 'In mock mode there is no transcription. With the API running, Whisper writes the transcript of your video here, in the original language and in English.',
        segments: [],
      };
      trace(id, 'tool', 'transcribe_media', { file: file.originalName, provider: 'mock' });
      refresh(id, ['transcript']);
    } else {
      const g = guessKind(file.originalName, file.mime);
      file.kind = g.kind;
      file.kindLabel = g.label;
      file.confidence = Math.round(g.confidence * 100) / 100;
      file.status = g.confidence < 0.5 ? 'unclear' : 'done';
      trace(id, 'tool', 'classify_upload', { file: file.originalName, kind: g.kind, confidence: file.confidence, by: 'rules' });
      // The truth map grows while the files are read: that is the moment the demo opens on.
      if (file.status === 'done') {
        s.truth = [
          ...s.truth.filter((r) => r.key !== file.kind),
          { key: file.kind, label: file.kindLabel ?? file.originalName, video: null, cv: null, document: file.originalName, status: 'verified', note: 'Read from the document.' },
        ];
        setBlock(s, { id: `b-${id}-truth`, type: 'truth_map', title: 'What your documents prove', rows: s.truth }, 'end');
        refresh(id, ['truth-map']);
      }
    }
    setBlock(s, documentsBlock(s));
    pushScreen(s);
    refresh(id, ['files']);
  }
  if (s.applicant.route === null && s.questions.every((q) => q.id !== `q-${id}-route`)) composeFirstRead(s);
  status(id, 'idle');
}

function composeFirstRead(s: ApplicantState): void {
  const id = s.applicant.id;
  const first = s.applicant.name.split(' ')[0];
  // The video counts as a file that was read: someone who uploads only their video used to be
  // told "I've read 0 files", which is the first thing the agent ever says to them.
  const done = s.files.filter((f) => f.status === 'done');
  const question = {
    id: `q-${id}-route`,
    prompt: 'What do you most want to do in Germany?',
    why: 'Your documents fit more than one route. Your answer decides which checks I run first.',
    options: ['Study (Bachelor or Master)', 'Ausbildung', 'Work as a nurse', 'A skilled job', 'Not sure yet'],
  };
  s.questions = [{ ...question, factKey: 'route', status: 'open', answer: null, createdAt: nowIso() }, ...s.questions];
  setBlock(s, { id: `b-${id}-q-route`, type: 'question', title: 'One question', questionId: question.id, prompt: question.prompt, why: question.why, options: question.options }, 'top');
  // The unclear-photo warning lives in the documents block, next to the file itself.
  setBlock(s, documentsBlock(s), 'end');
  setBlock(s, { id: `b-${id}-truth`, type: 'truth_map', title: 'What your documents prove', rows: s.truth }, 'end');
  s.applicant = { ...s.applicant, mode: 'planning' };
  pushScreen(s, {
    mode: 'planning',
    composedBy: 'agent',
    headline: `Thanks, ${first}. I’ve read ${done.length} ${done.length === 1 ? 'file' : 'files'}. One question before I build your plan.`,
    footnote: 'Everything I found is tagged with where it came from.',
  });
  moveStage(s, 'profiling', `Read ${done.length} files. Asked for the route.`);
  refresh(id, ['questions', 'truth-map', 'applicant']);
  say(s, 'agent', `I’ve read your files, ${first}. One question on your screen, then I’ll build your plan.`);
}

async function replayIntake(applicantId: string): Promise<void> {
  const full = clone(applicantId === ROHAN_ID ? rohanState() : ananyaState());
  const prev = states.get(applicantId);
  const version = (prev?.screen.version ?? 1) + 1;
  const s: ApplicantState = {
    ...full,
    files: full.files.map((f) => ({ ...f, status: 'queued', kind: f.kind === 'video' ? 'video' : 'other', kindLabel: null, confidence: null })),
    transcript: null,
    facts: [],
    truth: [],
    questions: [],
    gaps: [],
    approvals: [],
    shortlist: [],
    chat: [],
    applicant: { ...full.applicant, stage: 'new_story', stageReason: 'Story uploaded.', mode: 'onboarding' },
    screen: { ...emptyScreen(applicantId, full.applicant.name), version },
  };
  states.set(applicantId, s);
  emit({ type: 'screen', screen: clone(s.screen) });
  refresh(applicantId, ['*']);
  emit({ type: 'pipeline', applicantId, stage: 'new_story', reason: 'Story uploaded.' });
  await wait(700);
  setBlock(s, documentsBlock(s), 'top');
  pushScreen(s, { headline: 'Thanks. I’m reading your video and files now. Your screen fills in as I go.' });
  for (const [i, f] of s.files.entries()) {
    const target = full.files[i];
    f.status = 'reading';
    status(applicantId, 'working', f.kind === 'video' ? 'Transcribing your video' : `Reading ${f.originalName}`);
    setBlock(s, documentsBlock(s));
    pushScreen(s);
    refresh(applicantId, ['files']);
    await wait(f.kind === 'video' ? 1600 : 650);
    Object.assign(f, { status: target.status, kind: target.kind, kindLabel: target.kindLabel, confidence: target.confidence });
    setBlock(s, documentsBlock(s));
    pushScreen(s);
    refresh(applicantId, ['files']);
    if (f.kind === 'video') {
      s.transcript = full.transcript;
      refresh(applicantId, ['transcript']);
    }
  }
  moveStage(s, 'profiling', 'Cross-checking video, CV and documents.');
  status(applicantId, 'working', 'Cross-checking what you said, wrote and proved');
  const truthId = `b-${applicantId}-truth-live`;
  for (const row of full.truth) {
    s.truth = [...s.truth, row];
    setBlock(s, { id: truthId, type: 'truth_map', title: 'What you said, wrote and proved', rows: s.truth }, 'end');
    pushScreen(s);
    await wait(row.status === 'conflict' ? 900 : 450);
  }
  s.facts = full.facts;
  refresh(applicantId, ['truth-map', 'facts']);
  status(applicantId, 'working', 'Writing your questions');
  await wait(700);
  s.questions = full.questions;
  for (const q of [...full.questions].reverse())
    setBlock(s, { id: `b-live-${q.id}`, type: 'question', title: 'One question', questionId: q.id, prompt: q.prompt, why: q.why, options: q.options }, 'top');
  pushScreen(s, { headline: 'Two things don’t match yet. Everything else checks out.' });
  refresh(applicantId, ['questions']);
  status(applicantId, 'working', 'Running specialists: exams, recognition, money');
  await wait(1800);
  // The letter is not written yet: the writer drafts it a moment later, on its own.
  const lettersBlock = full.screen.blocks.find((b): b is Extract<Block, { type: 'letters' }> => b.type === 'letters');
  s.screen = { ...full.screen, blocks: full.screen.blocks.filter((b) => b.type !== 'letters'), version: s.screen.version };
  s.gaps = full.gaps;
  s.shortlist = full.shortlist;
  s.applicant = { ...full.applicant, mode: 'planning' };
  pushScreen(s);
  moveStage(s, full.applicant.stage, full.applicant.stageReason ?? '');
  refresh(applicantId, ['*']);
  say(s, 'agent', full.chat[0]?.text ?? 'I’ve read everything. Your screen is ready.');
  status(applicantId, 'idle');

  if (lettersBlock && full.approvals.length) {
    await wait(2200);
    status(applicantId, 'working', 'Matching Educaro partner openings');
    trace(applicantId, 'tool', 'match_openings', { opening: 'Rheinpflege Seniorenzentrum', score: 0.91 });
    await wait(1600);
    status(applicantId, 'working', 'Writing your Bewerbung from verified facts');
    trace(applicantId, 'llm', 'draft_letter', { tier: 'quality', model: 'gpt-5-mini', facts: 6 }, 0.0058);
    await wait(2000);
    trace(applicantId, 'guard', 'letter_facts_only', { allowedTags: ['verified', 'said'], removed: ['B1 exam date (AI-planned)'] });
    s.approvals = full.approvals;
    setBlock(s, lettersBlock, 'top');
    pushScreen(s, { headline: 'Ananya, a letter to Rheinpflege is ready for you to check.' });
    refresh(applicantId, ['approvals']);
    say(s, 'agent', 'I drafted your Bewerbung to Rheinpflege in Cologne, from your verified facts and their own words. Read it and approve it, or tell me what to change. Nothing goes out until you tap.');
    status(applicantId, 'idle');
  }
}

function questionAnswered(s: ApplicantState, questionId: string, answer: string): void {
  const id = s.applicant.id;
  dropBlock(s, (b) => b.type === 'question' && b.questionId === questionId);
  const explain = /explain/i.test(answer);
  if (questionId === 'q-an-exp' && !explain) {
    s.truth = s.truth.map((r) =>
      r.key === 'experience.aster' ? { ...r, cv: 'Jul 2021 to Aug 2024 (fixed)', status: 'verified', note: 'CV fixed to match the letter.', questionId: null } : r,
    );
    say(s, 'agent', 'Done. Your CV now says Jul 2021 to Aug 2024, matching the letter. That’s three full years, which also counts for the Chancenkarte.');
  } else if (questionId === 'q-an-name' && !explain) {
    s.truth = s.truth.map((r) =>
      r.key === 'name' ? { ...r, status: 'said', note: 'You confirmed both are you. Same-person affidavit added to your plan.', questionId: null } : r,
    );
    say(s, 'agent', 'Thanks. I added a same-person affidavit to your plan: one page, any notary in Kochi, one day. The embassy won’t need to ask.');
  } else if (questionId === 'q-ro-ielts' && /not taken/i.test(answer)) {
    s.truth = s.truth.map((r) => (r.key === 'language.english' ? { ...r, cv: 'IELTS 7.0 (not taken yet)', note: 'Book IELTS Academic, 6.5 needed.', questionId: null } : r));
    say(s, 'agent', 'No problem. I took IELTS off your CV for now and added the test to your plan. You need 6.5 overall; 2 to 3 weeks from booking to result.');
  } else if (questionId === 'q-ro-intake') {
    say(s, 'agent', `${answer} it is. Every countdown on your screen now points at that intake.`);
  } else if (questionId.endsWith('-route')) {
    const route = /study/i.test(answer) ? 'study' : /ausbildung/i.test(answer) ? 'ausbildung' : /nurse/i.test(answer) ? 'nursing' : /skilled/i.test(answer) ? 'skilled_job' : null;
    s.applicant = { ...s.applicant, route, routeReasons: route ? [`You chose: ${answer.toLowerCase()}`] : [] };
    setBlock(
      s,
      {
        id: `b-${id}-next`,
        type: 'next_step',
        title: 'Your next step',
        body: route
          ? 'Book a free consultant call. We’ll check your route against your documents and pick your first target together.'
          : 'Book a free consultant call. Thirty minutes is enough to pick the route that fits you.',
        actions: [
          { label: 'Book a call', kind: 'service', value: SERVICES.consultant.url },
          { label: 'What happens on the call?', kind: 'chat', value: 'What happens on the consultant call?' },
        ],
        tags: ['ai'],
        service: { ...SERVICES.consultant, why: 'Free, 30 minutes, in English.' },
      },
      'top',
    );
    say(s, 'agent', route ? 'Great. I’ll run the checks for that route now.' : 'That’s fine. A short call with a consultant usually settles it.');
    refresh(id, ['applicant']);
  } else {
    say(s, 'agent', 'Thanks. Tell me in the chat, and I’ll update your profile from what you say.');
  }
  const truthBlock = s.screen.blocks.find((b): b is Extract<Block, { type: 'truth_map' }> => b.type === 'truth_map');
  if (truthBlock) setBlock(s, { ...truthBlock, rows: s.truth });
  if (s.screen.blocks.every((b) => b.type !== 'question') && s.applicant.id === ANANYA_ID)
    pushScreen(s, { headline: 'Ananya, your papers line up now. German is your long pole: you need B1, then B2 for nursing.' });
  else pushScreen(s);
  refresh(id, ['truth-map', 'questions']);
}

function genericMatrix(s: ApplicantState): Pick<MatrixBlock, 'rows' | 'exams' | 'deadline'> {
  const study = s.applicant.route === 'study';
  return {
    rows: study
      ? [
          { requirement: 'Bachelor', needs: 'Related subject', has: 'B.Tech CS, degree certificate', status: 'meets', tag: 'verified', sourceUrl: null },
          { requirement: 'English', needs: 'IELTS 6.5 or equal', has: 'IELTS claimed, no report', status: 'pending', tag: 'said', sourceUrl: null },
          { requirement: 'APS certificate', needs: 'Required for Indian degrees', has: 'Not started', status: 'start_now', tag: 'web', sourceUrl: 'https://aps-india.de' },
        ]
      : [
          { requirement: 'Qualification', needs: 'Matching training', has: 'Diploma, verified', status: 'meets', tag: 'verified', sourceUrl: null },
          { requirement: 'German', needs: 'B1', has: 'A2 claimed', status: 'pending', tag: 'said', sourceUrl: null },
        ],
    exams: study
      ? [
          { name: 'IELTS', status: 'pending' },
          { name: 'APS', status: 'not_started' },
        ]
      : [{ name: 'German B1', status: 'pending' }],
    deadline: { label: 'Application deadline', date: null, daysLeft: null },
  };
}

async function checkShortlist(s: ApplicantState, entry: ShortlistDTO, base: ShortlistDTO | null): Promise<void> {
  const id = s.applicant.id;
  let host = 'the official page';
  try {
    host = new URL(entry.url).hostname.replace(/^www\./, '');
  } catch {
    /* pasted text that is not a URL */
  }
  status(id, 'working', `Opening ${host}`);
  trace(id, 'source', 'web_fetch', { url: entry.url, status: 200 });
  await wait(1300);
  status(id, 'working', 'Reading admission rules, exams and deadlines');
  trace(id, 'llm', 'extract_requirements', { tier: 'cheap', model: 'openai/gpt-oss-120b', url: entry.url }, 0);
  await wait(1100);
  status(id, 'working', 'Comparing grade, English and APS in code');
  trace(id, 'tool', 'compare_requirements', { by: 'code' });
  await wait(900);
  const matrix = base?.matrix ? clone(base.matrix) : genericMatrix(s);
  const gapCount = matrix.rows.filter((r) => r.status === 'missing' || r.status === 'pending' || r.status === 'start_now').length;
  Object.assign(entry, { matrix, gapCount, status: gapCount ? 'gaps' : 'ready' });
  const shortlistBlock = s.screen.blocks.find((b): b is Extract<Block, { type: 'shortlist' }> => b.type === 'shortlist');
  if (shortlistBlock)
    setBlock(s, {
      ...shortlistBlock,
      items: shortlistBlock.items.map((it) => (it.id === entry.id ? { ...it, status: gapCount ? 'gaps' : 'ready', gapCount } : it)),
    });
  setBlock(
    s,
    {
      id: `b-matrix-${entry.id}`,
      type: 'requirement_matrix',
      title: `${entry.title}, for you`,
      body: 'Every row comes from the programme’s own page and your documents, and links to its source.',
      shortlistId: entry.id,
      ...matrix,
    },
    'afterNext',
  );
  if (s.applicant.id === ROHAN_ID) {
    if (!s.gaps.some((g) => g.id === 'gap-ro-uniassist'))
      s.gaps = [
        ...s.gaps,
        {
          id: 'gap-ro-uniassist',
          key: 'uniassist',
          title: `uni-assist pack for ${entry.title.split(', ').pop() ?? 'RWTH'}`,
          what: 'Certified copies, the APS certificate and your motivation letter, uploaded through uni-assist.',
          where: 'uni-assist portal; Educaro prepares every file and a field-by-field guide',
          howLong: '1 to 2 weeks after APS',
          cost: 'uni-assist handling fee',
          links: [{ label: 'uni-assist', url: 'https://www.uni-assist.de' }],
          service: SERVICES.study,
          status: 'open',
          shortlistId: entry.id,
        },
      ];
    setBlock(
      s,
      {
        id: 'b-ro-gaps',
        type: 'gap_plan',
        title: 'Your plan, in order',
        body: 'APS first, then the IELTS report, then the uni-assist pack.',
        gaps: s.gaps.map((g) => ({ id: g.id, title: g.title, what: g.what, where: g.where, howLong: g.howLong, cost: g.cost, links: g.links, service: g.service ?? undefined })),
      },
      { after: `b-matrix-${entry.id}` },
    );
    pushScreen(s, {
      headline: `Rohan, ${entry.title.split(', ').pop() ?? 'RWTH'} fits: your 1.9 clears their 2.5. APS is the one thing that can make you miss the deadline.`,
    });
  } else pushScreen(s);
  refresh(id, ['shortlist', 'gaps']);
  say(s, 'agent', `I read ${host} and checked ${entry.title} against your profile: ${gapCount ? `${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}, each with a plan` : 'nothing missing'}. It’s at the top of your screen.`);
  status(id, 'idle');
}

function letterPayload(a: ApprovalDTO): { to: string; subject: string; body: string } {
  const p = a.payload;
  return {
    to: typeof p.to === 'string' ? p.to : 'employer@example.com',
    subject: typeof p.subject === 'string' ? p.subject : a.title,
    body: typeof p.body === 'string' ? p.body : '',
  };
}

function send(s: ApplicantState, a: ApprovalDetailDTO): void {
  const { to, subject, body } = letterPayload(a);
  a.status = 'sent';
  const email: EmailDTO = {
    id: uid('em'),
    direction: 'out',
    fromAddr: 'agent@educaro.local',
    toAddr: to,
    subject,
    text: body,
    threadKey: `thread-${a.id}`,
    classified: null,
    createdAt: nowIso(),
  };
  s.emails.push(email);
  trace(s.applicant.id, 'email', 'send_email', { to, subject, safeMode: true, redirectedTo: 'team inbox (Mailpit)' });
  const letters = s.screen.blocks.find((b): b is Extract<Block, { type: 'letters' }> => b.type === 'letters');
  if (letters)
    setBlock(s, { ...letters, title: 'Sent', body: 'Your Bewerbung is out. Replies land here and in your inbox.', drafts: letters.drafts.map((d) => (d.approvalId === a.id ? { ...d, status: 'sent' } : d)) });
  pushScreen(s);
  say(s, 'system', `Sent to ${to}, with you in CC. Replies come back to this thread.`);
  moveStage(s, 'matched', `${a.title}: sent. Waiting for a reply.`);
  refresh(s.applicant.id, ['approvals', 'emails']);
}

function employerReply(s: ApplicantState, kind: ReplyKind): void {
  const id = s.applicant.id;
  const out = [...s.emails].reverse().find((e) => e.direction === 'out' && !e.toAddr.endsWith('@example.com'));
  const from = out?.toAddr ?? 'bewerbung@rheinpflege.example';
  const employer = from.split('@')[1]?.split('.')[0] ?? 'employer';
  const Employer = employer.charAt(0).toUpperCase() + employer.slice(1);
  const when = new Date(Date.now() + 9 * DAY);
  when.setUTCHours(8, 0, 0, 0);
  const whenText = when.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const texts: Record<ReplyKind, { text: string; summary: string }> = {
    interview: {
      text: `Dear ${s.applicant.name},\n\nthank you for your application. We would like to invite you to a video interview on ${whenText} (German time). Please confirm by replying to this email.\n\nBest regards\nPersonalabteilung`,
      summary: `Interview invite: video call on ${whenText}, German time.`,
    },
    missing_paper: {
      text: `Dear ${s.applicant.name},\n\nthank you for your application. Before we can continue, please send a copy of your nursing council registration.\n\nBest regards`,
      summary: 'They need your nursing council registration before they continue.',
    },
    rejection: {
      text: `Dear ${s.applicant.name},\n\nthank you for your interest. We have filled this position and cannot consider your application further at this time.\n\nBest regards`,
      summary: 'This position is filled.',
    },
  };
  s.emails.push({
    id: uid('em'),
    direction: 'in',
    fromAddr: from,
    toAddr: 'agent@educaro.local',
    subject: `Re: ${out?.subject ?? 'Your application'}`,
    text: texts[kind].text,
    threadKey: out?.threadKey ?? uid('thread'),
    classified: { kind, summary: texts[kind].summary },
    createdAt: nowIso(),
  });
  trace(id, 'email', 'read_replies', { from, classified: kind });
  trace(id, 'llm', 'classify_reply', { tier: 'cheap', model: 'openai/gpt-oss-120b', kind }, 0);
  if (kind === 'interview') {
    const ev = { id: uid('ev'), title: `Interview with ${Employer} (video)`, kind: 'interview' as const, startsAt: when.toISOString(), durationMin: 45, location: 'Video call', description: texts.interview.summary };
    s.calendar.push(ev);
    trace(id, 'event', 'create_event', { title: ev.title, startsAt: ev.startsAt });
    setBlock(
      s,
      {
        id: `b-${id}-interview`,
        type: 'next_step',
        title: 'You have an interview',
        body: `${Employer} invited you to a video interview on ${whenText}, German time. It’s in your calendar. Practise with the interview coach first.`,
        actions: [
          { label: 'Practise now', kind: 'link', value: '/app/interview' },
          { label: 'What will they ask?', kind: 'chat', value: 'What will they ask in the interview?' },
        ],
        tags: ['verified'],
      },
      'top',
    );
    pushScreen(s, { headline: `${s.applicant.name.split(' ')[0]}, ${Employer} wants to meet you. Your interview is on ${whenText}.` });
    say(s, 'agent', `${Employer} replied with an interview invite for ${whenText}, German time. I added it to your calendar and set up a mock interview for you.`);
    say(s, 'agent', `📅 Interview booked: ${Employer}, ${whenText}. Good luck!`, 'discord');
    moveStage(s, 'matched', `Interview with ${Employer} on ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`);
    refresh(id, ['calendar']);
  } else if (kind === 'missing_paper') {
    setBlock(s, { id: `b-${id}-missing`, type: 'note', tone: 'warn', title: `${Employer} needs one more paper`, body: 'Upload your nursing council registration and I’ll send it to them for you, after you approve.' }, 'top');
    pushScreen(s);
    say(s, 'agent', `${Employer} asked for your nursing council registration. Upload it and I’ll prepare the reply for you to approve.`);
  } else {
    setBlock(s, { id: `b-${id}-filled`, type: 'note', tone: 'info', title: `${Employer} filled the role`, body: 'That happens. Next on your shortlist is Seniorenresidenz Lindenhof in Aachen. Want me to draft that Bewerbung?' }, 'top');
    pushScreen(s);
    say(s, 'agent', `${Employer} filled the role. Next on your list is Seniorenresidenz Lindenhof in Aachen. Shall I draft that one?`);
  }
  refresh(id, ['emails']);
}

// ---------- staff helpers ----------

function cardFor(s: ApplicantState): PipelineCardDTO {
  return {
    applicantId: s.applicant.id,
    name: s.applicant.name,
    subtitle: s.applicant.subtitle,
    route: s.applicant.route,
    stage: s.applicant.stage,
    stageReason: s.applicant.stageReason,
    readiness: s.readiness.overall,
    openGaps: s.gaps.filter((g) => g.status !== 'done').length,
    openQuestions: s.questions.filter((q) => q.status === 'open').length,
    pendingApprovals: s.approvals.filter((a) => a.status === 'pending').length,
    conflicts: s.truth.filter((r) => r.status === 'conflict').length,
    updatedAt: s.screen.updatedAt,
  };
}

function mailItems(): MailTrackerDetailDTO[] {
  const items: MailTrackerDetailDTO[] = [];
  for (const s of states.values())
    for (const e of s.emails) {
      const external = e.direction === 'out' && !e.toAddr.endsWith('@example.com');
      items.push({
        mailpitId: `mp-${e.id}`,
        direction: e.direction,
        from: e.fromAddr,
        to: external ? ['team-inbox@educaro.example'] : [e.toAddr],
        originalTo: [e.toAddr],
        subject: external ? `[safe mode → ${e.toAddr}] ${e.subject}` : e.subject,
        snippet: e.text.slice(0, 140),
        applicantId: s.applicant.id,
        applicantName: s.applicant.name,
        kind: e.direction === 'in' ? 'reply' : /three things/i.test(e.subject) ? 'digest' : 'application',
        safeRedirected: external,
        createdAt: e.createdAt,
        text: e.text,
        html: null,
        attachments: e.direction === 'out' && external ? [{ name: 'Lebenslauf.pdf', size: 84_000 }, { name: 'Diploma.pdf', size: 1_900_000 }] : [],
      });
    }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const ROUTE_WORDS: Record<string, string> = { nursing: 'nursing', study: 'Master’s', ausbildung: 'Ausbildung', skilled_job: 'skilled job', chancenkarte: 'Chancenkarte' };

// ---------- the Api ----------

export const mockApi: Api = {
  async register({ email, name }) {
    await latency();
    const applicantId = `app-${email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'new'}`;
    const user: MeDTO = { userId: `u-${applicantId}`, role: 'applicant', name: name || 'New applicant', email, applicantId };
    states.set(applicantId, freshState(applicantId, user.name, email));
    persist();
    return { token: encodeToken(user), user };
  },
  async login({ email }) {
    await latency();
    const user = Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new ApiError(401, 'Wrong email or password. In mock mode, use a demo account below.');
    return { token: encodeToken(user), user };
  },
  async demo(persona): Promise<AuthResponse> {
    await latency();
    const user = DEMO_USERS[persona];
    if (persona === 'fresh')  {
      // "Start from nothing" always starts from nothing, even after a reload.
      states.set(user.applicantId ?? 'app-fresh', freshState(user.applicantId ?? 'app-fresh', user.name, user.email));
      persist();
    }
    return { token: encodeToken(user), user };
  },
  async me() {
    await latency();
    return me();
  },

  async applicant(id) {
    await latency();
    return clone(state(id).applicant);
  },
  async screen(id) {
    await latency();
    const screen = clone(state(id).screen);
    // With the API running the composer rebuilds this block from the thread on every run. The mock
    // does the same here, so a post made in the demo shows up instead of a frozen fixture.
    screen.blocks = screen.blocks.map((b) =>
      b.type === 'community'
        ? {
            ...b,
            posts: thread.map((p) => ({
              id: p.id,
              author: p.author,
              authorKind: p.authorKind,
              text: p.text,
              createdAt: p.createdAt,
              replies: p.replies.length,
              viaDiscord: p.viaDiscord,
            })),
          }
        : b,
    );
    return screen;
  },
  async uploadVideo(id, video, filename, onProgress) {
    const s = state(id);
    for (let p = 0.1; p <= 1; p += 0.15) {
      onProgress?.(Math.min(p, 1));
      await wait(110);
    }
    onProgress?.(1);
    const file: FileDTO = { id: uid('f'), originalName: filename, mime: video.type || 'video/webm', size: video.size, kind: 'video', kindLabel: 'Intro video', status: 'queued', confidence: null, createdAt: nowIso() };
    uploadedBlobs.set(file.id, URL.createObjectURL(video));
    s.files = [file, ...s.files.filter((f) => f.kind !== 'video')];
    trace(id, 'event', 'upload', { video: filename, size: video.size });
    run(() => readFiles(s, [file.id]));
    return clone(file);
  },
  async uploadFiles(id, files, onProgress) {
    const s = state(id);
    for (let p = 0.2; p <= 1; p += 0.2) {
      onProgress?.(p);
      await wait(90);
    }
    onProgress?.(1);
    const added: FileDTO[] = files.map((f) => ({ id: uid('f'), originalName: f.name, mime: f.type || 'application/octet-stream', size: f.size, kind: 'other', kindLabel: null, status: 'queued', confidence: null, createdAt: nowIso() }));
    added.forEach((f, i) => uploadedBlobs.set(f.id, URL.createObjectURL(files[i])));
    s.files = [...s.files, ...added];
    trace(id, 'event', 'upload', { files: added.length });
    refresh(id, ['files']);
    run(() => readFiles(s, added.map((f) => f.id)));
    return clone(added);
  },
  async files(id) {
    await latency();
    return clone(state(id).files);
  },
  async transcript(id) {
    await latency();
    return clone(state(id).transcript);
  },
  async facts(id) {
    await latency();
    return clone(state(id).facts);
  },
  async truthMap(id) {
    await latency();
    return clone(state(id).truth);
  },
  async questions(id) {
    await latency();
    const qs = state(id).questions;
    return clone([...qs.filter((q) => q.status === 'open'), ...qs.filter((q) => q.status !== 'open')]);
  },
  async answerQuestion(questionId, answer) {
    await latency();
    for (const s of states.values()) {
      const q = s.questions.find((x) => x.id === questionId);
      if (!q) continue;
      state(s.applicant.id);
      q.status = 'answered';
      q.answer = answer;
      trace(s.applicant.id, 'event', 'answer', { questionId, answer });
      run(async () => {
        status(s.applicant.id, 'thinking');
        await wait(700);
        questionAnswered(s, questionId, answer);
        status(s.applicant.id, 'idle');
      });
      return clone(q);
    }
    throw new ApiError(404, 'That question was already closed.');
  },
  async chat(id) {
    await latency();
    return clone(state(id).chat);
  },
  async sendChat(id, text) {
    await latency();
    const s = state(id);
    const author = me().role === 'staff' ? 'staff' : 'applicant';
    const message = say(s, author, text);
    trace(id, 'event', 'chat', { chars: text.length });
    if (author === 'applicant') run(() => agentAnswer(s, text));
    return clone(message);
  },
  async sendVoiceNote(id, audio) {
    await wait(600);
    const s = state(id);
    const seconds = Math.max(1, Math.round(audio.size / 16_000));
    trace(id, 'tool', 'transcribe_media', { kind: 'voice note', seconds, provider: 'mock' });
    const message = say(s, 'applicant', `🎤 Voice note, about ${seconds}s. (Mock mode has no transcription. With the API running, Whisper writes what you said here.)`);
    run(() => agentAnswer(s, ''));
    return clone(message);
  },
  async setRoute(id, route) {
    await latency();
    const s = state(id);
    const prev = s.applicant.route;
    s.applicant = { ...s.applicant, route, routeAlternatives: [prev, ...s.applicant.routeAlternatives].filter((r): r is NonNullable<typeof r> => !!r && r !== route) };
    const routeBlock = s.screen.blocks.find((b): b is Extract<Block, { type: 'route' }> => b.type === 'route');
    if (routeBlock) setBlock(s, { ...routeBlock, primary: route, alternatives: s.applicant.routeAlternatives });
    pushScreen(s);
    trace(id, 'event', 'route_set', { from: prev, to: route });
    run(async () => {
      status(id, 'thinking');
      await wait(900);
      say(s, 'agent', `Switched your route to ${ROUTE_WORDS[route] ?? route}. I’ll re-run the checks for it and update your plan.`);
      status(id, 'idle');
    });
    return clone(s.applicant);
  },
  async shortlist(id) {
    await latency();
    return clone(state(id).shortlist);
  },
  async addShortlist(id, input: ShortlistInput) {
    await latency();
    const s = state(id);
    const opp = s.screen.blocks
      .filter((b): b is Extract<Block, { type: 'opportunities' }> => b.type === 'opportunities')
      .flatMap((b) => b.items)
      .find((it) => it.id === input.programmeId || it.id === input.openingId);
    const isRwth = input.programmeId === 'prog-rwth-ds' || /rwth/i.test(input.url ?? '');
    const base = isRwth ? RWTH_SHORTLIST : null;
    let host = input.url ?? '';
    try {
      host = new URL(input.url ?? '').hostname.replace(/^www\./, '');
    } catch {
      /* not a URL */
    }
    const entry: ShortlistDTO = {
      id: uid('sl'),
      kind: input.openingId || opp?.kind === 'opening' ? 'opening' : 'programme',
      title: base?.title ?? opp?.title ?? `Programme at ${host || 'your link'}`,
      subtitle: base?.subtitle ?? opp?.subtitle ?? 'Pasted link',
      url: base?.url ?? opp?.url ?? input.url ?? '',
      status: 'checking',
      gapCount: 0,
      matrix: null,
      createdAt: nowIso(),
    };
    s.shortlist = [...s.shortlist, entry];
    s.screen = {
      ...s.screen,
      blocks: s.screen.blocks.map((b) =>
        b.type === 'opportunities' ? { ...b, items: b.items.map((it) => (it.id === opp?.id ? { ...it, shortlisted: true } : it)) } : b,
      ),
    };
    const sl = s.screen.blocks.find((b): b is Extract<Block, { type: 'shortlist' }> => b.type === 'shortlist');
    const item = { id: entry.id, title: entry.title, subtitle: entry.subtitle, status: 'checking' as const, gapCount: 0, url: entry.url };
    if (sl) setBlock(s, { ...sl, items: [...sl.items, item] });
    else setBlock(s, { id: `b-${id}-shortlist`, type: 'shortlist', title: 'Your shortlist', items: [item] }, 'afterNext');
    pushScreen(s);
    trace(id, 'event', 'shortlist', { title: entry.title, url: entry.url });
    refresh(id, ['shortlist']);
    run(() => checkShortlist(s, entry, base));
    return clone(entry);
  },
  async removeShortlist(shortlistId) {
    await latency();
    for (const s of states.values()) {
      if (!s.shortlist.some((x) => x.id === shortlistId)) continue;
      s.shortlist = s.shortlist.filter((x) => x.id !== shortlistId);
      dropBlock(s, (b) => b.type === 'requirement_matrix' && b.shortlistId === shortlistId);
      s.screen = { ...s.screen, blocks: s.screen.blocks.map((b) => (b.type === 'shortlist' ? { ...b, items: b.items.filter((it) => it.id !== shortlistId) } : b)) };
      pushScreen(s);
      refresh(s.applicant.id, ['shortlist']);
    }
    return { ok: true };
  },
  async gaps(id) {
    await latency();
    return clone(state(id).gaps);
  },
  async readiness(id) {
    await latency();
    return clone(state(id).readiness);
  },
  async approvals(id) {
    await latency();
    return clone(state(id).approvals.map(({ facts: _facts, ...a }) => a));
  },
  async approval(approvalId) {
    await latency();
    const { s, a } = findApproval(approvalId);
    state(s.applicant.id);
    return clone(a);
  },
  async approve(approvalId, edits) {
    await latency();
    const { s, a } = findApproval(approvalId);
    const user = me();
    state(s.applicant.id);
    if (edits?.subject !== undefined) a.payload = { ...a.payload, subject: edits.subject };
    if (edits?.body !== undefined) a.payload = { ...a.payload, body: edits.body };
    if (user.role === 'staff') a.staffApprovedAt = nowIso();
    else a.applicantApprovedAt = nowIso();
    trace(s.applicant.id, 'approval', 'approve', { approvalId, by: user.role, edited: Boolean(edits?.subject !== undefined || edits?.body !== undefined) });
    const needsStaff = a.needsStaff || s.applicant.staffSecondKey;
    if (needsStaff && !a.staffApprovedAt) {
      a.status = 'approved';
      say(s, 'system', 'Approved by you. An Educaro staff member gives the second approval, then it goes out.');
      refresh(s.applicant.id, ['approvals', 'queue']);
    } else if (a.kind === 'email') {
      send(s, a);
    } else {
      a.status = 'sent';
      refresh(s.applicant.id, ['approvals']);
    }
    const { facts: _facts, ...dto } = a;
    return clone(dto);
  },
  async reject(approvalId) {
    await latency();
    const { s, a } = findApproval(approvalId);
    state(s.applicant.id);
    a.status = 'rejected';
    trace(s.applicant.id, 'approval', 'reject', { approvalId, by: me().role });
    say(s, 'agent', 'Understood, I won’t send it. Tell me what to change and I’ll draft it again.');
    const letters = s.screen.blocks.find((b): b is Extract<Block, { type: 'letters' }> => b.type === 'letters');
    if (letters) setBlock(s, { ...letters, drafts: letters.drafts.map((d) => (d.approvalId === approvalId ? { ...d, status: 'rejected' } : d)) });
    pushScreen(s);
    refresh(s.applicant.id, ['approvals']);
    const { facts: _facts, ...dto } = a;
    return clone(dto);
  },
  async submit(id) {
    await latency();
    const s = state(id);
    s.applicant = { ...s.applicant, submittedAt: nowIso() };
    trace(id, 'approval', 'submit_to_educaro', { waitsFor: 'staff' });
    say(s, 'system', 'Sent to Educaro. A staff member checks your profile and approves it, usually within a day.');
    refresh(id, ['applicant', 'queue']);
    return clone(s.applicant);
  },
  async emails(id) {
    await latency();
    return clone(state(id).emails);
  },
  async calendar(id) {
    await latency();
    return clone([...state(id).calendar].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  },
  async startInterview(id, kind) {
    await latency();
    state(id);
    const dto: InterviewDTO = { id: uid('iv'), kind, status: 'active', turns: [{ role: 'coach', text: INTERVIEW_QUESTIONS[kind][0] }] };
    interviews.set(dto.id, { applicantId: id, dto, asked: 1 });
    trace(id, 'tool', 'run_specialist', { specialist: 'interview_coach', kind });
    return clone(dto);
  },
  async answerInterview(sessionId, text) {
    await wait(700);
    const session = interviews.get(sessionId);
    if (!session) throw new ApiError(404, 'That practice session ended. Start a new one.');
    state(session.applicantId);
    const { score, feedback } = scoreAnswer(text);
    session.dto.turns.push({ role: 'applicant', text, score, feedback });
    const questions = INTERVIEW_QUESTIONS[session.dto.kind];
    if (session.asked < questions.length) {
      session.dto.turns.push({ role: 'coach', text: questions[session.asked] });
      session.asked += 1;
    } else {
      const scores = session.dto.turns.flatMap((t) => (t.score ? [t.score] : []));
      const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
      session.dto.turns.push({ role: 'coach', text: `That’s the set. Average ${avg.toFixed(1)} out of 5. Practise the lowest one again tomorrow, out loud.` });
      session.dto.status = 'done';
    }
    trace(session.applicantId, 'llm', 'interview_score', { tier: 'cheap', model: 'openai/gpt-oss-120b', score }, 0);
    return clone(session.dto);
  },
  async rentals(id) {
    await latency();
    const s = state(id);
    return rentalsFor(s.applicant.targetCity ?? 'Cologne');
  },
  async cohort(id) {
    await latency();
    state(id);
    return clone(nursingCohort);
  },
  async community() {
    await latency();
    return clone(thread);
  },
  async postToCommunity({ text, applicantId }) {
    await latency();
    const s = state(applicantId);
    const post: CommunityPostDTO = {
      id: `cp-${Date.now()}`,
      channel: thread[0]?.channel ?? 'koeln-pflege-sep27',
      author: s.applicant.name,
      authorKind: 'applicant',
      applicantId,
      text,
      viaDiscord: false,
      replies: [],
      createdAt: new Date().toISOString(),
    };
    thread.push(post);
    trace(applicantId, 'tool', 'discord_post', { channel: post.channel, chars: text.length });
    return clone(post);
  },
  async replyInCommunity(postId, text) {
    await latency();
    const parent = thread.find((p) => p.id === postId);
    if (!parent) throw new ApiError(404, 'That post is gone.', null);
    const reply: CommunityPostDTO = {
      id: `cp-${Date.now()}`,
      channel: parent.channel,
      author: 'You',
      authorKind: 'applicant',
      applicantId: parent.applicantId,
      text,
      viaDiscord: false,
      replies: [],
      createdAt: new Date().toISOString(),
    };
    parent.replies.push(reply);
    return clone(reply);
  },
  async discordLink(id) {
    await latency();
    state(id);
    return { code: `EDU-${Math.floor(1000 + Math.random() * 9000)}` };
  },
  async germany(id, input) {
    await latency();
    const s = state(id);
    s.applicant = { ...s.applicant, mode: 'germany', targetCity: input.city };
    moveStage(s, 'visa', `Visa granted. Germany mode for ${input.city}.`);
    run(async () => {
      status(id, 'working', `Finding places near you in ${input.city}`);
      trace(id, 'source', 'places_nearby', { provider: 'OpenStreetMap Overpass', city: input.city });
      await wait(1500);
      const screen = germanyScreen(s, input.city);
      s.screen = { ...screen, version: s.screen.version };
      pushScreen(s);
      say(s, 'agent', `Congratulations! Your screen is now set up for ${input.city}: what to pack, the first two weeks, places near you and real numbers.`);
      status(id, 'idle');
    });
    return clone(s.applicant);
  },

  async pipeline() {
    await latency();
    requireStaff();
    return [...[...states.values()].map(cardFor), ...otherCards.values()].map((c) => clone(c));
  },
  async setStage(id, stage, reason) {
    await latency();
    requireStaff();
    const s = states.get(id);
    if (s) {
      moveStage(s, stage, reason, 'staff');
      return cardFor(s);
    }
    const card = otherCards.get(id);
    if (!card) throw new ApiError(404, 'Applicant not found.');
    Object.assign(card, { stage, stageReason: reason, updatedAt: nowIso() });
    trace(id, 'move', 'stage', { to: stage, reason, by: 'staff' });
    emit({ type: 'pipeline', applicantId: id, stage, reason });
    return clone(card);
  },
  async approveSubmission(id) {
    await latency();
    const staff = requireStaff();
    const s = state(id);
    s.applicant = { ...s.applicant, approvedByStaffAt: nowIso() };
    trace(id, 'approval', 'approve_submission', { by: staff.name });
    say(s, 'staff', `Hi ${s.applicant.name.split(' ')[0]}, I’m ${staff.name.split(' ')[0]} from Educaro. I checked your profile and approved it. Your consultant will be in touch this week.`);
    moveStage(s, 'ready', `Approved by ${staff.name}.`, 'staff');
    refresh(id, ['applicant', 'queue']);
    return clone(s.applicant);
  },
  async setSettings(id, settings) {
    await latency();
    requireStaff();
    const s = state(id);
    s.applicant = { ...s.applicant, staffSecondKey: settings.staffSecondKey };
    trace(id, 'guard', 'second_key', { on: settings.staffSecondKey, by: 'staff' });
    refresh(id, ['applicant']);
    return clone(s.applicant);
  },
  async brief(id): Promise<BriefDTO> {
    await latency();
    requireStaff();
    const s = states.get(id);
    if (!s) {
      const card = otherCards.get(id);
      return {
        applicantId: id,
        who: card ? `${card.name}, ${card.subtitle ?? ''}.` : 'Applicant',
        route: card?.route ?? 'Not set',
        openGaps: card?.openGaps ? ['See the gap plan'] : [],
        agentTried: [card?.stageReason ?? 'Profile in progress.'],
        questionsToAsk: ['What would make you start sooner?'],
        bookedFor: consultantBookings.get(id) ?? null,
      };
    }
    const isAnanya = id === ANANYA_ID;
    return {
      applicantId: id,
      who: isAnanya
        ? 'Ananya Nair, GNM nurse from Kochi. Three years at Aster Medcity, mostly geriatric ward. Sister in Cologne.'
        : id === ROHAN_ID
          ? 'Rohan Mehta, B.Tech CS (Pune, 2025), CGPA 8.2 = German 1.9. Six-month ML internship. Wants a Master’s in data science.'
          : `${s.applicant.name}. New profile.`,
      route: isAnanya ? 'Nursing with Anerkennung, Cologne' : id === ROHAN_ID ? 'Master’s in Germany, winter intake' : 'Not set yet',
      openGaps: s.gaps.filter((g) => g.status !== 'done').map((g) => g.title),
      agentTried: isAnanya
        ? ['Asked about the experience dates and the diploma name (2 questions open)', 'Routed German to the Educaro B1 batch, ÖSD in February', 'Drafted a Bewerbung to Rheinpflege; waiting for her approval']
        : id === ROHAN_ID
          ? ['Converted the grade in code (1.9)', 'Asked for the IELTS report', 'Built matrices for TUM and TU Darmstadt; APS blocks both']
          : ['Read the uploaded files'],
      questionsToAsk: isAnanya
        ? ['Can you get a copy of your KNMC registration before December?', 'Is your A2 from a course with a certificate, or self-study?', 'Would you take a nursing-assistant job in Aachen while recognition finishes?']
        : id === ROHAN_ID
          ? ['Have you sat IELTS, or only planned it?', 'Can your family show the blocked account amount by March?', 'Is Munich a must, or is Aachen fine?']
          : ['What do you want to do in Germany?'],
      bookedFor: consultantBookings.get(id) ?? null,
    };
  },
  async bookConsultant(id, when) {
    await latency();
    const staff = requireStaff();
    const at = when ?? new Date(Date.now() + 2 * DAY + 3 * HOUR).toISOString();
    consultantBookings.set(id, at);
    const s = states.get(id);
    if (s) {
      s.calendar.push({ id: uid('ev'), title: `Consultant call with ${staff.name}`, kind: 'event', startsAt: at, durationMin: 30, location: 'Video call', description: 'Your consultant has your brief already.' });
      say(s, 'staff', `I booked a 30-minute call with you for ${new Date(at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. The invite is in your calendar.`);
      trace(id, 'event', 'book_consultant', { at, staff: staff.name });
      refresh(id, ['calendar']);
    }
    return mockApi.brief(id);
  },
  async queue() {
    await latency();
    requireStaff();
    const items: StaffQueueItemDTO[] = [];
    for (const s of states.values()) {
      for (const a of s.approvals)
        if ((a.status === 'pending' && a.needsStaff) || (a.status === 'approved' && !a.staffApprovedAt))
          items.push({ id: `q-${a.id}`, kind: 'approval', applicantId: s.applicant.id, applicantName: s.applicant.name, title: a.title, detail: a.applicantApprovedAt ? 'Applicant approved. Needs the staff second key.' : 'Waiting for the applicant and for you.', refId: a.id, createdAt: a.createdAt });
      if (s.applicant.submittedAt && !s.applicant.approvedByStaffAt)
        items.push({ id: `q-sub-${s.applicant.id}`, kind: 'submission', applicantId: s.applicant.id, applicantName: s.applicant.name, title: 'Submit to Educaro', detail: `Readiness ${s.readiness.overall}%. ${s.gaps.filter((g) => g.status !== 'done').length} gaps, each with a plan.`, refId: null, createdAt: s.applicant.submittedAt });
    }
    items.push(
      { id: 'q-arjun-read', kind: 'low_confidence_read', applicantId: 'app-arjun', applicantName: 'Arjun Reddy', title: 'Unclear photo: class 10 marksheet', detail: 'Confidence 0.41. The agent asked him to retake it and did not guess.', refId: null, createdAt: new Date(Date.now() - 50 * 60_000).toISOString() },
      { id: 'q-vikram-conflict', kind: 'unproved_conflict', applicantId: 'app-vikram', applicantName: 'Vikram Singh', title: 'Graduation year: CV 2019, degree 2020', detail: 'He explained a delayed convocation in chat. Not proved by a document.', refId: null, createdAt: new Date(Date.now() - 3 * HOUR).toISOString() },
      { id: 'q-joseph-esc', kind: 'escalation', applicantId: 'app-joseph', applicantName: 'Joseph Mathew', title: 'Asked about a past visa refusal', detail: 'The agent must not answer this alone. A consultant should call him.', refId: null, createdAt: new Date(Date.now() - 5 * HOUR).toISOString() },
    );
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async copilot(query) {
    await wait(900);
    requireStaff();
    trace(null, 'llm', 'copilot', { query, tier: 'cheap', model: 'openai/gpt-oss-120b' }, 0);
    return copilotAnswer(query);
  },
  async openings() {
    await latency();
    requireStaff();
    return clone(openings);
  },
  async createOpening(input) {
    await latency();
    requireStaff();
    const words = input.description.toLowerCase().match(/[a-zäöüß-]{6,}/g) ?? [];
    const opening: OpeningDTO = { ...input, id: uid('open'), keywords: [...new Set([input.germanLevel, ...words])].slice(0, 6), status: 'open', createdAt: nowIso() };
    openings.unshift(opening);
    trace(null, 'event', 'opening_posted', { employer: input.employer, title: input.title });
    return clone(opening);
  },
  async matchOpening(openingId) {
    await wait(1200);
    requireStaff();
    const list = matchesByOpening.get(openingId) ?? rankedMatches(openingId);
    matchesByOpening.set(openingId, list);
    trace(null, 'tool', 'match_openings', { openingId, passedHardFilter: list.length, by: 'code + cheap model for reasons' });
    return clone(list);
  },
  async matches(openingId) {
    await latency();
    requireStaff();
    return clone(matchesByOpening.get(openingId) ?? []);
  },
  async buildProfile(matchId) {
    await wait(1100);
    requireStaff();
    for (const list of matchesByOpening.values()) {
      const m = list.find((x) => x.id === matchId);
      if (!m) continue;
      m.germanProfile = germanProfile(m);
      m.status = 'profile_ready';
      trace(m.applicantId, 'llm', 'german_profile', { tier: 'quality', model: 'gpt-5-mini', anonymised: !m.consent }, 0.0036);
      return clone(m);
    }
    throw new ApiError(404, 'Match not found.');
  },
  async sendMatch(matchId) {
    await latency();
    const staff = requireStaff();
    for (const [openingId, list] of matchesByOpening) {
      const m = list.find((x) => x.id === matchId);
      if (!m) continue;
      const opening = openings.find((o) => o.id === openingId);
      m.status = 'sent';
      const approval: ApprovalDTO = {
        id: uid('appr'),
        applicantId: m.applicantId,
        kind: 'employer_profile',
        title: `Profile to ${opening?.employer ?? 'employer'}`,
        payload: { to: opening?.employerEmail ?? '', profile: m.germanProfile ?? {} },
        status: 'sent',
        needsStaff: true,
        applicantApprovedAt: null,
        staffApprovedAt: nowIso(),
        createdAt: nowIso(),
      };
      trace(m.applicantId, 'email', 'send_email', { to: opening?.employerEmail, kind: 'employer_profile', approvedBy: staff.name, safeMode: true });
      const s = states.get(m.applicantId);
      if (s) say(s, 'agent', `Educaro sent your profile to ${opening?.employer ?? 'an employer'} for the ${opening?.title ?? 'opening'} role.`);
      run(async () => {
        await wait(5000);
        m.status = 'interview';
        refresh(m.applicantId, ['matches']);
        if (s) employerReply(s, 'interview');
      });
      return approval;
    }
    throw new ApiError(404, 'Match not found.');
  },
  async batchPlanner() {
    await latency();
    requireStaff();
    return clone(BATCH_PLAN);
  },
  async broadcasts() {
    await latency();
    requireStaff();
    return clone(broadcasts);
  },
  async createBroadcast(topic) {
    await wait(1100);
    requireStaff();
    const people: Pick<ApplicantDTO, 'id' | 'name' | 'route'>[] = [...[...states.values()].map((s) => s.applicant), { id: 'app-karthik', name: 'Karthik Iyer', route: 'ausbildung' }];
    const b: BroadcastDTO = {
      id: uid('bc'),
      topic,
      status: 'draft',
      createdAt: nowIso(),
      messages: people.map((p) => ({ applicantId: p.id, name: p.name, text: `${p.name.split(' ')[0]}, quick update: ${topic.charAt(0).toLowerCase()}${topic.slice(1)}. ${p.route === 'study' ? 'This touches your shortlist; I’ll recheck the matrix.' : 'I’ll update your plan if it changes anything for you.'}` })),
    };
    broadcasts.unshift(b);
    trace(null, 'llm', 'broadcast_draft', { topic, people: b.messages.length, tier: 'cheap' }, 0);
    return clone(b);
  },
  async approveBroadcast(id) {
    await latency();
    requireStaff();
    const b = broadcasts.find((x) => x.id === id);
    if (!b) throw new ApiError(404, 'Broadcast not found.');
    b.status = 'sent';
    for (const m of b.messages) {
      const s = states.get(m.applicantId);
      if (s) say(s, 'agent', m.text);
    }
    trace(null, 'approval', 'broadcast_sent', { id, people: b.messages.length });
    return clone(b);
  },
  async trace(params) {
    await latency();
    requireStaff();
    const all = params?.applicantId ? (states.get(params.applicantId)?.trace ?? []) : [...[...states.values()].flatMap((s) => s.trace), ...globalTrace];
    return clone([...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, params?.limit ?? 300));
  },
  async mailTracker(params) {
    await latency();
    requireStaff();
    return mailItems()
      .filter((m) => !params?.applicantId || m.applicantId === params.applicantId)
      .slice(0, params?.limit ?? 100)
      .map(({ text: _t, html: _h, attachments: _a, ...item }): MailTrackerItemDTO => item);
  },
  async mailTrackerDetail(mailpitId) {
    await latency();
    requireStaff();
    const item = mailItems().find((m) => m.mailpitId === mailpitId);
    if (!item) throw new ApiError(404, 'Mail not found in the tracker.');
    return item;
  },
  async stats() {
    await latency();
    requireStaff();
    const status = await mockApi.systemStatus();
    return {
      llm: status.llm,
      applicants: states.size + otherCards.size,
      costPerApplicant: [...states.values()].map((s) => ({
        applicantId: s.applicant.id,
        name: s.applicant.name,
        costUsd: s.trace.reduce((sum, t) => sum + t.costUsd, 0),
        llmCalls: s.trace.filter((t) => t.kind === 'llm' || t.costUsd > 0).length,
        cachedCalls: s.trace.filter((t) => t.detail.cached === true).length,
      })),
    };
  },
  async simulateReply(applicantId, kind) {
    await latency();
    requireStaff();
    const s = states.get(applicantId);
    if (!s) throw new ApiError(404, 'Pick Ananya or Rohan for the demo reply.');
    run(async () => {
      status(applicantId, 'working', 'Reading a new email');
      await wait(1200);
      employerReply(s, kind);
      status(applicantId, 'idle');
    });
    return { ok: true };
  },
  async systemStatus(): Promise<SystemStatusDTO> {
    await latency();
    return {
      llm: { groq: true, openai: true, openaiModel: 'gpt-5-mini', groqModel: 'openai/gpt-oss-120b', openaiSpentUsd: Math.round(openaiSpent * 10000) / 10000, openaiBudgetUsd: 40 },
      discord: false,
      mailpitUrl: 'http://localhost:8025',
    };
  },
};

// ---------- interview coach ----------

const INTERVIEW_QUESTIONS: Record<InterviewDTO['kind'], string[]> = {
  employer: [
    'Tell me about yourself, and why elderly care in Germany?',
    'A resident with dementia refuses her medication. What do you do?',
    'Your shift is two people short. How do you decide what comes first?',
    'Why our home, and why Cologne?',
  ],
  visa: [
    'Why do you want to go to Germany?',
    'Who pays for your stay until your first salary?',
    'What happens if your recognition takes longer than planned?',
    'Do you have family in Germany? What do they do?',
  ],
  university: [
    'Why this programme and not one in India?',
    'Tell me about your machine learning internship. What did you build?',
    'How will you fund your studies?',
    'What do you want to do after your Master’s?',
  ],
};

function scoreAnswer(text: string): { score: number; feedback: string } {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const concrete = /\d|year|month|ward|patient|project|team|because|for example/i.test(text);
  let score = words < 8 ? 2 : words < 25 ? 3 : 4;
  if (concrete) score += 1;
  score = Math.min(5, score);
  const feedback =
    score >= 5
      ? 'Clear and concrete. Keep this one.'
      : score === 4
        ? 'Good. Add one real example with a number or a date.'
        : score === 3
          ? 'Too general. Say what you did, where, and what happened.'
          : 'Too short. Aim for three or four sentences with one example.';
  return { score, feedback };
}

// ---------- demo helpers (mock mode only) ----------

export const mockDemo = {
  replayIntake: (applicantId: string) => run(() => replayIntake(applicantId)),
  employerReply: (applicantId: string, kind: ReplyKind) => {
    const s = states.get(applicantId);
    if (!s) return;
    run(async () => {
      status(applicantId, 'working', 'Reading a new email');
      await wait(1200);
      employerReply(s, kind);
      status(applicantId, 'idle');
    });
  },
};

// ---------- links (mock mode) ----------

const docCache = new Map<string, string>();

function packHtml(s: ApplicantState, kind: string): string {
  const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  const rows = s.truth.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.video ?? '')}</td><td>${esc(r.cv ?? '')}</td><td>${esc(r.document ?? '')}</td><td>${r.status}</td></tr>`).join('');
  const gaps = s.gaps.map((g) => `<li><b>${esc(g.title)}</b>: ${esc(g.what)} (${esc(g.howLong)})</li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${kind} · ${esc(s.applicant.name)}</title><style>body{font:15px/1.5 system-ui;max-width:760px;margin:40px auto;padding:0 16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}</style><h1>${kind === 'lebenslauf' ? 'Lebenslauf' : 'Final pack'}: ${esc(s.applicant.name)}</h1><p>Mock mode preview. With the API running this is a PDF or DOCX built on the server.</p><h2>Truth map</h2><table><tr><th>Fact</th><th>Video</th><th>CV</th><th>Document</th><th>Result</th></tr>${rows}</table><h2>Gap plans</h2><ul>${gaps}</ul>`;
}

export const mockLinks = {
  file: (fileId: string): string | null => uploadedBlobs.get(fileId) ?? null,
  document: (applicantId: string, kind: string, format: string): string => {
    const key = `${applicantId}:${kind}:${format}`;
    const cached = docCache.get(key);
    if (cached) return cached;
    const s = states.get(applicantId);
    const url = URL.createObjectURL(new Blob([s ? packHtml(s, kind) : 'Not found'], { type: 'text/html' }));
    docCache.set(key, url);
    return url;
  },
  ics: (eventId: string): string => {
    const ev = [...states.values()].flatMap((s) => s.calendar).find((e) => e.id === eventId);
    const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const start = ev?.startsAt ?? new Date().toISOString();
    const end = new Date(Date.parse(start) + (ev?.durationMin ?? 30) * 60_000).toISOString();
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Educaro//Applicant Flow v2//EN',
      'BEGIN:VEVENT',
      `UID:${eventId}@educaro.local`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${ev?.title ?? 'Educaro event'}`,
      ev?.location ? `LOCATION:${ev.location}` : '',
      ev?.description ? `DESCRIPTION:${ev.description}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
    return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  },
};
