import type { TailorReportDTO } from '@educaro/shared';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, FileText, Send, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useDraftTailored, useTailorReport } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { SectionTitle } from '../ui/misc';
import { toast } from '../ui/Toast';

/**
 * A CV written for one university, and the email that carries it.
 *
 * The honest part is the gap list, and it is the reason this is worth showing rather than hiding
 * behind a "generate" button. A product that silently wrote the missing keywords onto the CV would
 * look better here and would be setting somebody up to fail an interview conducted in their third
 * language. So both columns are on screen: what we can evidence, and what their page wants that we
 * cannot — with the second one framed as the work to do, not as a verdict.
 */
export function TailorPanel({ shortlistId, title }: { shortlistId: string; title: string }) {
  const applicantId = useApplicantId();
  const { data: report, isLoading } = useTailorReport(applicantId, shortlistId);
  const [open, setOpen] = useState(false);

  if (isLoading || !report) return null;
  const have = report.matches.filter((m) => m.have);
  const gaps = report.missing;

  return (
    <section className="mt-3 rounded-[var(--r)] border border-line p-3.5">
      <SectionTitle
        action={
          <Button size="sm" icon={Wand2} onClick={() => setOpen(true)}>
            Write a CV for this
          </Button>
        }
      >
        How you match what they ask for
      </SectionTitle>

      <p className="mt-1 text-[12.5px] text-muted">
        Read from {report.pageOpened ? 'their own page, opened just now' : 'what we hold about this programme — their page would not open'}.{' '}
        <span className="num font-semibold text-ink">
          {report.requiredMatched}/{report.required}
        </span>{' '}
        of their stated requirements are evidenced by your documents.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">You can show</p>
          <ul className="mt-1.5 space-y-1">
            {have.length ? (
              have.map((m) => (
                <li key={m.term} className="flex items-start gap-1.5 text-[13px]">
                  <CheckCircle2 size={13} className="mt-[3px] flex-none text-ok" aria-hidden />
                  <span>
                    <span className="font-medium">{m.term}</span>
                    <span className="block text-[12px] text-muted">
                      {m.evidence} · {m.tag === 'verified' ? 'verified by a document' : 'you told me'}
                    </span>
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[13px] text-muted">Nothing on their list is evidenced yet.</li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">They want, you cannot show yet</p>
          <ul className="mt-1.5 space-y-1">
            {gaps.length ? (
              gaps.map((m) => (
                <li key={m.term} className="flex items-start gap-1.5 text-[13px]">
                  <AlertTriangle size={13} className={clsx('mt-[3px] flex-none', m.weight === 'required' ? 'text-warn' : 'text-muted')} aria-hidden />
                  <span>
                    <span className={m.weight === 'required' ? 'font-medium' : ''}>{m.term}</span>
                    {m.weight === 'required' ? <span className="ml-1.5 text-[11px] font-semibold uppercase text-warn">required</span> : null}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[13px] text-muted">Nothing — you meet everything their page states.</li>
            )}
          </ul>
          {gaps.length ? (
            <p className="mt-2 text-[12px] text-muted">
              I will not write these onto your CV. You would have to defend them in an interview, and a certificate closes the gap properly.
            </p>
          ) : null}
        </div>
      </div>

      {open ? <SendDialog shortlistId={shortlistId} title={title} report={report} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function SendDialog({ shortlistId, title, report, onClose }: { shortlistId: string; title: string; report: TailorReportDTO; onClose: () => void }) {
  const applicantId = useApplicantId();
  const draft = useDraftTailored(applicantId);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');

  return (
    <Dialog open title={`Write a CV for ${title}`} onClose={onClose}>
      <p className="text-[13px] text-muted">
        I will build a Lebenslauf that leads with the {report.matches.filter((m) => m.have).length} things you can evidence, write the email, and
        put both in front of you. Nothing is sent until you tap approve.
      </p>

      <label className="mt-4 block">
        <span className="label">Where should it go?</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          inputMode="email"
          placeholder="admissions@university.de"
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-agent"
        />
        <span className="mt-1 block text-[12px] text-muted">Leave it empty if you will upload the CV to their portal yourself.</span>
      </label>

      <label className="mt-3 block">
        <span className="label">Anything to add? (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="I have started the APS and expect the certificate in November."
          className="mt-1 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-agent"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          icon={Send}
          loading={draft.isPending}
          onClick={() =>
            draft.mutate(
              { shortlistId, to: to.trim() || undefined, note: note.trim() || undefined },
              {
                onSuccess: (r) => {
                  // Say where it will actually land. In safe mode a real university address is
                  // redirected to the demo inbox, and believing you have applied when you have not
                  // is the worst thing this screen could do to somebody.
                  toast(
                    r.willSendAsTyped
                      ? 'Written. Read it on your Inbox page and send it when you are happy.'
                      : to.trim()
                        ? `Written and waiting for you. Note: safe mode will deliver it to the Educaro demo inbox rather than ${to.trim()}.`
                        : 'Written. Download the CV from your Inbox page and upload it to their portal.',
                  );
                  onClose();
                },
                onError: () => toast('I could not build that one. Try again in a moment.', 'error'),
              },
            )
          }
        >
          Write it
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <FileText size={12} aria-hidden /> Nothing leaves without your tap.
        </span>
      </div>
    </Dialog>
  );
}
