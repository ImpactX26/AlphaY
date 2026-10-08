import { PIPELINE_LABEL } from '@educaro/shared';
import clsx from 'clsx';
import { Briefcase, CalendarRange, CheckCheck, Columns3, Mail, Megaphone, Menu as MenuIcon, ScrollText, Send, TextSearch } from 'lucide-react';
import { type CSSProperties, Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { RouteBoundary } from '../app/RouteBoundary';
import { api, errorText } from '../api/client';
import { usePipeline, useQueue, useSystemStatus } from '../api/queries';
import type { ReplyKind } from '../api/types';
import { Logo, ThemeToggle, UserMenu } from '../app/chrome';
import { formatUsd } from '../lib/format';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { FullPageSpinner } from '../ui/Spinner';
import { toast } from '../ui/Toast';

const NAV = [
  { to: '/staff', label: 'Pipeline', icon: Columns3, end: true },
  { to: '/staff/queue', label: 'Approval queue', icon: CheckCheck, end: false },
  { to: '/staff/copilot', label: 'Copilot', icon: TextSearch, end: false },
  { to: '/staff/openings', label: 'Openings and matching', icon: Briefcase, end: false },
  { to: '/staff/planner', label: 'Batch planner', icon: CalendarRange, end: false },
  { to: '/staff/broadcasts', label: 'Broadcasts', icon: Megaphone, end: false },
  { to: '/staff/mail', label: 'Mail tracker', icon: Mail, end: false },
  { to: '/staff/audit', label: 'Trace and audit', icon: ScrollText, end: false },
] as const;

export function LlmBudget({ compact }: { compact?: boolean }) {
  const { data, isError } = useSystemStatus();
  if (isError) return <p className="text-[12.5px] text-bad">API unreachable</p>;
  if (!data) return null;
  const { openaiSpentUsd: spent, openaiBudgetUsd: budget, groq, openai } = data.llm;
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return (
    <div className={clsx('text-[12.5px]', compact ? 'w-44' : '')}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-semibold">LLM budget</span>
        <span className="num text-muted">
          {formatUsd(spent)} of {formatUsd(budget)}
        </span>
      </div>
      <span className="bar block" role="meter" aria-label="OpenAI spend against the cap" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <i className={clsx(pct > 80 && 'lo')} style={{ '--v': `${pct}%` } as CSSProperties} />
      </span>
      {!compact ? (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className={clsx('h-1.5 w-1.5 rounded-full', groq ? 'bg-ok' : 'bg-muted')} aria-hidden />
            Groq {groq ? 'on' : 'off'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={clsx('h-1.5 w-1.5 rounded-full', openai ? 'bg-ok' : 'bg-muted')} aria-hidden />
            OpenAI {openai ? 'on' : 'off'}
          </span>
        </p>
      ) : null}
    </div>
  );
}

const REPLY_KINDS: { kind: ReplyKind; label: string; hint: string }[] = [
  { kind: 'interview', label: 'Interview invite', hint: 'Goes to the calendar and pings Discord' },
  { kind: 'missing_paper', label: 'Missing paper', hint: 'Becomes a new task' },
  { kind: 'rejection', label: 'Position filled', hint: 'The agent moves to the next on the shortlist' },
];

/** Demo helper: make an employer reply land in the applicant's thread. */
export function SimulateReply({ defaultApplicantId }: { defaultApplicantId?: string }) {
  const [open, setOpen] = useState(false);
  const pipeline = usePipeline();
  const candidates = (pipeline.data ?? []).filter((c) => c.stage === 'matched' || c.stage === 'applied' || c.stage === 'gap_plan' || c.applicantId === defaultApplicantId);
  const [applicantId, setApplicantId] = useState(defaultApplicantId ?? '');
  const [kind, setKind] = useState<ReplyKind>('interview');
  const [busy, setBusy] = useState(false);
  const chosen = applicantId || candidates[0]?.applicantId || '';
  const send = async () => {
    setBusy(true);
    try {
      await api.simulateReply(chosen, kind);
      toast('Reply sent into the thread');
      setOpen(false);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" icon={Send} onClick={() => setOpen(true)} className="border-dashed border-loop/60 text-loop">
        Simulate employer reply
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Simulate an employer reply"
        description="Demo helper. A reply arrives in the applicant’s thread as if the employer had answered by email."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={send} disabled={!chosen}>
              Send the reply
            </Button>
          </>
        }
      >
        <div className="space-y-5 px-5 py-4">
          <label className="block">
            <span className="label">Applicant</span>
            <select className="input" value={chosen} onChange={(e) => setApplicantId(e.target.value)}>
              {candidates.map((c) => (
                <option key={c.applicantId} value={c.applicantId}>
                  {c.name} · {PIPELINE_LABEL[c.stage]}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="label">The employer says</legend>
            <div className="grid gap-2">
              {REPLY_KINDS.map((r) => (
                <label key={r.kind} className={clsx('flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3', kind === r.kind ? 'border-ink' : 'border-line')}>
                  <input type="radio" name="reply-kind" className="mt-1 accent-[var(--ink)]" checked={kind === r.kind} onChange={() => setKind(r.kind)} />
                  <span>
                    <span className="block text-[14px] font-semibold">{r.label}</span>
                    <span className="block text-[13px] text-muted">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Dialog>
    </>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const queue = useQueue();
  const count = queue.data?.length ?? 0;
  return (
    <nav aria-label="Command centre" className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-semibold no-underline transition-colors',
              isActive ? 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-muted hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <n.icon size={18} aria-hidden />
          <span className="flex-1">{n.label}</span>
          {n.to === '/staff/queue' && count ? <span className="num rounded-full bg-staff px-1.5 text-[11.5px] font-bold leading-5 text-surface">{count}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

export function StaffShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const detailId = location.pathname.match(/^\/staff\/applicants\/([^/]+)/)?.[1];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <aside aria-label="Sidebar" className="sticky top-0 hidden h-dvh flex-col gap-6 p-3 lg:flex">
        <div className="flex h-full min-h-0 flex-col gap-6 rounded-[var(--r)] border border-line bg-surface px-3 py-4 shadow-[var(--lift)]">
        <div className="px-2">
          <Logo to="/staff" />
          <p className="mt-1.5 pl-[36px] text-[12.5px] font-semibold text-staff">Command centre</p>
        </div>
        <SideNav />
        <div className="mt-auto space-y-4 px-2">
          <LlmBudget />
        </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <button type="button" className="icon-btn -ml-2 lg:hidden" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
              <MenuIcon size={20} aria-hidden />
            </button>
            <div className="lg:hidden">
              <Logo to="/staff" sub="Command centre" />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="hidden sm:block">
                <SimulateReply defaultApplicantId={detailId} key={detailId ?? 'none'} />
              </span>
              <ThemeToggle />
              <UserMenu tone="staff" />
            </div>
          </div>
        </header>
        <main id="main" className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <Suspense fallback={<FullPageSpinner label="Loading" />}>
            <RouteBoundary>
            <Outlet />
          </RouteBoundary>
          </Suspense>
        </main>
      </div>

      <Dialog open={navOpen} onClose={() => setNavOpen(false)} title="Command centre" variant="sheet">
        <div className="space-y-6 px-3 py-3">
          <SideNav onNavigate={() => setNavOpen(false)} />
          <div className="px-2 pb-2">
            <LlmBudget />
          </div>
          <div className="px-2 pb-4 sm:hidden">
            <SimulateReply defaultApplicantId={detailId} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
