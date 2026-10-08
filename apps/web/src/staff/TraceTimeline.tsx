import type { TraceDTO } from '@educaro/shared';
import clsx from 'clsx';
import { BrainCircuit, CheckCheck, Globe, Mail, MoveRight, ScrollText, ShieldCheck, Sparkles, Wrench, Zap } from 'lucide-react';
import { useState } from 'react';
import { formatTime, formatUsd, hostOf, relativeTime } from '../lib/format';
import { ExternalLink } from '../ui/misc';

const KIND: Record<TraceDTO['kind'], { icon: typeof Wrench; label: string; tone: string }> = {
  plan: { icon: BrainCircuit, label: 'Plan', tone: 'text-agent' },
  tool: { icon: Wrench, label: 'Tool', tone: 'text-rules' },
  llm: { icon: Sparkles, label: 'Model', tone: 'text-staff' },
  source: { icon: Globe, label: 'Source', tone: 'text-agent' },
  guard: { icon: ShieldCheck, label: 'Guard', tone: 'text-ok' },
  approval: { icon: CheckCheck, label: 'Approval', tone: 'text-staff' },
  email: { icon: Mail, label: 'Mail', tone: 'text-outside' },
  event: { icon: Zap, label: 'Event', tone: 'text-applicant' },
  move: { icon: MoveRight, label: 'Move', tone: 'text-loop' },
};

const FILTERS = ['all', 'plan', 'tool', 'llm', 'source', 'guard'] as const;

function Detail({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!entries.length) return null;
  return (
    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px]">
      {entries.map(([key, value]) => {
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const isUrl = typeof value === 'string' && /^https?:\/\//.test(value);
        return (
          <div key={key} className="flex min-w-0 gap-1.5">
            <dt className="flex-none text-muted">{key}</dt>
            <dd className="min-w-0 truncate font-mono" title={text}>
              {isUrl ? <ExternalLink href={value as string}>{hostOf(value as string)}</ExternalLink> : text}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Every plan, tool call, source link, guard event and model call, in order, with cost. */
export function TraceTimeline({ trace, loading, showApplicant }: { trace: TraceDTO[] | undefined; loading?: boolean; showApplicant?: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const rows = (trace ?? []).filter((t) => filter === 'all' || t.kind === filter);
  const cost = (trace ?? []).reduce((sum, t) => sum + t.costUsd, 0);
  const sources = new Set((trace ?? []).filter((t) => t.kind === 'source' && typeof t.detail.url === 'string').map((t) => t.detail.url as string));

  if (loading) return <p className="text-[13.5px] text-muted">Loading the trace…</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter the trace">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={clsx('chip capitalize', filter === f && '!border-ink !bg-ink !text-bg')}
            >
              {f === 'all' ? `All ${trace?.length ?? 0}` : KIND[f].label}
            </button>
          ))}
        </div>
        <p className="num ml-auto text-[12.5px] text-muted">
          {sources.size} {sources.size === 1 ? 'source' : 'sources'} opened · {formatUsd(cost)} spent
        </p>
      </div>

      {rows.length ? (
        <ol className="relative space-y-0 before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-[2px] before:bg-line">
          {rows.map((t) => {
            const k = KIND[t.kind];
            return (
              <li key={t.id} className="relative flex gap-3 py-2">
                <span className={clsx('relative z-10 mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-bg bg-surface-2', k.tone)} aria-hidden>
                  <k.icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
                    <span className={clsx('text-[11px] font-bold uppercase tracking-[0.07em]', k.tone)}>{k.label}</span>
                    <span className="font-mono font-semibold">{t.name}</span>
                    {showApplicant && t.applicantId ? <span className="text-[12px] text-muted">{t.applicantId}</span> : null}
                    <span className="num ml-auto flex-none text-[11.5px] text-muted" title={relativeTime(t.createdAt)}>
                      {formatTime(t.createdAt)}
                      {t.costUsd > 0 ? <span className="ml-2 text-staff">{formatUsd(t.costUsd)}</span> : null}
                    </span>
                  </p>
                  <Detail detail={t.detail} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="flex items-center gap-2 py-4 text-[13.5px] text-muted">
          <ScrollText size={15} aria-hidden />
          Nothing of that kind in the trace yet.
        </p>
      )}
    </div>
  );
}
