import { ROUTE_LABEL, Route, type MatchDTO, type OpeningDTO, type OpeningInput } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Briefcase, Building2, CalendarClock, CheckCheck, FileText, Plus, Send, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { api, errorText } from '../api/client';
import { qk, useMatches, useOpenings } from '../api/queries';
import { formatDate } from '../lib/format';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Avatar, EmptyState, PageHeader, Skeleton } from '../ui/misc';
import { Chip, RoleLabel, Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

const MATCH_STATUS: Record<MatchDTO['status'], { label: string; cls: string }> = {
  ranked: { label: 'Ranked', cls: 't-web' },
  profile_ready: { label: 'Profile ready', cls: 't-ai' },
  sent: { label: 'Sent to the employer', cls: 't-ver' },
  interview: { label: 'Interview booked', cls: 't-ver' },
};

const BLANK: OpeningInput = {
  employer: '',
  employerEmail: '',
  title: '',
  city: '',
  route: 'nursing',
  germanLevel: 'B1',
  startDate: '',
  needsRecognition: false,
  description: '',
};

/** Steps from the spec: opening posted → hard filter in code → ranked list → German profile → approve and send. */
const STEPS = ['Opening posted', 'Hard filter in code', 'Ranked, with reasons', 'German profile', 'Approve and send'] as const;

function Steps({ active }: { active: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[12px]">
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-1">
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold',
              i < active ? 'border-ok/40 bg-ok/10 text-ok' : i === active ? 'border-ink bg-ink text-bg' : 'border-line text-muted',
            )}
          >
            <span className="num opacity-70">{i + 1}</span>
            {step}
          </span>
          {i < STEPS.length - 1 ? <span className="text-muted" aria-hidden>→</span> : null}
        </li>
      ))}
    </ol>
  );
}

