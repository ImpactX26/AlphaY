import type { CohortBlock } from '@educaro/shared';
import clsx from 'clsx';
import { BlockFrame } from '../BlockFrame';

type Step = CohortBlock['steps'][number];

const STANDING: Record<Step['youAre'], { label: string; tone: string }> = {
  ahead: { label: 'Ahead', tone: 'text-ok' },
  on_track: { label: 'On track', tone: 'text-ok' },
  behind: { label: 'Behind', tone: 'text-warn' },
  not_started: { label: 'Not started', tone: 'text-muted' },
};

/**
 * How long each step actually took the people who were here before.
 *
 * Every applicant asks how long this takes, and an average off a government page is not an answer.
 * The bar is the real range; the tick is the median. `basis` is printed next to the heading because
 * a median of three files is not a trend, and the reader has to be able to see that for themselves.
 */
export function CohortCard({ block, bare }: { block: CohortBlock; bare?: boolean }) {
  const widest = Math.max(1, ...block.steps.map((s) => s.rangeWeeks[1]));

  return (
    <BlockFrame
      bare={bare}
      kicker={block.title ?? 'People who were where you are'}
      body={block.body}
      headerExtra={
        <span className="flex-none text-[12.5px] text-muted">
          from <span className="num font-semibold text-ink">{block.basis}</span>{' '}
          {block.basis === 1 ? 'file' : 'files'}
        </span>
      }
      footer={
        <span>
          Anonymised, {block.route} route. {block.basis < 8 ? 'Too few files to call this a trend yet — treat it as a hint.' : 'Medians and ranges from real dates, not estimates.'}
        </span>
      }
    >
      <ul className="space-y-3">
        {block.steps.map((s, i) => {
          const [lo, hi] = s.rangeWeeks;
          const standing = STANDING[s.youAre];
          return (
            <li key={`${s.label}-${i}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[14px] font-semibold">{s.label}</span>
                <span className="flex items-baseline gap-2.5 text-[12.5px]">
                  <span className={clsx('font-semibold', standing.tone)}>{standing.label}</span>
                  <span className="num text-muted">
                    {s.medianWeeks} {s.medianWeeks === 1 ? 'week' : 'weeks'} typical
                  </span>
                </span>
              </div>
              {/* The bar is the real spread; the tick is the median. */}
              <div
                className="relative mt-1.5 h-2.5 rounded-full bg-surface-2"
                role="img"
                aria-label={`${s.label}: usually ${s.medianWeeks} weeks, between ${lo} and ${hi}. You are ${standing.label.toLowerCase()}.`}
              >
                <span
                  className="absolute inset-y-0 rounded-full bg-[color-mix(in_srgb,var(--agent)_28%,transparent)]"
                  style={{ left: `${(lo / widest) * 100}%`, width: `${Math.max(((hi - lo) / widest) * 100, 2)}%` }}
                />
                <span
                  className="absolute inset-y-[-2px] w-[3px] rounded-full bg-agent"
                  style={{ left: `calc(${(s.medianWeeks / widest) * 100}% - 1.5px)` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11.5px] text-muted">
                <span className="num">{lo}w</span>
                <span className="num">{hi}w</span>
              </div>
            </li>
          );
        })}
      </ul>

      {block.peers.length ? (
        <ul className="mt-5 space-y-2 border-t border-line pt-4">
          {/* Peers are anonymised, so two can share a label: index keeps them distinct. */}
          {block.peers.map((p, i) => (
            <li key={`${p.label}-${i}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="text-[13.5px] font-semibold">{p.label}</span>
              <span className="text-[13.5px] text-muted">{p.headline}</span>
              <span className="ml-auto text-[12.5px] text-agent">{p.nowAt}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </BlockFrame>
  );
}
