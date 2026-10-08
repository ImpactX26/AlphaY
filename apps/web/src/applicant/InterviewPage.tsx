import type { InterviewDTO } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowLeft, Briefcase, GraduationCap, RotateCcw, Send, Stamp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, errorText } from '../api/client';
import { useApplicant } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { Button } from '../ui/Button';
import { Avatar, PageHeader } from '../ui/misc';
import { Spinner } from '../ui/Spinner';
import { Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

const KINDS: { kind: InterviewDTO['kind']; label: string; sub: string; icon: typeof Stamp }[] = [
  { kind: 'employer', label: 'Employer interview', sub: 'What the hiring manager will ask', icon: Briefcase },
  { kind: 'visa', label: 'Visa interview', sub: 'What the consulate will ask', icon: Stamp },
  { kind: 'university', label: 'University interview', sub: 'Motivation and your projects', icon: GraduationCap },
];

const scoreTone = (score: number) => (score >= 4 ? 't-ver' : score === 3 ? 't-warn' : 't-bad');

export default function InterviewPage() {
  const applicantId = useApplicantId();
  const { data: applicant } = useApplicant(applicantId);
  const [session, setSession] = useState<InterviewDTO | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [session?.turns.length]);

  const start = async (kind: InterviewDTO['kind']) => {
    setBusy(true);
    try {
      setSession(await api.startInterview(applicantId, kind));
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const answer = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !session || busy) return;
    setBusy(true);
    setText('');
    try {
      setSession(await api.answerInterview(session.id, value));
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const suggested = applicant?.route === 'study' ? 'university' : applicant?.route === 'nursing' || applicant?.route === 'skilled_job' ? 'employer' : 'visa';

  return (
    <div className="max-w-3xl">
      <Link to="/app/plan" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted no-underline hover:text-ink">
        <ArrowLeft size={15} aria-hidden />
        Back to your plan
      </Link>
      <PageHeader title="Interview coach">Answer out loud first, then type what you said. Each answer is scored against your own profile, not against a template.</PageHeader>

      {!session ? (
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {KINDS.map((k) => (
            <li key={k.kind}>
              <button
                type="button"
                className={clsx(
                  'flex h-full w-full flex-col items-start gap-2 rounded-xl border px-4 py-4 text-left transition-colors hover:border-ink',
                  k.kind === suggested ? 'border-agent/50 bg-agent/5' : 'border-line',
                )}
                disabled={busy}
                onClick={() => start(k.kind)}
              >
                <k.icon size={20} className="text-muted" aria-hidden />
                <span className="display text-[15px] font-bold">{k.label}</span>
                <span className="text-[13px] text-muted">{k.sub}</span>
                {k.kind === suggested ? <span className="tag t-web mt-auto">Suggested for your route</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <p className="text-[14px] font-semibold">{KINDS.find((k) => k.kind === session.kind)?.label}</p>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setSession(null)}>
              New session
            </Button>
          </div>

          <ul className="space-y-3.5 px-4 py-4">
            {session.turns.map((turn, i) => (
              <li key={i} className={clsx('flex gap-2.5', turn.role === 'applicant' && 'flex-row-reverse')}>
                {turn.role === 'coach' ? <Avatar name="AI" tone="agent" size={28} /> : null}
                <div className={clsx('min-w-0 max-w-[85%]', turn.role === 'applicant' && 'text-right')}>
                  <p
                    className={clsx(
                      'inline-block rounded-2xl px-3.5 py-2 text-left text-[14.5px] leading-relaxed',
                      turn.role === 'coach' ? 'rounded-bl-md border border-line bg-surface' : 'rounded-br-md bg-ink text-bg',
                    )}
                  >
                    {turn.text}
                  </p>
                  {turn.score ? (
                    <p className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
                      <Tag s={{ label: `${turn.score} / 5`, cls: scoreTone(turn.score) }} />
                      {turn.feedback ? <span className="text-[12.5px] text-muted">{turn.feedback}</span> : null}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
            {busy ? (
              <li className="flex items-center gap-2.5">
                <Avatar name="AI" tone="agent" size={28} />
                <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2 text-[13px] text-muted">
                  <Spinner size={13} className="text-agent" /> Scoring your answer
                </span>
              </li>
            ) : null}
            <div ref={endRef} />
          </ul>

          {session.status === 'active' ? (
            <form onSubmit={answer} className="flex items-end gap-2 border-t border-line bg-surface px-3 py-2.5">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Your answer</span>
                <textarea
                  className="input max-h-32 min-h-10 py-2"
                  rows={1}
                  value={text}
                  autoFocus
                  placeholder="Say it out loud, then type it here"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) void answer(e);
                  }}
                />
              </label>
              <Button type="submit" variant="primary" icon={Send} loading={busy} disabled={!text.trim()}>
                <span className="sr-only sm:not-sr-only">Answer</span>
              </Button>
            </form>
          ) : (
            <div className="border-t border-line bg-surface-2/40 px-4 py-3">
              <Button variant="primary" onClick={() => start(session.kind)}>
                Run it again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