function MatchRow({ match, onChanged }: { match: MatchDTO; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, call: () => Promise<unknown>, done: string) => {
    setBusy(label);
    try {
      await call();
      onChanged();
      toast(done);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <li className="card px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={match.consent ? match.displayName : 'C'} size={34} tone={match.consent ? 'applicant' : 'staff'} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">{match.displayName}</span>
            {!match.consent ? <Chip tone="staff">Anonymised until they agree</Chip> : null}
            <Tag s={MATCH_STATUS[match.status]} />
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {match.reasons.map((reason) => (
              <li key={reason} className="text-[13.5px] text-muted">
                {reason}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span className="display num text-[20px] font-black">{Math.round(match.score * 100)}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">fit</span>
        </div>
      </div>

      {match.germanProfile ? (
        <article className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3.5 py-3">
          <RoleLabel role="agent">Einseitiges Profil</RoleLabel>
          <p className="display mt-1.5 text-[14.5px] font-bold">{match.germanProfile.headline}</p>
          <dl className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {match.germanProfile.sections.map((section) => (
              <div key={section.title}>
                <dt className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{section.title}</dt>
                <dd>
                  <ul className="mt-0.5 space-y-0.5 text-[13px]">
                    {section.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!match.germanProfile ? (
          <Button size="sm" icon={FileText} loading={busy === 'profile'} onClick={() => run('profile', () => api.buildProfile(match.id), 'Profile written, in German')}>
            Write the German profile
          </Button>
        ) : null}
        {match.germanProfile && match.status !== 'sent' && match.status !== 'interview' ? (
          <Button
            size="sm"
            variant="approve"
            icon={Send}
            loading={busy === 'send'}
            onClick={() => run('send', () => api.sendMatch(match.id), 'Approved. Profile mailed to the employer.')}
          >
            Approve and send to the employer
          </Button>
        ) : null}
        {match.status === 'interview' ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
            <CheckCheck size={15} aria-hidden />
            Interview booked. On their screen and in their calendar.
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default function OpeningsPage() {
  const qc = useQueryClient();
  const { data: openings, isLoading } = useOpenings();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: matches } = useMatches(selected);
  const [matching, setMatching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<OpeningInput>(BLANK);
  const [saving, setSaving] = useState(false);

  const opening: OpeningDTO | undefined = openings?.find((o) => o.id === selected);
  const step = !opening ? 0 : !matches?.length ? 1 : matches.some((m) => m.status === 'sent' || m.status === 'interview') ? 4 : matches.some((m) => m.germanProfile) ? 3 : 2;

  const match = async (id: string) => {
    setSelected(id);
    setMatching(true);
    try {
      await api.matchOpening(id);
      void qc.invalidateQueries({ queryKey: qk.matches(id) });
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setMatching(false);
    }
  };

  const create = async () => {
    setSaving(true);
    try {
      const created = await api.createOpening(form);
      void qc.invalidateQueries({ queryKey: qk.openings });
      setCreating(false);
      setForm(BLANK);
      toast('Opening posted. Matching it now.');
      await match(created.id);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Openings and matching"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Post an opening
          </Button>
        }
      >
        Educaro’s paying customers are employers. Post an opening, let the hard filter run in code, then send a German one-page profile once the candidate agrees.
      </PageHeader>

      <div className="mb-5">
        <Steps active={step} />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          <ul className="space-y-2.5">
            {openings?.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSelected(o.id)}
                  className={clsx(
                    'w-full rounded-lg border px-3.5 py-3 text-left transition-colors',
                    selected === o.id ? 'border-ink bg-surface' : 'border-line bg-surface hover:border-muted',
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
                    <Building2 size={13} aria-hidden />
                    {o.employer}
                  </p>
                  <p className="mt-0.5 text-[14.5px] font-semibold leading-snug">{o.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                    <span>{o.city}</span>
                    <span>·</span>
                    <span>German {o.germanLevel}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={12} aria-hidden />
                      {formatDate(o.startDate)}
                    </span>
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    <Chip tone="applicant">{ROUTE_LABEL[o.route]}</Chip>
                    {o.needsRecognition ? <Chip tone="warn">Anerkennung</Chip> : null}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0">
            {opening ? (
              <section>
                <div className="card px-4 py-4">
                  <h2 className="display text-[17px] font-bold">{opening.title}</h2>
                  <p className="mt-1 text-[13.5px] text-muted">
                    {opening.employer} · {opening.city} · <span className="font-mono">{opening.employerEmail}</span>
                  </p>
                  <p className="mt-2.5 text-[14px] leading-relaxed">{opening.description}</p>
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {opening.keywords.map((k) => (
                      <span key={k} className="rounded bg-[color-mix(in_srgb,var(--agent)_14%,transparent)] px-2 py-0.5 text-[12px] font-medium">
                        {k}
                      </span>
                    ))}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button variant="primary" icon={Users} loading={matching} onClick={() => void match(opening.id)}>
                      {matches?.length ? 'Run the match again' : 'Find candidates'}
                    </Button>
                    <span className="text-[12.5px] text-muted">Route, language level, start date and recognition status are filtered in code before any ranking.</span>
                  </div>
                </div>

                {matching ? (
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : matches?.length ? (
                  <ul className="mt-4 space-y-3">
                    {matches.map((m) => (
                      <MatchRow key={m.id} match={m} onChanged={() => void qc.invalidateQueries({ queryKey: qk.matches(opening.id) })} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No ranked candidates yet" icon={Sparkles} className="mt-4">
                    Run the match: the hard filter narrows the pipeline in code, then the agent writes two lines of reasoning per person.
                  </EmptyState>
                )}
              </section>
            ) : (
              <EmptyState title="Pick an opening" icon={Briefcase}>
                Choose one on the left to see its ranked candidates, or post a new one.
              </EmptyState>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Post an opening"
        description="From an employer client. The agent pulls keywords from the description and matches ready candidates."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} disabled={!form.employer || !form.title || !form.city} onClick={create}>
              Post and match
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5 px-5 py-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Employer</span>
            <input className="input" value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} placeholder="Rheinpflege Seniorenzentrum" />
          </label>
          <label className="block">
            <span className="label">Their email</span>
            <input className="input" type="email" value={form.employerEmail} onChange={(e) => setForm({ ...form, employerEmail: e.target.value })} placeholder="bewerbung@…" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Role</span>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Pflegefachkraft (m/w/d)" />
          </label>
          <label className="block">
            <span className="label">City</span>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cologne" />
          </label>
          <label className="block">
            <span className="label">Route</span>
            <select className="input" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value as Route })}>
              {Route.options.map((r) => (
                <option key={r} value={r}>
                  {ROUTE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">German needed</span>
            <select className="input" value={form.germanLevel} onChange={(e) => setForm({ ...form, germanLevel: e.target.value })}>
              {['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Start date</span>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className="flex items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={form.needsRecognition} onChange={(e) => setForm({ ...form, needsRecognition: e.target.checked })} />
            <span className="text-[14px]">Anerkennung required before starting</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Description</span>
            <textarea
              className="input min-h-24"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What the role involves, the team, what you offer. The agent takes its keywords from here."
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
