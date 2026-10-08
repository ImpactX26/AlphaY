import type { CohortGroupBlock, FinancePlanBlock, HelpBlock, RealityCheckBlock, ScamCheckBlock } from '@educaro/shared';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, CircleAlert, ExternalLink, Scale, ShieldCheck, Users } from 'lucide-react';
import { BlockFrame } from '../BlockFrame';

const euro = (n: number) => `€${Math.round(n).toLocaleString('en-GB')}`;

/* ------------------------------------------------------------------ scam check */

const VERDICT: Record<ScamCheckBlock['verdict'], { label: string; tone: 'success' | 'warn' | 'accent'; icon: typeof ShieldCheck }> = {
  looks_legitimate: { label: 'Looks legitimate', tone: 'success', icon: ShieldCheck },
  be_careful: { label: 'Be careful', tone: 'warn', icon: CircleAlert },
  high_risk: { label: 'High risk — do not pay', tone: 'warn', icon: AlertTriangle },
};

const SIGNAL_DOT: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
};

const SEVERITY: Record<'unfair' | 'illegal' | 'watch', string> = {
  illegal: 'Not enforceable in Germany',
  unfair: 'Unfair',
  watch: 'Worth checking',
};

/**
 * Is this real?
 *
 * The verdict leads, because somebody reading this is deciding whether to send money today. Every
 * signal says why underneath it — a score with no reasons teaches nobody to spot the next one, and
 * the next one will arrive when this product is not in front of them.
 */
