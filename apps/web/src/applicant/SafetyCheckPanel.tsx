import type { SafetyCheckDTO, SafetyCheckInput } from '@educaro/shared';
import clsx from 'clsx';
import { AlertTriangle, CircleAlert, History, Scale, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useCheckHistory, useRunCheck } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { ScamCheckCard } from '../screen/blocks/safety';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/misc';

/**
 * "Someone sent me this. Is it real?"
 *
 * This is the question applicants ask a WhatsApp group at midnight, and the answer they get is a
 * guess from somebody equally far from Germany. Everything needed to settle it was already in the
 * API — registers, domain checks, the clause rules — and none of it could be reached, because the
 * screen only ever showed an automatic check of whatever was top of their shortlist. That is always
 * a real university, so the block always said "looks legitimate" and the whole feature read as
 * decoration.
 *
 * So: a box you paste into. The thing people actually have at the moment they are worried is the
 * message itself, which is why the text area is the primary field and the URL is secondary — the
 * other way round would ask them to go and find something before we will help.
 */

const KINDS: { value: SafetyCheckInput['kind']; label: string; hint: string }[] = [
  { value: 'offer', label: 'An offer or message', hint: 'Paste the whole letter or message, including the signature.' },
  { value: 'employer', label: 'An employer', hint: 'The hospital, clinic or company. Paste the contract if you have one.' },
  { value: 'university', label: 'A university', hint: 'I check it against the register of recognised German institutions.' },
  { value: 'landlord', label: 'A landlord or flat', hint: 'Paste the listing or the message. A Mietvertrag gets the rental clause check.' },
  { value: 'agent', label: 'An agent or recruiter', hint: 'The person asking you for money, documents or a fee.' },
];

const VERDICT_CHIP: Record<string, string> = {
  looks_legitimate: 'text-ok',
  be_careful: 'text-warn',
  high_risk: 'text-bad',
};

export function SafetyCheckPanel() {
  const applicantId = useApplicantId();
  const run = useRunCheck(applicantId);
  const { data: history } = useCheckHistory(applicantId);

  const [kind, setKind] = useState<SafetyCheckInput['kind']>('offer');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<SafetyCheckDTO | null>(null);

  const active = KINDS.find((k) => k.value === kind)!;
  const nothingToCheck = !text.trim() && !url.trim() && !email.trim() && !name.trim();

  function submit() {
    if (nothingToCheck || run.isPending) return;
    run.mutate(
      { kind, text: text.trim() || undefined, url: url.trim() || undefined, email: email.trim() || undefined, name: name.trim() || undefined },
      { onSuccess: setResult },
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--r)] border border-agent/40 bg-[color-mix(in_srgb,var(--agent)_4%,var(--surface))] p-4 shadow-[var(--lift)] sm:p-[18px]">
        <h2 className="display text-[17px] font-bold leading-snug">Someone sent you something. Is it real?</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          Paste it here before you reply, pay anything or send a document. I open the page if there is one, check it against the public
          registers, and read every clause against German law. Nothing you paste leaves Educaro.
        </p>

        <fieldset className="mt-4">
          <legend className="text-[12px] font-semibold uppercase tracking-wide text-muted">What is it?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-[13px] transition',
                  kind === k.value ? 'border-agent bg-agent text-white font-medium' : 'border-line hover:border-agent/50',
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">The message or contract</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={active.hint}
            className="mt-1.5 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-agent"
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[12px] text-muted">Their website</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-agent"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">The email it came from</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              placeholder="name@…"
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-agent"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Their name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who is it from?"
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-agent"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Search} onClick={submit} loading={run.isPending} disabled={nothingToCheck}>
            {run.isPending ? 'Checking' : 'Check it'}
          </Button>
          <span className="text-[12.5px] text-muted">
            {run.isPending ? 'Opening their page and reading the clauses.' : nothingToCheck ? 'Paste anything above to start.' : 'Takes a few seconds.'}
          </span>
        </div>

        {run.isError ? (
          <p className="mt-3 rounded-md border border-bad/40 bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[13px]">
            I could not finish that check. Try again, and if it keeps failing tell a consultant rather than deciding without it.
          </p>
        ) : null}
      </section>

      {result ? <CheckResult result={result} /> : null}

      {history?.length ? (
        <section>
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <History size={14} aria-hidden /> What you have checked
            </span>
          </SectionTitle>
          <ul className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  <span className="font-medium">{h.subject}</span> <span className="text-muted">· {h.kind}</span>
                </span>
                <span className={clsx('flex-none text-[12.5px] font-medium', VERDICT_CHIP[h.verdict])}>{h.verdict.replace(/_/g, ' ')}</span>
                <span className="num flex-none text-[12.5px] text-muted">{h.score}/100</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The answer to the check they just ran.
 *
 * It reuses the same card the agent puts on the screen, so a result you asked for and a result the
 * agent found look identical — they are the same finding, and showing them differently would imply
 * one is worth less. The headline above it is the one-line verdict, because the rest of the card is
 * reasons and somebody deciding right now reads the first line.
 */
function CheckResult({ result }: { result: SafetyCheckDTO }) {
  const illegal = result.contractFlags.filter((f) => f.severity === 'illegal').length;
  const Icon = result.verdict === 'looks_legitimate' ? ShieldCheck : result.verdict === 'be_careful' ? CircleAlert : AlertTriangle;

  return (
    <div>
      <p
        className={clsx(
          'flex items-start gap-2.5 rounded-md border px-4 py-3 text-[15px] font-semibold',
          result.verdict === 'looks_legitimate'
            ? 'border-ok/40 bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]'
            : 'border-bad/40 bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]',
        )}
        role="status"
      >
        <Icon size={19} className={clsx('mt-[1px] flex-none', result.verdict === 'looks_legitimate' ? 'text-ok' : 'text-bad')} aria-hidden />
        <span>
          {result.verdict === 'high_risk'
            ? 'Do not send money or documents to this one.'
            : result.verdict === 'be_careful'
              ? 'Some of this does not add up. Go through it with a consultant first.'
              : 'Nothing here looks wrong to me.'}
          {illegal ? (
            <span className="block font-normal text-[13.5px]">
              <Scale size={13} className="mr-1 inline align-[-2px]" aria-hidden />
              {illegal} clause{illegal === 1 ? '' : 's'} in what you pasted {illegal === 1 ? 'is' : 'are'} not enforceable in Germany, whatever the
              contract says.
            </span>
          ) : null}
        </span>
      </p>
      <div className="mt-3">
        <ScamCheckCard block={{ ...result, type: 'scam_check' }} />
      </div>
    </div>
  );
}
