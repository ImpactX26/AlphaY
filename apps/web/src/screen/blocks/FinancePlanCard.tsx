import type { FinancePlanBlock } from '@educaro/shared';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { BlockFrame } from '../BlockFrame';

const euro = (n: number) => `€${Math.round(n).toLocaleString('en-GB')}`;

/**
 * Money over time, in the currency they actually think in.
 *
 * The one-off costs are in the order they land, not sorted by size, because the question this
 * answers is "when do I need it" — and the blocked account arriving three months before departure
 * is what decides whether a plan is real.
 *
 * The plan is denominated in euro and every decision about it is taken in rupees: a father, a bank
 * manager, a brother-in-law who has done this before. So the second figure is not decoration. It
 * used to be computed from a hardcoded 92 rupees to the euro, which was wrong against the real rate
 * by about 17% — roughly two lakh on the blocked account, in the one number somebody carries into a
 * bank. It now comes from the ECB's daily reference rates, and says which day it is from.
 */
export function FinancePlanCard({ block, bare }: { block: FinancePlanBlock; bare?: boolean }) {
  const [code, setCode] = useState<string>('INR');
  const rates = block.rates?.perEur ?? { EUR: 1, INR: block.inrPerEur };
  const list = block.currencies ?? [
    { code: 'EUR', label: 'Euro', symbol: '€' },
    { code: 'INR', label: 'Indian rupee', symbol: '₹' },
  ];
  const active = list.find((c) => c.code === code) ?? list[0];
  const rate = rates[active.code];

  /** The second figure. Null rather than a wrong number when we cannot price that currency. */
  const other = (eur: number): string | null => {
    if (active.code === 'EUR' || typeof rate !== 'number') return null;
    const n = Math.round(eur * rate);
    // Indian grouping: the point of the conversion is that the figure can be read aloud at home,
    // and a Western-grouped lakh is a number Indian readers have to stop and decode.
    return `${active.symbol}${n.toLocaleString(active.code === 'INR' ? 'en-IN' : 'en-GB')}`;
  };

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
      footer={
        block.rates
          ? `${block.rates.live ? "Today's" : 'Last known'} rate, ${block.rates.date}: 1 EUR = ${rate?.toFixed(2) ?? '—'} ${active.code}. ${block.rates.source}.`
          : `Converted at about ₹${block.inrPerEur} to the euro — indicative only.`
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] text-muted">Show in</span>
        {list.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCode(c.code)}
            aria-pressed={code === c.code}
            className={clsx(
              'rounded-full border px-2.5 py-0.5 text-[12px] transition',
              code === c.code ? 'border-ink bg-ink font-medium text-surface' : 'border-line hover:border-ink/40',
            )}
          >
            {c.code}
          </button>
        ))}
      </div>

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
              {other(o.amountEur) ? <span className="num block text-[11.5px] text-muted">{other(o.amountEur)}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-2">
        <span className="text-[14px] font-semibold">Before you fly</span>
        <span className="text-right">
          <span className="num block text-[16px] font-bold">{euro(block.needBeforeTravelEur)}</span>
          {other(block.needBeforeTravelEur) ? <span className="num block text-[12px] text-muted">{other(block.needBeforeTravelEur)}</span> : null}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">
        Then about {euro(block.monthlyEur)}
        {other(block.monthlyEur) ? ` (${other(block.monthlyEur)})` : ''} a month once you are there.
      </p>

      {/* The flat-share is the one lever here that changes the arithmetic rather than the advice. */}
      {block.sharing ? (
        <p className="mt-2 rounded-md border border-ok/40 bg-[color-mix(in_srgb,var(--ok)_8%,transparent)] px-3 py-2 text-[13px]">
          Sharing with {block.sharing.others} other{block.sharing.others === 1 ? '' : 's'} is already counted above — your room is about{' '}
          <span className="num font-semibold">{euro(block.sharing.shareEachEur)}</span> rather than one of your own, and the deposit falls with it.
        </p>
      ) : null}

      {block.fundingGapEur !== null && block.fundingGapEur > 0 ? (
        <p className="mt-2 rounded-md border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[13px]">
          Still to find: <span className="num font-semibold">{euro(block.fundingGapEur)}</span>
          {other(block.fundingGapEur) ? <span className="num text-muted"> ({other(block.fundingGapEur)})</span> : null}
        </p>
      ) : null}

      {block.options.length ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer font-medium">Ways people cover it</summary>
          <ul className="mt-2 space-y-2.5">
            {block.options.map((o, i) => (
              <li key={i} className="rounded-md border border-line px-3 py-2">
                <p className="text-[13.5px] font-medium">
                  {o.url ? (
                    <a href={o.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {o.label}
                      <ExternalLink size={11} className="ml-1 inline align-[-1px]" aria-hidden />
                    </a>
                  ) : (
                    o.label
                  )}
                  {/* The thing people most need to know, and the hardest thing to find out. */}
                  {o.replacesBlockedAccount ? <span className="ml-2 align-middle text-[11px] font-semibold uppercase text-ok">replaces the blocked account</span> : null}
                </p>
                <p className="mt-1 text-[12.5px] text-muted">{o.detail}</p>
                {o.eligibility ? (
                  <p className="mt-1 text-[12.5px] text-muted">
                    <span className="font-medium text-ink">Who it is for:</span> {o.eligibility}
                  </p>
                ) : null}
                {o.monthlyRepaymentEur ? (
                  <p className="mt-1 text-[12.5px]">
                    <span className="font-medium">About {euro(o.monthlyRepaymentEur)} a month</span>
                    {other(o.monthlyRepaymentEur) ? <span className="text-muted"> ({other(o.monthlyRepaymentEur)})</span> : null}
                    <span className="text-muted"> over seven years at 10%.</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </BlockFrame>
  );
}
