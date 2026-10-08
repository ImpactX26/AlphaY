import type { ArrivalBlock, BudgetBlock, LettersBlock, ReadinessBlock, ServicesBlock, TimelineBlock } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowUpRight, CalendarDays, Check, FileSignature, GraduationCap, Plane } from 'lucide-react';
import { formatDate, formatMoney } from '../../lib/format';
import { OUTCOME, approvalStatus } from '../../lib/tags';
import { Button } from '../../ui/Button';
import { ExternalLink, Meter } from '../../ui/misc';
import { RoleLabel, Tag } from '../../ui/Tag';
import { BlockFrame, Kicker } from '../BlockFrame';
import { useScreenActions } from '../context';

export function ReadinessCard({ block }: { block: ReadinessBlock }) {
  const outcome = OUTCOME[block.outcome];
  return (
    <BlockFrame kicker={block.title ?? 'How ready you are'} body={block.body} headerExtra={<Tag s={outcome} className="flex-none" />}>
      {/* The one number the whole page is about: how close she is. It carries the page. */}
      <div className="flex items-baseline gap-2.5">
        <span className="display num text-[clamp(56px,13vw,76px)] font-black leading-[0.85] tracking-[-0.03em]">
          {Math.round(block.overall)}%
        </span>
        <span className="text-[15px] text-muted">ready</span>
      </div>
      <div className="mt-5 space-y-1.5">
        {block.meters.map((m) => (
          <Meter key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted">Computed from the checks, not guessed by the model. There is no “rejected”: if a route does not fit, the agent shows one that does.</p>
    </BlockFrame>
  );
}

export function BudgetCard({ block, bare }: { block: BudgetBlock; bare?: boolean }) {
  const outgoings = block.lines.some((l) => l.amount < 0);
  return (
    <BlockFrame bare={bare}
      kicker={block.title ?? 'Your month'}
      body={block.body}
      headerExtra={<span className="flex-none text-[12.5px] text-muted">{block.city}</span>}
      footer={
        block.sources.length ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Sources:
            {block.sources.map((s) => (
              <ExternalLink key={s.url} href={s.url}>
                {s.label}
              </ExternalLink>
            ))}
          </span>
        ) : null
      }
    >
      <ul className="divide-y divide-line">
        {block.lines.map((line) => (
          <li key={line.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
            <span className="min-w-0">
              <span className="text-[14px]">{line.label}</span>
              {line.note ? <span className="block text-[12.5px] text-muted">{line.note}</span> : null}
            </span>
            <span className={clsx('num flex-none text-[14px] font-semibold', line.amount < 0 && 'text-bad')}>{formatMoney(line.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-2.5">
        <span className="display text-[15px] font-bold">{outgoings ? 'Net in your account' : 'Every month'}</span>
        <span className="display num text-[22px] font-black">{formatMoney(block.total)}</span>
      </div>
      {block.compare.length ? (
        <div className="mt-3">
          <Kicker className="mb-2">Compared with</Kicker>
          <ul className="space-y-1.5">
            {block.compare.map((c) => {
              const diff = c.total - block.total;
              return (
                <li key={c.city} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span>{c.city}</span>
                  <span className="num flex-none">
                    {formatMoney(c.total)}
                    <span className={clsx('ml-2 font-semibold', diff > 0 ? 'text-bad' : 'text-ok')}>
                      {diff > 0 ? '+' : ''}
                      {formatMoney(diff)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </BlockFrame>
  );
}

const TIMELINE_ICON = { deadline: FileSignature, exam: GraduationCap, task: Check, event: CalendarDays, interview: Plane } as const;
const TIMELINE_TONE = { deadline: 'text-bad', exam: 'text-agent', task: 'text-muted', event: 'text-applicant', interview: 'text-staff' } as const;

export function TimelineCard({ block, bare }: { block: TimelineBlock; bare?: boolean }) {
  const sorted = [...block.items].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <BlockFrame bare={bare} kicker={block.title ?? 'Coming up'} body={block.body}>
      <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-[2px] before:bg-line">
        {sorted.map((item) => {
          const Icon = TIMELINE_ICON[item.kind];
          const past = Date.parse(item.date) < Date.now();
          return (
            <li key={`${item.date}-${item.label}`} className="relative flex items-start gap-3 pl-0">
              <span className={clsx('relative z-10 mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border-2 border-bg', past ? 'bg-line' : 'bg-ink')} aria-hidden />
              <span className={clsx('min-w-0 flex-1', past && 'opacity-60')}>
                <span className="flex items-center gap-1.5 text-[14px] font-medium">
                  <Icon size={14} className={clsx('flex-none', TIMELINE_TONE[item.kind])} aria-hidden />
                  {item.label}
                </span>
                <span className="num block text-[12.5px] text-muted">{formatDate(item.date.length === 10 ? `${item.date}T12:00:00` : item.date)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </BlockFrame>
  );
}

export function ServicesCard({ block, bare }: { block: ServicesBlock; bare?: boolean }) {
  return (
    <BlockFrame bare={bare}
      kicker={
        <RoleLabel role="staff">
          <span>{block.title ?? 'Educaro can do this with you'}</span>
        </RoleLabel>
      }
      body={block.body}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {block.services.map((s) => (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col gap-1 rounded-lg border border-staff/35 bg-[color-mix(in_srgb,var(--staff)_6%,transparent)] px-3.5 py-3 no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--staff)_11%,transparent)]"
            >
              <span className="flex items-start justify-between gap-2 text-[14px] font-semibold text-ink">
                {s.name}
                <ArrowUpRight size={15} aria-hidden className="mt-0.5 flex-none text-staff" />
              </span>
              {s.why ? <span className="text-[13px] text-muted">{s.why}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </BlockFrame>
  );
}

/** Letters the writer drafted. Nothing leaves without a human tap. */
export function LettersCard({ block }: { block: LettersBlock }) {
  const { openApproval, readOnly } = useScreenActions();
  return (
    <BlockFrame
      tone="accent"
      kicker={block.title ?? 'Ready for you to check'}
      body={block.body}
      footer={<span>Nothing is sent until you approve it. You can edit every word first.</span>}
    >
      <ul className="space-y-2">
        {block.drafts.map((draft) => {
          const s = approvalStatus(draft.status);
          const pending = draft.status === 'pending';
          return (
            <li key={draft.approvalId} className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3">
              {/* Basis 100% so a long subject takes its own row instead of colliding with the tag. */}
              <span className="min-w-0 flex-1 basis-full sm:basis-0">
                <span className="block text-[14px] font-semibold leading-snug">{draft.title}</span>
                <span className="block truncate font-mono text-[12px] text-muted">To: {draft.to}</span>
              </span>
              <Tag s={s} className="flex-none" />
              <Button size="sm" variant={pending ? 'primary' : 'secondary'} className="flex-none" disabled={readOnly} onClick={() => openApproval(draft.approvalId)}>
                {pending ? 'Review and send' : 'Open'}
              </Button>
            </li>
          );
        })}
      </ul>
    </BlockFrame>
  );
}

export function ArrivalCard({ block }: { block: ArrivalBlock }) {
  return (
    <BlockFrame kicker={block.title ?? 'Your first weeks'} body={block.body}>
      <div className="space-y-4">
        {block.phases.map((phase) => {
          const done = phase.items.filter((i) => i.done).length;
          return (
            <section key={phase.title}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="display text-[14.5px] font-bold">{phase.title}</h3>
                <span className="num text-[12.5px] text-muted">
                  {done} of {phase.items.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {phase.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <span
                      className={clsx('mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full border', item.done ? 'border-ok bg-ok text-surface' : 'border-line')}
                      aria-hidden
                    >
                      {item.done ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className={clsx('min-w-0 text-[14px]', item.done && 'text-muted line-through decoration-line')}>
                      {item.label}
                      {item.note ? <span className="block text-[12.5px] text-muted no-underline">{item.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </BlockFrame>
  );
}
