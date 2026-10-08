import type { EmployerRatingDTO } from '@educaro/shared';
import clsx from 'clsx';
import { Building2, ShieldAlert, Star } from 'lucide-react';
import { Link } from 'react-router';
import { useEmployerRatings, useEmployerReports } from '../api/queries';
import { EmptyState, PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { relativeTime } from '../lib/format';

/**
 * What employers are actually like, built from what applicants tell us privately.
 *
 * The rating is only ever an aggregate. One report is a person's experience and is not a rating —
 * publishing it as one would both misrepresent an employer over a single bad week and make the
 * reporter identifiable, which is the thing we promised would not happen. Below three reports the
 * page says so instead of showing a score.
 *
 * Staff see the reports themselves with names, because they have to act on them. The employer never
 * does, and the reporter is never named to them.
 */

const THEME_LABEL: Record<string, string> = {
  pay: 'pay',
  hours: 'hours',
  housing: 'accommodation',
  documents: 'documents',
  respect: 'treatment',
  safety: 'safety',
  other: 'other',
};

export default function EmployersPage() {
  const { data: ratings, isLoading } = useEmployerRatings();
  const { data: reports } = useEmployerReports();

  const rated = (ratings ?? []).filter((r) => r.reports > 0);

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Employers">
        Built only from what applicants tell us privately. One report is somebody's experience and is not a rating; three reports about
        hours from three different people is a fact about an employer, and the people who come after deserve it.
      </PageHeader>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !rated.length ? (
        <EmptyState title="No reports yet" icon={Building2}>
          Nobody has told us about an employer. The button lives on the applicant's Safety page.
        </EmptyState>
      ) : (
        <ul className="mt-5 space-y-3">
          {rated.map((e) => (
            <RatingRow key={e.employer} rating={e} />
          ))}
        </ul>
      )}

      {reports?.length ? (
        <>
          <SectionTitle className="mt-7">Every report, newest first</SectionTitle>
          <p className="mt-1 text-[12.5px] text-muted">
            You see who sent each one because you have to act on it. The employer never does, and is never told who reported them.
          </p>
          <ul className="mt-2 space-y-2.5">
            {reports.map((r) => (
              <li
                key={r.id}
                className={clsx('rounded-md border px-3 py-2.5', r.severity === 'serious' ? 'border-bad/50 bg-[color-mix(in_srgb,var(--bad)_6%,transparent)]' : 'border-line')}
              >
                <p className="flex flex-wrap items-baseline gap-2 text-[13.5px]">
                  <span className="font-semibold">{r.employer}</span>
                  <span className="text-muted">· {THEME_LABEL[r.category] ?? r.category}</span>
                  {r.severity === 'serious' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-bad">
                      <ShieldAlert size={12} aria-hidden /> serious
                    </span>
                  ) : null}
                  <span className="ml-auto text-[12px] text-muted">{relativeTime(r.createdAt)}</span>
                </p>
                <p className="mt-1 text-[13px]">{r.text}</p>
                <p className="mt-1 text-[12px] text-muted">
                  From{' '}
                  {r.applicantId ? (
                    <Link to={`/staff/applicants/${r.applicantId}`} className="underline underline-offset-2">
                      {r.applicantName ?? 'an applicant'}
                    </Link>
                  ) : (
                    (r.applicantName ?? 'an applicant')
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function RatingRow({ rating: e }: { rating: EmployerRatingDTO }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[var(--r)] border border-line px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{e.employer}</span>
        <span className="block text-[12.5px] text-muted">
          {e.reports} report{e.reports === 1 ? '' : 's'}
          {e.serious ? `, ${e.serious} serious` : ''}
          {e.themes.length ? ` · ${e.themes.map((t) => THEME_LABEL[t] ?? t).join(', ')}` : ''}
          {e.latest ? ` · latest ${relativeTime(e.latest)}` : ''}
        </span>
      </span>
      {/* Below three reports there is no score, because there is not enough to make one honestly. */}
      {e.confident ? (
        <span className="flex flex-none items-center gap-1.5">
          <Star size={15} className={clsx('flex-none', e.rating >= 3.5 ? 'text-ok' : e.rating >= 2.5 ? 'text-warn' : 'text-bad')} aria-hidden />
          <span className="num text-[16px] font-bold">{e.rating.toFixed(1)}</span>
          <span className="text-[12px] text-muted">/ 5</span>
        </span>
      ) : (
        <span className="flex-none rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">Too few reports to rate</span>
      )}
    </li>
  );
}
