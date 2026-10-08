import clsx from 'clsx';
import type { ItemStatus, MatrixStatus, PipelineStage, Route, Tag, TruthStatus } from '@educaro/shared';
import { ROUTE_LABEL, TAG_LABEL } from '@educaro/shared';
import { Loader2 } from 'lucide-react';

const TAG_CLASS: Record<Tag, string> = { verified: 't-ver', said: 't-said', web: 't-web', ai: 't-ai' };

export function FactTag({ tag, className }: { tag: Tag; className?: string }) {
  return (
    <span className={clsx('tag', TAG_CLASS[tag] ?? 't-neutral', className)} title={TAG_HELP[tag]}>
      {TAG_LABEL[tag] ?? tag}
    </span>
  );
}

export const TAG_HELP: Record<Tag, string> = {
  verified: 'Proved by one of your documents',
  said: 'From your video or CV, not yet proved by a document',
  web: 'From an official page the agent opened, with a link',
  ai: 'Written or planned by the agent',
};

export function TagLegend({ className }: { className?: string }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-1.5', className)} aria-label="Field tags">
      {(['verified', 'said', 'web', 'ai'] as const).map((t) => (
        <FactTag key={t} tag={t} />
      ))}
    </div>
  );
}

const ITEM: Record<ItemStatus, [string, string]> = {
  verified: ['t-ver', 'Verified'],
  missing: ['t-warn', 'Missing'],
  planned: ['t-ai', 'Planned'],
  pending: ['t-warn', 'Pending'],
  said: ['t-said', 'You said'],
  ready: ['t-ver', 'Ready'],
  gaps: ['t-warn', 'Gaps'],
  checking: ['t-web', 'Checking'],
};
export function ItemStatusTag({ status, gapCount, className }: { status: ItemStatus; gapCount?: number; className?: string }) {
  const [cls, label] = ITEM[status] ?? ['t-neutral', status];
  const text = status === 'gaps' && gapCount !== undefined ? `${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}` : label;
  return (
    <span className={clsx('tag', cls, className)}>
      {status === 'checking' && <Loader2 className="anim-spin size-3" aria-hidden />}
      {text}
    </span>
  );
}

const MATRIX: Record<MatrixStatus, [string, string]> = {
  meets: ['t-ver', 'Meets'],
  missing: ['t-bad', 'Missing'],
  pending: ['t-warn', 'Pending'],
  start_now: ['t-bad', 'Start now'],
  info: ['t-web', 'Info'],
  not_needed: ['t-ver', 'Not needed'],
};
export function MatrixStatusTag({ status, className }: { status: MatrixStatus; className?: string }) {
  const [cls, label] = MATRIX[status] ?? ['t-neutral', status];
  return <span className={clsx('tag', cls, className)}>{label}</span>;
}

const TRUTH: Record<TruthStatus, [string, string]> = {
  verified: ['t-ver', 'Verified'],
  conflict: ['t-bad', 'Conflict'],
  no_proof: ['t-warn', 'No proof yet'],
  said: ['t-said', 'You said'],
};
export function TruthStatusTag({ status, className }: { status: TruthStatus; className?: string }) {
  const [cls, label] = TRUTH[status] ?? ['t-neutral', status];
  return <span className={clsx('tag', cls, className)}>{label}</span>;
}

export type FileStatus = 'queued' | 'reading' | 'done' | 'unclear';
const FILE: Record<FileStatus, [string, string]> = {
  queued: ['t-neutral', 'Queued'],
  reading: ['t-web', 'Reading'],
  done: ['t-ver', 'Read'],
  unclear: ['t-warn', 'Unclear'],
};
export function FileStatusTag({ status, className }: { status: FileStatus; className?: string }) {
  const [cls, label] = FILE[status] ?? ['t-neutral', status];
  return (
    <span className={clsx('tag', cls, className)}>
      {status === 'reading' && <Loader2 className="anim-spin size-3" aria-hidden />}
      {label}
    </span>
  );
}

export type ExamStatus = 'done' | 'pending' | 'not_started' | 'not_needed';
const EXAM: Record<ExamStatus, [string, string]> = {
  done: ['t-ver', 'done'],
  pending: ['t-warn', 'pending'],
  not_started: ['t-bad', 'not started'],
  not_needed: ['t-ver', 'not needed'],
};
export function ExamTag({ name, status }: { name: string; status: ExamStatus }) {
  const [cls, label] = EXAM[status] ?? ['t-neutral', status];
  return (
    <span className={clsx('tag', cls)}>
      {name}: {label}
    </span>
  );
}

export type Outcome = 'ready' | 'ready_after_plan' | 'better_route';
const OUTCOME: Record<Outcome, [string, string]> = {
  ready: ['t-ver', 'Ready'],
  ready_after_plan: ['t-warn', 'Ready after the plan'],
  better_route: ['t-web', 'Better route found'],
};
export function OutcomeTag({ outcome, className }: { outcome: Outcome; className?: string }) {
  const [cls, label] = OUTCOME[outcome] ?? ['t-neutral', outcome];
  return <span className={clsx('tag', cls, className)}>{label}</span>;
}
export function outcomeLabel(o: Outcome): string {
  return OUTCOME[o]?.[1] ?? o;
}

const ROUTE_CHIP: Record<Route, string> = {
  nursing: 'c-applicant',
  study: 'c-agent',
  ausbildung: 'c-loop',
  skilled_job: 'c-staff',
  chancenkarte: 'c-outside',
};
export const ROUTE_SHORT: Record<Route, string> = {
  study: 'Study',
  ausbildung: 'Ausbildung',
  nursing: 'Nursing',
  skilled_job: 'Skilled job',
  chancenkarte: 'Chancenkarte',
};
export function RouteChip({ route, short, className }: { route: Route | null; short?: boolean; className?: string }) {
  if (!route) return <span className={clsx('chip', className)}>Route open</span>;
  return (
    <span className={clsx('chip', ROUTE_CHIP[route] ?? '', className)}>{short ? ROUTE_SHORT[route] : ROUTE_LABEL[route]}</span>
  );
}
export function routeColorVar(route: Route | null | undefined): string {
  switch (route) {
    case 'nursing':
      return 'var(--applicant)';
    case 'study':
      return 'var(--agent)';
    case 'ausbildung':
      return 'var(--loop)';
    case 'skilled_job':
      return 'var(--staff)';
    case 'chancenkarte':
      return 'var(--outside)';
    default:
      return 'var(--rules)';
  }
}

export const STAGE_ORDER: PipelineStage[] = [
  'new_story',
  'profiling',
  'gap_plan',
  'ready',
  'matched',
  'applied',
  'visa',
  'arrived',
];
