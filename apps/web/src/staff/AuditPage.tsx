import { useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { usePipeline, useStats, useTrace } from '../api/queries';
import { formatUsd } from '../lib/format';
import { PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { LlmBudget } from './StaffShell';
import { TraceTimeline } from './TraceTimeline';

export default function AuditPage() {
  const [params, setParams] = useSearchParams();
  const applicantId = params.get('applicantId') ?? '';
  const { data: trace, isLoading } = useTrace(applicantId || undefined);
  const { data: stats } = useStats();
  const { data: pipeline } = usePipeline();

  const totalCost = stats?.costPerApplicant.reduce((sum, c) => sum + c.costUsd, 0) ?? 0;
  const totalCalls = stats?.costPerApplicant.reduce((sum, c) => sum + c.llmCalls, 0) ?? 0;
  const cached = stats?.costPerApplicant.reduce((sum, c) => sum + c.cachedCalls, 0) ?? 0;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Trace and audit">Every plan, tool call, source the agent opened, guard event, approval and mail, in order, with what it cost.</PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted">Spent so far</p>
          <p className="display num mt-1 text-[24px] font-extrabold">{formatUsd(totalCost)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted">Model calls</p>
          <p className="display num mt-1 text-[24px] font-extrabold">{totalCalls}</p>
          <p className="text-[12px] text-muted">{cached} served from cache</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted">Applicants</p>
          <p className="display num mt-1 text-[24px] font-extrabold">{stats?.applicants ?? '—'}</p>
        </div>
        <div className="card px-4 py-3">
          <LlmBudget />
        </div>
      </div>

      {stats?.costPerApplicant.length ? (
        <section className="mb-7">
          <SectionTitle>Cost per applicant</SectionTitle>
          <div tabIndex={0} className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Applicant</th>
                  <th scope="col" className="text-right">
                    Model calls
                  </th>
                  <th scope="col" className="text-right">
                    From cache
                  </th>
                  <th scope="col" className="text-right">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...stats.costPerApplicant]
                  .sort((a, b) => b.costUsd - a.costUsd)
                  .map((row) => (
                    <tr key={row.applicantId}>
                      <th scope="row" className="font-semibold">
                        <Link to={`/staff/applicants/${row.applicantId}`} className="text-ink no-underline hover:underline">
                          {row.name}
                        </Link>
                      </th>
                      <td className="num text-right">{row.llmCalls}</td>
                      <td className="num text-right text-muted">{row.cachedCalls}</td>
                      <td className="num text-right font-semibold">{formatUsd(row.costUsd)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[12.5px] text-muted">
            Cheap-tier calls (Groq) are free. Only quality-tier calls count against the cap, and every response is cached by prompt hash, so a replay costs nothing.
          </p>
        </section>
      ) : null}

      <section>
        <SectionTitle
          action={
            <label className="flex items-center gap-2 text-[13px]">
              <span className="text-muted">Applicant</span>
              <select
                className="input !min-h-8 !w-auto !py-1 !text-[13px]"
                value={applicantId}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set('applicantId', e.target.value);
                  else next.delete('applicantId');
                  setParams(next, { replace: true });
                }}
              >
                <option value="">Everyone</option>
                {pipeline?.map((c) => (
                  <option key={c.applicantId} value={c.applicantId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          The trace
        </SectionTitle>
        {isLoading ? <Skeleton className="h-64 w-full" /> : <div className="card px-4 py-4">
          <TraceTimeline trace={trace} showApplicant={!applicantId} />
        </div>}
      </section>
    </div>
  );
}
