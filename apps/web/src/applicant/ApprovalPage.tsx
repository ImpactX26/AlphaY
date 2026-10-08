import type { ApprovalDetailDTO, FactDTO, LetterPayload } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Paperclip, Pencil, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, errorText } from '../api/client';
import { qk, useApplicant, useApproval } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { hostOf } from '../lib/format';
import { approvalStatus } from '../lib/tags';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState, ExternalLink, Skeleton } from '../ui/misc';
import { FieldTag, RoleLabel, Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

function asLetter(approval: ApprovalDetailDTO): LetterPayload | null {
  const p = approval.payload as Partial<LetterPayload>;
  if (typeof p.body !== 'string' || typeof p.subject !== 'string') return null;
  return {
    to: p.to ?? '',
    cc: p.cc ?? [],
    replyTo: p.replyTo ?? '',
    subject: p.subject,
    body: p.body,
    sentences: p.sentences ?? [],
    keywords: p.keywords ?? [],
    attachments: p.attachments ?? [],
    targetUrl: p.targetUrl ?? null,
  };
}

/** Wraps the target's own keywords in a mark, so it is obvious the letter speaks their language. */
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <>{text}</>;
  const escaped = keywords
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  const lower = new Set(keywords.map((k) => k.toLowerCase()));
  return (
    <>
      {parts.map((part, i) =>
        lower.has(part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-[color-mix(in_srgb,var(--agent)_20%,transparent)] px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function FactChip({ fact }: { fact: FactDTO }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded border border-line bg-surface px-1.5 py-0.5 text-[11.5px]" title={fact.quote ?? fact.value}>
      <FieldTag tag={fact.tag} className="!px-1 !py-0 !text-[10px]" />
      <span className="truncate">{fact.value}</span>
    </span>
  );
}

export default function ApprovalPage() {
  const { approvalId = '' } = useParams();
  const applicantId = useApplicantId();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: approval, isLoading } = useApproval(approvalId);
  const { data: applicant } = useApplicant(applicantId);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const letter = approval ? asLetter(approval) : null;

  useEffect(() => {
    if (letter) {
      setSubject(letter.subject);
      setBody(letter.body);
    }
  }, [letter?.subject, letter?.body]);

  const factsById = useMemo(() => new Map((approval?.facts ?? []).map((f) => [f.id, f])), [approval?.facts]);
  const edited = letter !== null && (subject !== letter.subject || body !== letter.body);
  const pending = approval?.status === 'pending';
  const secondKey = Boolean(approval?.needsStaff || applicant?.staffSecondKey);

  const finish = (message: string) => {
    void qc.invalidateQueries({ queryKey: qk.approvals(applicantId) });
    void qc.invalidateQueries({ queryKey: qk.approval(approvalId) });
    void qc.invalidateQueries({ queryKey: qk.emails(applicantId) });
    toast(message);
  };

  const approve = async () => {
    setBusy('approve');
    try {
      await api.approve(approvalId, edited ? { subject, body } : undefined);
      finish(secondKey ? 'Approved. Educaro gives the second approval, then it goes out.' : 'Approved and sent.');
      navigate('/app/inbox');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy('reject');
    try {
      await api.reject(approvalId);
      finish('Not sent. Tell the agent what to change.');
      setConfirmReject(false);
      navigate('/app');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-80 w-full max-w-3xl" />;
  if (!approval) return <EmptyState title="This letter is gone" icon={X}>It may have been sent or withdrawn already.</EmptyState>;

  const status = approvalStatus(approval.status);

  return (
    <div className="max-w-5xl">
      <Link to="/app" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted no-underline hover:text-ink">
        <ArrowLeft size={15} aria-hidden />
        Back to your screen
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <RoleLabel role="agent">The writer drafted this</RoleLabel>
          <h1 className="display mt-2 text-[26px] font-black leading-tight sm:text-[30px]">{approval.title}</h1>
          <p className="mt-2 max-w-prose text-[14px] text-muted">
            Built from your Verified and You-said facts only, in the words they use themselves
            {letter?.targetUrl ? (
              <>
                {' '}
                on <ExternalLink href={letter.targetUrl}>{hostOf(letter.targetUrl)}</ExternalLink>
              </>
            ) : null}
            . Nothing is sent until you tap Approve.
          </p>
        </div>
        <Tag s={status} className="flex-none" />
      </header>

      {letter ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="card overflow-hidden">
            <dl className="divide-y divide-line border-b border-line text-[13.5px]">
              {(
                [
                  ['To', letter.to],
                  ['CC', letter.cc.join(', ')],
                  ['Reply-to', letter.replyTo],
                ] as const
              ).map(([label, value]) =>
                value ? (
                  <div key={label} className="flex gap-3 px-4 py-2 sm:px-5">
                    <dt className="w-[70px] flex-none text-muted">{label}</dt>
                    <dd className="min-w-0 break-words font-mono text-[12.5px]">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>

            <div className="px-4 py-4 sm:px-5">
              <label className="block">
                <span className="label">Subject</span>
                {editing ? (
                  <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                ) : (
                  <p className="text-[15px] font-semibold">
                    <Highlighted text={subject} keywords={letter.keywords} />
                  </p>
                )}
              </label>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="label mb-0">Letter</span>
                  <Button size="sm" variant="ghost" icon={editing ? Check : Pencil} onClick={() => setEditing((e) => !e)} disabled={!pending}>
                    {editing ? 'Done editing' : 'Edit the words'}
                  </Button>
                </div>
                {editing ? (
                  <textarea className="input min-h-[420px] font-sans text-[14.5px]" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Letter body" />
                ) : letter.sentences.length ? (
                  <ol className="space-y-2.5">
                    {letter.sentences.map((sentence, i) => {
                      const facts = sentence.factIds.map((id) => factsById.get(id)).filter((f): f is FactDTO => !!f);
                      return (
                        <li key={i} className="group grid gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2/60 lg:grid-cols-[minmax(0,1fr)_minmax(0,210px)] lg:gap-4">
                          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                            <Highlighted text={sentence.text} keywords={letter.keywords} />
                          </p>
                          {facts.length ? (
                            <div className="flex flex-wrap gap-1 lg:justify-end">
                              {facts.map((fact) => (
                                <FactChip key={fact.id} fact={fact} />
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                    <Highlighted text={body} keywords={letter.keywords} />
                  </p>
                )}
              </div>

              {letter.attachments.length ? (
                <div className="mt-5 border-t border-line pt-3">
                  <p className="label flex items-center gap-1.5">
                    <Paperclip size={14} aria-hidden />
                    Attached
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {letter.attachments.map((a) => (
                      <li key={a.name} className="chip font-mono !text-[11.5px]">
                        {a.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-3 sm:px-5">
              {pending ? (
                <>
                  <Button variant="approve" size="lg" icon={Check} loading={busy === 'approve'} onClick={approve}>
                    {secondKey ? 'Approve, then Educaro signs off' : edited ? 'Approve my edits and send' : 'Approve and send'}
                  </Button>
                  <Button variant="danger" icon={X} onClick={() => setConfirmReject(true)} disabled={busy !== null}>
                    Don’t send
                  </Button>
                  {edited ? <span className="text-[12.5px] font-medium text-warn">Your edits will be sent, not the draft.</span> : null}
                </>
              ) : (
                <p className="text-[13.5px] text-muted">
                  {approval.status === 'sent'
                    ? 'Sent. Replies land in your inbox and wake the agent.'
                    : approval.status === 'approved'
                      ? 'You approved it. Educaro gives the second approval, then it goes out.'
                      : 'Not sent. Tell the agent in the chat what to change.'}
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="card px-4 py-3.5">
              <h2 className="display text-[14.5px] font-bold">Their words, in your letter</h2>
              <p className="mt-1 text-[13px] text-muted">Pulled from the target’s own page. Matching their language is what gets a reply.</p>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {letter.keywords.map((k) => (
                  <li key={k} className="rounded bg-[color-mix(in_srgb,var(--agent)_16%,transparent)] px-2 py-1 text-[12.5px] font-medium">
                    {k}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card px-4 py-3.5">
              <h2 className="display flex items-center gap-2 text-[14.5px] font-bold">
                <ShieldCheck size={16} className="text-ok" aria-hidden />
                What the guards checked
              </h2>
              <ul className="mt-2 space-y-2 text-[13px]">
                {[
                  ['Only Verified and You-said facts', 'No AI-invented claims about you.'],
                  ['Every sentence links to a fact', 'Hover any line to see its sources.'],
                  ['Nothing leaves without a human tap', secondKey ? 'This one also needs Educaro’s second key.' : 'Yours is the only tap needed.'],
                ].map(([title, detail]) => (
                  <li key={title} className="flex gap-2">
                    <Check size={14} className="mt-0.5 flex-none text-ok" aria-hidden />
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-muted">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {approval.facts.length ? (
              <section className="card px-4 py-3.5">
                <h2 className="display text-[14.5px] font-bold">Facts used ({approval.facts.length})</h2>
                <ul className="mt-2 space-y-2">
                  {approval.facts.map((fact) => (
                    <li key={fact.id} className="text-[13px]">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <FieldTag tag={fact.tag} />
                        <span className="font-semibold">{fact.label}</span>
                      </span>
                      <span className="mt-0.5 block">{fact.value}</span>
                      {fact.sourceRef ? <span className="block font-mono text-[11.5px] text-muted">{fact.sourceRef}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="card px-4 py-4">
          <p className="text-[14px]">This approval is not a letter. Payload:</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-[12px]">{JSON.stringify(approval.payload, null, 2)}</pre>
          {pending ? (
            <div className="mt-4 flex gap-2">
              <Button variant="approve" icon={Check} loading={busy === 'approve'} onClick={approve}>
                Approve
              </Button>
              <Button variant="danger" icon={X} onClick={() => setConfirmReject(true)}>
                Don’t send
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <Dialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        title="Don’t send this letter?"
        description="The agent keeps the draft and waits for you. Tell it in the chat what to change and it writes a new one."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReject(false)}>
              Keep reviewing
            </Button>
            <Button variant="danger" loading={busy === 'reject'} onClick={reject}>
              Don’t send it
            </Button>
          </>
        }
      />
    </div>
  );
}
