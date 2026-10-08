import { PIPELINE_LABEL, ROUTE_LABEL } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CalendarPlus, CheckCheck, KeyRound, Mail, MessagesSquare, PlaneLanding } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, errorText } from '../api/client';
import {
  qk,
  useApplicant,
  useApprovals,
  useBrief,
  useFiles,
  useReadiness,
  useScreen,
  useTrace,
  useTruthMap,
} from '../api/queries';
import { AgentPill } from '../app/chrome';
import { DocumentList } from '../applicant/DocumentDrop';
import { formatDateTime, relativeTime } from '../lib/format';
import { approvalStatus } from '../lib/tags';
import { ComposedScreen } from '../screen/ComposedScreen';
import { ScreenActionsProvider, useReadOnlyActions } from '../screen/context';
import { TruthTable } from '../screen/blocks/core';
import { watchApplicant } from '../realtime/socket';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Avatar, EmptyState, Meter, SectionTitle, Skeleton } from '../ui/misc';
import { Chip, RoleLabel, Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';
import { TraceTimeline } from './TraceTimeline';

const TABS = ['screen', 'profile', 'trace', 'brief'] as const;
type TabName = (typeof TABS)[number];
const TAB_LABEL: Record<TabName, string> = { screen: 'Their screen', profile: 'Truth map and files', trace: 'Trace', brief: 'Brief and handoff' };

export default function ApplicantDetail() {
  const { applicantId = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabName>('screen');
  const { data: applicant, isLoading } = useApplicant(applicantId);
  const { data: screen } = useScreen(applicantId);
  const { data: readiness } = useReadiness(applicantId);
  const { data: truth } = useTruthMap(applicantId);
  const { data: files } = useFiles(applicantId);
  const { data: approvals } = useApprovals(applicantId);
  const { data: trace, isLoading: traceLoading } = useTrace(applicantId);
  const { data: brief } = useBrief(applicantId);
  const readOnly = useReadOnlyActions(applicantId);
  const [busy, setBusy] = useState<string | null>(null);
  const [germany, setGermany] = useState(false);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState('');

  // Staff join the applicant's room to see their screen, chat and trace live.
  useEffect(() => watchApplicant(applicantId), [applicantId]);

  useEffect(() => {
    if (germany) setCity((c) => c || applicant?.targetCity || '');
  }, [germany, applicant?.targetCity]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.applicantAll(applicantId) });
    void qc.invalidateQueries({ queryKey: qk.pipeline });
    void qc.invalidateQueries({ queryKey: qk.queue });
    void qc.invalidateQueries({ queryKey: qk.brief(applicantId) });
  };

  const act = async (label: string, call: () => Promise<unknown>, done: string) => {
    setBusy(label);
    try {
      await call();
      invalidate();
      toast(done);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-80 w-full max-w-4xl" />;
  if (!applicant) return <EmptyState title="No such applicant">The link may be old.</EmptyState>;

  return (
    <div>
      <Link to="/staff" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted no-underline hover:text-ink">
        <ArrowLeft size={15} aria-hidden />
        Back to the pipeline
      </Link>

      <header className="mb-5 flex flex-wrap items-start gap-x-5 gap-y-3">
        <Avatar name={applicant.name} size={46} tone={applicant.route === 'study' ? 'agent' : 'applicant'} />
        <div className="min-w-0 flex-1">
          <h1 className="display text-[26px] font-extrabold leading-tight">{applicant.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] text-muted">
            {applicant.subtitle ? <span>{applicant.subtitle}</span> : null}
            {applicant.route ? <Chip tone="applicant">{ROUTE_LABEL[applicant.route]}</Chip> : <Chip>Route not set</Chip>}
            <Chip tone="staff">{PIPELINE_LABEL[applicant.stage]}</Chip>
            {applicant.cohortChannel ? <span className="font-mono text-[12.5px] text-outside">{applicant.cohortChannel}</span> : null}
          </p>
          {applicant.stageReason ? <p className="mt-1.5 max-w-prose text-[13px] italic text-muted">“{applicant.stageReason}”</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AgentPill applicantId={applicantId} />
          {readiness ? <p className="num display text-[22px] font-extrabold">{readiness.overall}% ready</p> : null}
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-3">
        {applicant.submittedAt && !applicant.approvedByStaffAt ? (
          <Button
            variant="approve"
            icon={CheckCheck}
            loading={busy === 'approve'}
            onClick={() => act('approve', () => api.approveSubmission(applicantId), `Approved ${applicant.name.split(' ')[0]}’s submission`)}
          >
            Approve their submission
          </Button>
        ) : null}
        <Button
          icon={CalendarPlus}
          loading={busy === 'consultant'}
          onClick={() => act('consultant', () => api.bookConsultant(applicantId), 'Consultant call booked. They have been told.')}
        >
          {brief?.bookedFor ? 'Rebook the consultant call' : 'Book a consultant call'}
        </Button>
        {applicant.mode !== 'germany' ? (
          <Button icon={PlaneLanding} onClick={() => setGermany(true)}>
            Visa granted
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
            <PlaneLanding size={15} aria-hidden />
            Germany mode{applicant.targetCity ? `, ${applicant.targetCity}` : ''}
          </span>
        )}
        <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-[13.5px]">
          <KeyRound size={15} className="text-staff" aria-hidden />
          <span>
            <span className="font-semibold">Second key</span>
            <span className="block text-[12.5px] text-muted">Require staff approval for anything this applicant sends out.</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--staff)]"
            checked={applicant.staffSecondKey}
            disabled={busy === 'secondKey'}
            onChange={(e) =>
              act('secondKey', () => api.setSettings(applicantId, { staffSecondKey: e.target.checked }), e.target.checked ? 'Second key on' : 'Second key off')
            }
          />
        </label>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-line" role="tablist" aria-label="Applicant sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              'relative -mb-px px-3 py-2 text-[14px] font-semibold transition-colors',
              tab === t ? 'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-ink' : 'text-muted hover:text-ink',
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'screen' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="min-w-0">
            <p className="mb-3 flex items-center gap-2 text-[12.5px] text-muted">
              <RoleLabel role="agent">Read-only</RoleLabel>
              This is exactly what {applicant.name.split(' ')[0]} sees, live. Version {screen?.version ?? '—'}, composed by {screen?.composedBy ?? 'rules'}.
            </p>
            <ScreenActionsProvider value={readOnly}>
              <ComposedScreen screen={screen} loading={!screen} />
            </ScreenActionsProvider>
          </div>
          <aside aria-label="Applicant summary" className="space-y-4">
            {readiness ? (
              <section className="card px-4 py-3.5">
                <h2 className="display text-[14.5px] font-bold">Readiness</h2>
                <div className="mt-2.5 space-y-1.5">
                  {readiness.meters.map((m) => (
                    <Meter key={m.label} label={m.label} value={m.value} />
                  ))}
                </div>
              </section>
            ) : null}
            <section className="card px-4 py-3.5">
              <h2 className="display text-[14.5px] font-bold">Approvals</h2>
              {approvals?.length ? (
                <ul className="mt-2 space-y-2">
                  {approvals.map((a) => (
                    <li key={a.id} className="text-[13px]">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Tag s={approvalStatus(a.status)} />
                        {a.needsStaff ? <Chip tone="staff">Second key</Chip> : null}
                      </span>
                      <span className="mt-1 block font-semibold">{a.title}</span>
                      <span className="block text-[12px] text-muted">{relativeTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[13px] text-muted">Nothing waiting.</p>
              )}
            </section>
            <section className="card px-4 py-3.5">
              <h2 className="display flex items-center gap-2 text-[14.5px] font-bold">
                <Mail size={15} className="text-outside" aria-hidden />
                Mail
              </h2>
              <Link to={`/staff/mail?applicantId=${applicantId}`} className="mt-1.5 block text-[13px]">
                Open their mail in the tracker
              </Link>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === 'profile' ? (
        <div className="max-w-4xl space-y-7">
          <section>
            <SectionTitle>What they said, wrote and proved</SectionTitle>
            <div className="card px-4 py-4">
              <TruthTable rows={truth ?? []} />
            </div>
          </section>
          <section>
            <SectionTitle>Files</SectionTitle>
            {files?.length ? <DocumentList files={files} /> : <p className="text-[13.5px] text-muted">No files uploaded yet.</p>}
          </section>
        </div>
      ) : null}

      {tab === 'trace' ? (
        <section className="max-w-4xl">
          <SectionTitle>Everything, in order</SectionTitle>
          <div className="card px-4 py-4">
            <TraceTimeline trace={trace} loading={traceLoading} />
          </div>
        </section>
      ) : null}

      <Dialog
        open={germany}
        onClose={() => setGermany(false)}
        title="Visa granted?"
        description="Their screen switches to Germany mode: what to pack, the first two weeks, places near the new address and real numbers."
        footer={
          <>
            <Button variant="ghost" onClick={() => setGermany(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={PlaneLanding}
              loading={busy === 'germany'}
              disabled={!city.trim()}
              onClick={() =>
                act('germany', async () => {
                  await api.germany(applicantId, { city: city.trim(), address: address.trim() || undefined, startDate: startDate || undefined });
                  setGermany(false);
                }, `${applicant.name.split(' ')[0]}’s screen is now set up for ${city.trim()}`)
              }
            >
              Switch to Germany mode
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5 px-5 py-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">City</span>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cologne" autoFocus />
          </label>
          <label className="block">
            <span className="label">Start date</span>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">
              Address <span className="font-normal text-muted">(optional)</span>
            </span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Venloer Str. 1, 50823 Köln" />
          </label>
          <p className="text-[12.5px] text-muted sm:col-span-2">Places near the address come from OpenStreetMap. Nothing personal goes into the lookup.</p>
        </div>
      </Dialog>

      {tab === 'brief' ? (
        <section className="max-w-2xl">
          <SectionTitle>Consultant brief</SectionTitle>
          {brief ? (
            <article className="card px-5 py-5">
              <RoleLabel role="agent">One page, written by the agent</RoleLabel>
              <h2 className="display mt-2 text-[18px] font-bold">{applicant.name}</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed">{brief.who}</p>
              <dl className="mt-4 space-y-4 text-[14px]">
                <div>
                  <dt className="label mb-1">Route</dt>
                  <dd>{brief.route}</dd>
                </div>
                <div>
                  <dt className="label mb-1">Open gaps</dt>
                  <dd>
                    {brief.openGaps.length ? (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {brief.openGaps.map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">None.</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label mb-1">What the agent tried</dt>
                  <dd>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {brief.agentTried.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="label mb-1 flex items-center gap-1.5">
                    <MessagesSquare size={14} aria-hidden />
                    Three questions to ask
                  </dt>
                  <dd>
                    <ol className="list-decimal space-y-0.5 pl-5">
                      {brief.questionsToAsk.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ol>
                  </dd>
                </div>
              </dl>
              <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">
                {brief.bookedFor ? `Call booked for ${formatDateTime(brief.bookedFor)}. The applicant has been told.` : 'No call booked yet.'}
              </p>
            </article>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </section>
      ) : null}
    </div>
  );
}
