import type { DocStandardDTO, FailingDocDTO } from '@educaro/shared';
import clsx from 'clsx';
import { AlertTriangle, FileWarning, Pause, Play, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useDocStandards, useFailingDocuments, useUpdateStandard } from '../api/queries';
import { Button } from '../ui/Button';
import { EmptyState, PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { relativeTime } from '../lib/format';

/**
 * What a document is checked against.
 *
 * A judge asked the question and the answer used to be "a model read it and we believed the
 * fields", which is a summary rather than a standard. A consulate does not return a paper because a
 * model was unsure; it returns it because the issuer is not recognised, or the name does not match
 * the passport, or the letter is unsigned.
 *
 * So: the rules, per document kind, with the authority each comes from — and next to them, every
 * document on the caseload that currently fails one. The second list is the one a consultant works
 * from on a Monday morning.
 */

const RULE_LABEL: Record<string, string> = {
  required_field: 'Must state',
  not_expired: 'Must still be valid',
  max_age_months: 'Must be recent',
  min_level: 'Minimum level',
  min_score: 'Minimum score',
  issuer_allowed: 'Recognised issuer',
  name_matches_passport: 'Name matches the passport',
  has_signature_or_stamp: 'Signed and stamped',
  min_legible_length: 'Readable scan',
};

export default function StandardsPage() {
  const { data: standards, isLoading } = useDocStandards();
  const { data: failing } = useFailingDocuments();

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Document standards">
        When an applicant uploads a certificate, this is what decides whether it counts. Every rule names the authority it comes from, so a
        disagreement is with a source rather than with us — and every check runs in code, because an answer about somebody's paperwork has
        to be the same twice.
      </PageHeader>

      {failing?.length ? (
        <section className="mt-5 rounded-[var(--r)] border border-bad/40 bg-[color-mix(in_srgb,var(--bad)_5%,var(--surface))] p-4">
          <h2 className="display flex items-center gap-2 text-[16px] font-bold">
            <FileWarning size={17} className="flex-none text-bad" aria-hidden />
            {failing.length} document{failing.length === 1 ? '' : 's'} will not be accepted as {failing.length === 1 ? 'it stands' : 'they stand'}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {failing.map((f) => (
              <FailingRow key={f.fileId} doc={f} />
            ))}
          </ul>
        </section>
      ) : null}

      <SectionTitle className="mt-6">The standards</SectionTitle>
      {isLoading ? (
        <div className="mt-2 space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : !standards?.length ? (
        <EmptyState title="No standards yet" icon={ShieldCheck}>
          The defaults are written on the first boot. Restart the API if this stays empty.
        </EmptyState>
      ) : (
        <ul className="mt-2 space-y-3">
          {standards.map((s) => (
            <StandardCard key={s.id} standard={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FailingRow({ doc }: { doc: FailingDocDTO }) {
  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2.5">
      <p className="text-[13.5px]">
        <Link to={`/staff/applicants/${doc.applicantId}`} className="font-semibold underline underline-offset-2">
          {doc.applicantName}
        </Link>
        <span className="text-muted"> · {doc.originalName}</span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {doc.failed.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px]">
            <AlertTriangle size={13} className="mt-[3px] flex-none text-bad" aria-hidden />
            <span>
              <span className="font-medium">{RULE_LABEL[f.rule] ?? f.rule}:</span> <span className="text-muted">found {f.found}, expected {f.expected}.</span>{' '}
              {f.because}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[12px] text-muted">
        Checked against {doc.standard} — {doc.authority}
      </p>
    </li>
  );
}

function StandardCard({ standard: s }: { standard: DocStandardDTO }) {
  const update = useUpdateStandard();

  return (
    <li className={clsx('rounded-[var(--r)] border p-4', s.active ? 'border-line' : 'border-line bg-surface-2/40 opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{s.label}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {s.authority} · {s.rules.length} rule{s.rules.length === 1 ? '' : 's'} · edited {relativeTime(s.updatedAt)}
          </p>
        </div>
        <Button size="sm" icon={s.active ? Pause : Play} onClick={() => update.mutate({ id: s.id, active: !s.active })}>
          {s.active ? 'Stop enforcing' : 'Enforce'}
        </Button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {s.rules.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px]">
            {r.severity === 'blocking' ? (
              <AlertTriangle size={13} className="mt-[3px] flex-none text-warn" aria-hidden />
            ) : (
              <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-muted" aria-hidden />
            )}
            <span>
              <span className="font-medium">
                {RULE_LABEL[r.kind] ?? r.kind}
                {r.field ? ` — ${r.field}` : ''}
                {r.value !== undefined ? ` (${r.value})` : ''}
                {r.options?.length ? ` (${r.options.slice(0, 4).join(', ')}…)` : ''}
              </span>
              <span className={clsx('ml-2 align-middle text-[11px] font-semibold uppercase', r.severity === 'blocking' ? 'text-bad' : 'text-muted')}>{r.severity}</span>
              <span className="block text-muted">{r.because}</span>
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
