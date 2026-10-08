import { useBatchPlan } from '../api/queries';
import { formatMonth } from '../lib/format';
import { PageHeader, Skeleton } from '../ui/misc';

const LEVELS = ['A2', 'B1', 'B2'] as const;
// One hue per level, so a column reads the same in the chart and the table.
const LEVEL_COLOR: Record<(typeof LEVELS)[number], string> = { A2: 'var(--applicant)', B1: 'var(--agent)', B2: 'var(--staff)' };

export default function PlannerPage() {
  const { data: plan, isLoading } = useBatchPlan();
  if (isLoading || !plan) return <Skeleton className="h-80 w-full max-w-4xl" />;

  const peak = Math.max(1, ...plan.months.map((m) => m.A2 + m.B1 + m.B2));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Batch planner">
        How many applicants need A2, B1 or B2 by which month, counted from their own plans. Use it to size course batches and ÖSD exam seats.
      </PageHeader>

      <div className="card px-4 py-5 sm:px-5">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {LEVELS.map((level) => (
            <span key={level} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_COLOR[level] }} aria-hidden />
              German {level}
              <span className="num font-semibold">{plan.totals[level]}</span>
            </span>
          ))}
        </div>

        {/* Stacked columns: each month is one bar, split by level. */}
        <div tabIndex={0} className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: 230 }} role="img" aria-label="Applicants needing each German level, by month">
          {plan.months.map((month) => {
            const total = month.A2 + month.B1 + month.B2;
            return (
              <div key={month.month} className="flex min-w-[52px] flex-1 flex-col items-center gap-1.5">
                <span className="num text-[12px] font-semibold">{total}</span>
                <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${(total / peak) * 160}px` }}>
                  {LEVELS.map((level) =>
                    month[level] ? (
                      <div
                        key={level}
                        className="w-full"
                        style={{ background: LEVEL_COLOR[level], height: `${(month[level] / total) * 100}%` }}
                        title={`${formatMonth(month.month)}: ${month[level]} need ${level}`}
                      />
                    ) : null,
                  )}
                </div>
                <span className="whitespace-nowrap text-[11.5px] text-muted">{formatMonth(month.month)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div tabIndex={0} className="tbl-wrap mt-5">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {LEVELS.map((l) => (
                <th key={l} scope="col" className="text-right">
                  Need {l}
                </th>
              ))}
              <th scope="col" className="text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.months.map((month) => (
              <tr key={month.month}>
                <th scope="row" className="whitespace-nowrap font-semibold">
                  {formatMonth(month.month)}
                </th>
                {LEVELS.map((l) => (
                  <td key={l} className="num text-right">
                    {month[l] || '—'}
                  </td>
                ))}
                <td className="num text-right font-semibold">{month.A2 + month.B1 + month.B2}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink">
              <th scope="row" className="font-bold">
                All months
              </th>
              {LEVELS.map((l) => (
                <td key={l} className="num text-right font-bold">
                  {plan.totals[l]}
                </td>
              ))}
              <td className="num text-right font-bold">{plan.totals.A2 + plan.totals.B1 + plan.totals.B2}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2.5 text-[12.5px] text-muted">Counted in code from each applicant’s gap plan and target start date, not estimated by a model.</p>
    </div>
  );
}
