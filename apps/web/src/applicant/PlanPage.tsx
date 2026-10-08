import { CalendarCheck, CheckCircle2, Clock, Download, FileText, MessageSquare, Send, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorText, links } from '../api/client';
import { qk, useApplicant, useGaps, useReadiness, useScreen } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { formatDate } from '../lib/format';
import { OUTCOME } from '../lib/tags';
import { BudgetCard, ServicesCard, TimelineCard } from '../screen/blocks/outcome';
import { GapPlanCard } from '../screen/blocks/plan';
import { ScreenActionsProvider, useReadOnlyActions } from '../screen/context';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState, ExternalLink, Meter, PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

export default function PlanPage() {
  const applicantId = useApplicantId();
  const qc = useQueryClient();
  const { data: applicant } = useApplicant(applicantId);
  const { data: readiness, isLoading } = useReadiness(applicantId);
  const { data: gaps } = useGaps(applicantId);
  const { data: screen } = useScreen(applicantId);
  const readOnly = useReadOnlyActions(applicantId);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openGaps = gaps?.filter((g) => g.status !== 'done') ?? [];
  const budgets = screen?.blocks.filter((b): b is Extract<typeof b, { type: 'budget' }> => b.type === 'budget') ?? [];
  const timelines = screen?.blocks.filter((b): b is Extract<typeof b, { type: 'timeline' }> => b.type === 'timeline') ?? [];
  const services = screen?.blocks.filter((b): b is Extract<typeof b, { type: 'services' }> => b.type === 'services') ?? [];
  const outcome = readiness ? OUTCOME[readiness.outcome] : null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.submit(applicantId);
      void qc.invalidateQueries({ queryKey: qk.applicant(applicantId) });
      toast('Sent to Educaro. A staff member checks it next.');
      setConfirmSubmit(false);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenActionsProvider value={readOnly}>
      <div className="max-w-4xl">
        <PageHeader title="Your plan and outcome">Where you stand, what is still open, and what Educaro can do with you.</PageHeader>

        {isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : readiness ? (
          <section className="card mb-8 overflow-hidden">
            <div className="grid gap-5 px-4 py-4 sm:grid-cols-[minmax(0,210px)_minmax(0,1fr)] sm:px-5">
              <div>
                {outcome ? <Tag s={outcome} /> : null}
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="display num text-[46px] font-extrabold leading-none">{Math.round(readiness.overall)}%</span>
                  <span className="text-[13.5px] text-muted">ready</span>
                </p>
                <p className="mt-2 text-[13px] text-muted">
                  Computed from the checks, not guessed. There is no “rejected”: if this route does not fit, the agent shows the one that does.
                </p>
              </div>
              <div className="space-y-1.5 sm:border-l sm:border-line sm:pl-5">
                {readiness.meters.map((m) => (
                  <Meter key={m.label} label={m.label} value={m.value} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-3 sm:px-5">
              <a href={links.finalPack(applicantId, 'pdf')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm no-underline">
                <Download size={15} aria-hidden />
                Final pack (PDF)
              </a>
              <a href={links.finalPack(applicantId, 'docx')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm no-underline">
                <Download size={15} aria-hidden />
                DOCX
              </a>
              <a href={links.lebenslauf(applicantId, 'pdf')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm no-underline">
                <FileText size={15} aria-hidden />
                Lebenslauf
              </a>
              <span className="ml-auto" />
              {applicant?.approvedByStaffAt ? (
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                  <CheckCircle2 size={16} aria-hidden />
                  Approved by Educaro on {formatDate(applicant.approvedByStaffAt)}
                </span>
              ) : applicant?.submittedAt ? (
                <span className="flex items-center gap-1.5 text-[13px] text-muted">
                  <Clock size={15} aria-hidden />
                  Sent to Educaro on {formatDate(applicant.submittedAt)}. A staff member checks it next.
                </span>
              ) : (
                <Button variant="primary" icon={Send} onClick={() => setConfirmSubmit(true)}>
                  Submit to Educaro
                </Button>
              )}
            </div>
          </section>
        ) : null}

        {openGaps.length ? (
          <section className="mb-10">
            <SectionTitle>Your plan for the gaps</SectionTitle>
            <GapPlanCard
              bare
              block={{
                id: 'plan-gaps',
                type: 'gap_plan',
                body: 'Nothing here is a no. Each gap has a fix: what, where, how long and what it costs.',
                gaps: openGaps.map((g) => ({
                  id: g.id,
                  title: g.title,
                  what: g.what,
                  where: g.where,
                  howLong: g.howLong,
                  cost: g.cost,
                  links: g.links,
                  service: g.service ?? undefined,
                })),
              }}
            />
          </section>
        ) : readiness ? (
          <EmptyState title="No gaps left" icon={Sparkles} className="mb-8">
            Everything on your plan is done. Your pack is ready to download.
          </EmptyState>
        ) : null}

        {services.length ? (
          <section className="mb-10">
            <SectionTitle>Next step inside Educaro</SectionTitle>
            <div className="space-y-4">
              {services.map((block) => (
                <ServicesCard key={block.id} block={block} bare />
              ))}
            </div>
          </section>
        ) : null}

        {timelines.length ? (
          <section className="mb-10">
            <SectionTitle>Your dates</SectionTitle>
            <div className="space-y-4">
              {timelines.map((block) => (
                <TimelineCard key={block.id} block={block} bare />
              ))}
            </div>
          </section>
        ) : null}

        {budgets.length ? (
          <section className="mb-10">
            <SectionTitle>
              <span className="flex items-center gap-2">
                <Wallet size={17} className="text-muted" aria-hidden />
                Money
              </span>
            </SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              {budgets.map((block) => (
                <BudgetCard key={block.id} block={block} bare />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mb-10">
          <SectionTitle>Practise before it counts</SectionTitle>
          <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <p className="max-w-prose text-[14px]">
              The interview coach asks what a visa officer or this employer is likely to ask, in English, and scores each answer against your own profile.
            </p>
            <a href="/app/interview" className="btn btn-primary no-underline">
              <MessageSquare size={16} aria-hidden />
              Start a mock interview
            </a>
          </div>
        </section>
      </div>

      <Dialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title="Submit to Educaro?"
        description="Your profile, truth map, gap plans and shortlist go to the Educaro team. A staff member approves it; the agent never approves itself."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>
              Not yet
            </Button>
            <Button variant="primary" icon={CalendarCheck} loading={submitting} onClick={submit}>
              Submit to Educaro
            </Button>
          </>
        }
      >
        <div className="space-y-3 px-5 py-4 text-[14px]">
          <p>
            You are at <strong>{Math.round(readiness?.overall ?? 0)}% ready</strong>
            {openGaps.length ? (
              <>
                {' '}
                with {openGaps.length} {openGaps.length === 1 ? 'gap' : 'gaps'} still open. That is fine: Educaro’s team works on exactly these.
              </>
            ) : (
              ', with nothing open.'
            )}
          </p>
          <p className="text-muted">You can keep uploading documents and answering questions afterwards. Your plan stays live.</p>
          <p className="text-[13px] text-muted">
            Educaro services: <ExternalLink href="https://www.educaro.de/india/">educaro.de/india</ExternalLink>
          </p>
        </div>
      </Dialog>
    </ScreenActionsProvider>
  );
}