export function ScamCheckCard({ block, bare }: { block: ScamCheckBlock; bare?: boolean }) {
  const v = VERDICT[block.verdict];
  const Icon = v.icon;

  return (
    <BlockFrame
      bare={bare}
      tone={v.tone}
      kicker={block.title ?? `Is ${block.subject.name} real?`}
      body={block.body}
      headerExtra={
        <span className="flex-none text-[12.5px] text-muted">
          <span className="num font-semibold text-ink">{block.score}</span>/100
        </span>
      }
    >
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <Icon size={18} className={clsx('flex-none', block.verdict === 'looks_legitimate' ? 'text-ok' : 'text-warn')} aria-hidden />
        {v.label}
      </p>

      {block.signals.length ? (
        <ul className="mt-3 space-y-2">
          {block.signals.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={clsx('mt-[7px] h-2 w-2 flex-none rounded-full', SIGNAL_DOT[s.status])} aria-hidden />
              <span className="text-[13.5px]">
                <span className="font-medium">{s.label}.</span> <span className="text-muted">{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {block.contractFlags.length ? (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <Scale size={13} aria-hidden /> In the contract
          </p>
          <ul className="mt-2 space-y-2.5">
            {block.contractFlags.map((f, i) => (
              <li key={i} className="rounded-md border border-line px-3 py-2">
                <p className="text-[13.5px] font-medium">
                  {f.clause}
                  <span className={clsx('ml-2 align-middle text-[11px] font-semibold uppercase', f.severity === 'illegal' ? 'text-bad' : 'text-warn')}>{SEVERITY[f.severity]}</span>
                </p>
                <p className="mt-1 text-[13px] text-muted">{f.why}</p>
                <p className="mt-1 text-[13px] text-muted">
                  <span className="font-medium text-ink">The law says:</span> {f.lawSays}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {block.neverDo.length ? (
        <details className="mt-4 text-[13px]">
          {/* Counted, not hardcoded: the API decides how many rules it sends. */}
          <summary className="cursor-pointer font-medium">
            {block.neverDo.length} {block.neverDo.length === 1 ? 'thing' : 'things'} never to do
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {block.neverDo.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </BlockFrame>
  );
}

/* ------------------------------------------------------------------ finance plan */

/**
 * Money over time.
 *
 * The one-off costs are in the order they land, not sorted by size, because the question this
 * answers is "when do I need it" — and the blocked account arriving three months before departure
 * is the thing that decides whether a plan is real.
 */
export function FinancePlanCard({ block, bare }: { block: FinancePlanBlock; bare?: boolean }) {
  const inr = (eur: number) => `₹${Math.round((eur * block.inrPerEur) / 1000)}k`;

  return (
    <BlockFrame
      bare={bare}
      kicker={block.title ?? 'What you need, and when'}
      body={block.body}
      headerExtra={
        <span className="flex-none text-[12.5px] text-muted">
          <span className="num font-semibold text-ink">{euro(block.needBeforeTravelEur)}</span> before you fly
        </span>
      }
      footer={`Converted at about ₹${block.inrPerEur} to the euro — indicative only.`}
    >
      <ul className="divide-y divide-line">
        {block.oneOff.map((o, i) => (
          <li key={i} className="flex items-baseline gap-3 py-2">
            <span className="w-[72px] flex-none text-[12.5px] text-muted">{o.whenMonth}</span>
            <span className="min-w-0 flex-1">
              <span className="text-[13.5px] font-medium">{o.label}</span>
              {o.note ? <span className="block text-[12.5px] text-muted">{o.note}</span> : null}
            </span>
            <span className="flex-none text-right">
              <span className="num text-[13.5px] font-semibold">{euro(o.amountEur)}</span>
              <span className="block text-[11.5px] text-muted">{inr(o.amountEur)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-2">
        <span className="text-[14px] font-semibold">Before you fly</span>
        <span className="num text-[16px] font-bold">{euro(block.needBeforeTravelEur)}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">Then about {euro(block.monthlyEur)} a month once you are there.</p>

      {block.fundingGapEur !== null && block.fundingGapEur > 0 ? (
        <p className="mt-2 rounded-md border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[13px]">
          Still to find: <span className="num font-semibold">{euro(block.fundingGapEur)}</span>
        </p>
      ) : null}

      {block.options.length ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer font-medium">Ways people cover it</summary>
          <ul className="mt-2 space-y-1.5 text-muted">
            {block.options.map((o, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{o.label}.</span> {o.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </BlockFrame>
  );
}

/* ------------------------------------------------------------------ reality check */

/**
 * The honest preview.
 *
 * The hard parts come first, above the shifts and the money. Putting them last would make this a
 * brochure with a disclaimer, and the whole reason it earns trust is that it leads with the thing
 * nobody else tells you.
 */
export function RealityCheckCard({ block, bare }: { block: RealityCheckBlock; bare?: boolean }) {
  return (
    <BlockFrame bare={bare} kicker={block.title ?? 'What this is actually like'} body={block.body} footer={block.source}>
      <p className="text-[14.5px] font-medium">{block.headline}</p>

      {block.hard.length ? (
        <ul className="mt-3 space-y-2">
          {block.hard.map((h, i) => (
            <li key={i} className="rounded-md bg-surface-2 px-3 py-2">
              <p className="text-[13.5px] font-semibold">{h.stat}</p>
              <p className="mt-0.5 text-[13px] text-muted">{h.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Facts title="The work" items={block.shifts} />
        <Facts title="The money" items={block.money} />
      </div>

      {block.voices.length ? (
        <ul className="mt-4 space-y-2.5">
          {block.voices.map((v, i) => (
            <li key={i} className="border-l-2 border-line pl-3">
              <p className="text-[13.5px] italic">“{v.quote}”</p>
              <p className="mt-0.5 text-[12px] text-muted">{v.who}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </BlockFrame>
  );
}

function Facts({ title, items }: { title: string; items: { label: string; detail: string }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="text-[13px]">
            <span className="font-medium">{s.label}.</span> <span className="text-muted">{s.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ cohort group */

/** Who else is going to the same city the same month, and what that makes possible. */
export function CohortGroupCard({ block, bare }: { block: CohortGroupBlock; bare?: boolean }) {
  return (
    <BlockFrame
      bare={bare}
      tone="accent"
      kicker={block.title ?? `Others arriving in ${block.city}`}
      body={block.body}
      headerExtra={
        <span className="flex-none text-[12.5px] text-muted">
          <Users size={13} className="mr-1 inline align-[-2px]" aria-hidden />
          {block.month}
        </span>
      }
      footer="First names only until everyone agrees to share more."
    >
      <ul className="flex flex-wrap gap-2">
        {block.members.map((m, i) => (
          <li key={i} className="rounded-full border border-line px-3 py-1 text-[13px]">
            <span className="font-medium">{m.label}</span>
            <span className="text-muted"> · {m.route.replace(/_/g, ' ')}</span>
            {m.sharedInterest ? <span className="text-muted"> · {m.sharedInterest}</span> : null}
          </li>
        ))}
      </ul>

      {block.flatShare ? (
        <p className="mt-3 text-[13.5px]">
          A flat for {block.flatShare.seats} in {block.flatShare.district} works out around{' '}
          <span className="num font-semibold">{euro(block.flatShare.budgetEachEur)}</span> each — less than any of you would pay alone.
        </p>
      ) : null}
      {block.travel ? (
        <p className="mt-2 text-[13px] text-muted">
          <span className="font-medium text-ink">{block.travel.label}.</span> {block.travel.detail}
        </p>
      ) : null}
    </BlockFrame>
  );
}

/* ------------------------------------------------------------------ help */

/**
 * What applies whatever the employer says, and one tap to say something is wrong.
 *
 * Framed and toned, because this is the block somebody opens on a bad day and it should be findable
 * without reading. The rights are listed before the contacts: knowing the rule is what makes
 * somebody willing to make the call.
 */
export function HelpCard({ block, bare }: { block: HelpBlock; bare?: boolean }) {
  return (
    <BlockFrame bare={bare} tone="quiet" kicker={block.title ?? 'Your rights, and help if you need it'} body={block.body}>
      <ul className="space-y-2">
        {block.rights.map((r, i) => (
          <li key={i} className="flex gap-2.5">
            <CheckCircle2 size={15} className="mt-[3px] flex-none text-ok" aria-hidden />
            <span className="text-[13.5px]">
              <span className="font-medium">{r.title}.</span> <span className="text-muted">{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px]">{block.reportHint}</p>

      <ul className="mt-3 space-y-1.5">
        {block.contacts.map((c, i) => (
          <li key={i} className="text-[13px]">
            {c.url ? (
              <a href={c.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                {c.label}
                <ExternalLink size={12} className="ml-1 inline align-[-1px]" aria-hidden />
              </a>
            ) : (
              <span className="font-medium">{c.label}</span>
            )}
            <span className="text-muted"> — {c.detail}</span>
          </li>
        ))}
      </ul>
    </BlockFrame>
  );
}
