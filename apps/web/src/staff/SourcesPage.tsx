import type { WatchedSourceDTO } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ExternalLink, Pause, Play, Plus, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useAddSource, useCheckAllSources, useCheckSource, useRemoveSource, useSetSourceActive, useSimulateSource, useWatchedSources } from '../api/queries';
import { Button } from '../ui/Button';
import { EmptyState, PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { relativeTime } from '../lib/format';
import { toast } from '../ui/Toast';

/**
 * The pages Educaro treats as the law.
 *
 * A jury asked what an applicant's document is checked against, and the honest answer is: a rule on
 * a page somebody else maintains. That page changes without telling anyone, and the people it
 * affects most are the ones already told "not yet" — who are the least likely to go back and
 * re-read it.
 *
 * This is the list, what we understood each page to say at the last read, what moved, and who was
 * told. The last column is the point: a change nobody was told about is a change that did not
 * happen as far as an applicant is concerned.
 */

const KIND_LABEL: Record<WatchedSourceDTO['kind'], string> = {
  university: 'University',
  government: 'Government',
  employer: 'Employer',
};

const KIND_TONE: Record<WatchedSourceDTO['kind'], string> = {
  university: 'border-agent/40 text-agent',
  government: 'border-staff/40 text-staff',
  employer: 'border-applicant/40 text-applicant',
};

export default function SourcesPage() {
  const { data: sources, isLoading } = useWatchedSources();
  const checkAll = useCheckAllSources();

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Watched sources"
        actions={
          <Button
            icon={RefreshCw}
            loading={checkAll.isPending}
            onClick={() => checkAll.mutate(undefined, { onSuccess: () => toast('Read every page and compared it to the last reading.') })}
          >
            Check all now
          </Button>
        }
      >
        The pages an applicant's documents are actually measured against. Educaro re-reads each one on its own schedule, compares the
        requirements to the last reading, and tells the people it moves for — by name, not by broadcast.
      </PageHeader>

      <AddSource />

      {isLoading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : !sources?.length ? (
        <EmptyState title="No sources yet" icon={ExternalLink}>
          Add the page that decides whether your applicants qualify, and Educaro will watch it.
        </EmptyState>
      ) : (
        <ul className="mt-5 space-y-4">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddSource() {
  const add = useAddSource();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<WatchedSourceDTO['kind']>('university');
  const [route, setRoute] = useState('');

  if (!open) {
    return (
      <Button icon={Plus} onClick={() => setOpen(true)} className="mt-1">
        Watch another page
      </Button>
    );
  }

  return (
    <form
      className="mt-2 rounded-[var(--r)] border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim() || !url.trim()) return;
        add.mutate(
          { label: label.trim(), url: url.trim(), kind, route: route.trim() || undefined },
          {
            onSuccess: () => {
              toast('Watching. The first read is the baseline, so it notifies nobody.');
              setOpen(false);
              setLabel('');
              setUrl('');
              setRoute('');
            },
            onError: () => toast('I could not add that one.', 'error'),
          },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">What is it</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="RWTH Aachen — MSc Data Science" className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block">
          <span className="label">Page address</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://…" className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block">
          <span className="label">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as WatchedSourceDTO['kind'])} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px]">
            <option value="university">University</option>
            <option value="government">Government</option>
            <option value="employer">Employer</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Route it governs (optional)</span>
          <input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="nursing, study, ausbildung…" className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px]" />
        </label>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        Without a route, only applicants with this page on their shortlist hear about a change.
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" loading={add.isPending}>
          Watch it
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function SourceCard({ source: s }: { source: WatchedSourceDTO }) {
  const check = useCheckSource();
  const simulate = useSimulateSource();
  const remove = useRemoveSource();
  const setActive = useSetSourceActive();
  const latest = s.changes[0];

  return (
    <li className={clsx('rounded-[var(--r)] border p-4', s.active ? 'border-line' : 'border-line bg-surface-2/40 opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', KIND_TONE[s.kind])}>{KIND_LABEL[s.kind]}</span>
            <span className="text-[15px] font-semibold">{s.label}</span>
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {s.url.replace(/^https?:\/\//, '')}
              <ExternalLink size={11} className="ml-1 inline align-[-1px]" aria-hidden />
            </a>
            {' · '}
            {s.lastCheckedAt ? `read ${relativeTime(s.lastCheckedAt)}` : 'never read'}
            {s.route ? ` · governs the ${s.route.replace(/_/g, ' ')} route` : ''}
            {s.demoVersion ? ` · demo page, version ${s.demoVersion} of ${s.demoVersions}` : ''}
          </p>
          {s.lastError ? <p className="mt-1 text-[12.5px] text-bad">Last read failed: {s.lastError}</p> : null}
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          <Button size="sm" icon={RefreshCw} loading={check.isPending} onClick={() => check.mutate(s.id, { onSuccess: (r) => toast(r.changed ? `${r.changes.length} change(s); ${r.notified.length} applicant(s) told.` : 'Nothing moved on that page.') })}>
            Check now
          </Button>
          {s.demoVersions ? (
            <Button
              size="sm"
              icon={Wand2}
              loading={simulate.isPending}
              onClick={() =>
                simulate.mutate(s.id, {
                  onSuccess: (r) => toast(r.changed ? `The page changed: ${r.changes.length} requirement(s) moved, ${r.notified.length} applicant(s) told.` : 'That version reads the same.'),
                })
              }
            >
              Simulate an update
            </Button>
          ) : null}
          <Button size="sm" icon={s.active ? Pause : Play} onClick={() => setActive.mutate({ id: s.id, active: !s.active })}>
            {s.active ? 'Pause' : 'Resume'}
          </Button>
          <Button size="sm" icon={Trash2} onClick={() => remove.mutate(s.id)}>
            Remove
          </Button>
        </div>
      </div>

      {s.requirements.length ? (
        <div className="mt-3">
          <SectionTitle>What this page says today</SectionTitle>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {s.requirements.map((r) => (
              <li key={r.key} className="rounded-md border border-line px-2.5 py-1 text-[12.5px]" title={r.raw}>
                <span className="text-muted">{r.label}:</span> <span className="num font-semibold">{r.shown}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {latest ? (
        <div className="mt-4 rounded-md border border-line bg-surface-2/60 px-3 py-3">
          <p className="text-[13px] font-semibold">
            {relativeTime(latest.createdAt)} — {latest.changes.length} requirement{latest.changes.length === 1 ? '' : 's'} moved
          </p>
          <ul className="mt-2 space-y-1">
            {latest.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                {c.direction === 'easier' ? (
                  <ArrowDown size={14} className="mt-[3px] flex-none text-ok" aria-hidden />
                ) : c.direction === 'harder' ? (
                  <ArrowUp size={14} className="mt-[3px] flex-none text-warn" aria-hidden />
                ) : (
                  <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-muted" aria-hidden />
                )}
                <span>{c.summary}</span>
              </li>
            ))}
          </ul>

          {/* The point of the whole page: a change nobody was told about did not happen. */}
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-muted">Who was told</p>
          {latest.notified.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {latest.notified.map((n) => (
                <li
                  key={n.applicantId}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-[12.5px]',
                    n.why === 'newly eligible' ? 'border-ok/50 bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]' : n.why === 'no longer eligible' ? 'border-bad/50 bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]' : 'border-line',
                  )}
                >
                  <span className="font-medium">{n.name}</span> <span className="text-muted">· {n.why}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-muted">Nobody — this change does not move anyone on the current caseload.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}
