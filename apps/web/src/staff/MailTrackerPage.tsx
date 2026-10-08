import clsx from 'clsx';
import { ArrowUpRight, Mail, MailCheck, Paperclip, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePipeline, useMailDetail, useMailTracker, useSystemStatus } from '../api/queries';
import { formatBytes, formatDateTime } from '../lib/format';
import { Button } from '../ui/Button';
import { EmptyState, ExternalLink, PageHeader, Skeleton } from '../ui/misc';
import { Chip } from '../ui/Tag';

export default function MailTrackerPage() {
  const [params, setParams] = useSearchParams();
  const applicantId = params.get('applicantId') ?? '';
  const { data: mail, isLoading } = useMailTracker(applicantId || undefined);
  const { data: pipeline } = usePipeline();
  const { data: status } = useSystemStatus();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMailpit, setShowMailpit] = useState(false);
  const { data: detail } = useMailDetail(openId);
  const mailpitUrl = status?.mailpitUrl ?? 'http://localhost:8025';

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Mail tracker"
        actions={
          <>
            <Button onClick={() => setShowMailpit((s) => !s)}>{showMailpit ? 'Hide the inbox' : 'Show the inbox'}</Button>
            <a href={mailpitUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary no-underline">
              Open in a new tab
              <ArrowUpRight size={15} aria-hidden />
            </a>
          </>
        }
      >
        Every mail the agent sent or received, mirrored into the team inbox. Safe mode keeps the prototype from ever mailing a real university or employer.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px]">
          <span className="label">Applicant</span>
          <select
            className="input"
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
        <p className="text-[12.5px] text-muted">
          {mail?.length ?? 0} {mail?.length === 1 ? 'message' : 'messages'}
        </p>
      </div>

      {showMailpit ? (
        <div className="mb-6 overflow-hidden rounded-xl border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-3.5 py-2">
            <p className="text-[13px] font-semibold">Team inbox (Mailpit)</p>
            <p className="font-mono text-[12px] text-muted">{mailpitUrl}</p>
          </div>
          <iframe src={mailpitUrl} title="Team inbox (Mailpit)" className="h-[520px] w-full border-0 bg-surface" />
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : mail?.length ? (
        <ul className="space-y-2">
          {mail.map((m) => {
            const open = openId === m.mailpitId;
            return (
              <li key={m.mailpitId} className="card overflow-hidden">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : m.mailpitId)}
                >
                  {m.direction === 'in' ? (
                    <MailCheck size={16} className="mt-0.5 flex-none text-applicant" aria-hidden />
                  ) : (
                    <Mail size={16} className="mt-0.5 flex-none text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip tone={m.direction === 'in' ? 'applicant' : 'agent'}>{m.direction === 'in' ? 'In' : 'Out'}</Chip>
                      {m.kind ? <Chip>{m.kind}</Chip> : null}
                      {m.safeRedirected ? (
                        <Chip tone="warn">
                          <ShieldAlert size={12} aria-hidden />
                          Redirected by safe mode
                        </Chip>
                      ) : null}
                      {m.applicantName ? <span className="text-[12.5px] text-muted">{m.applicantName}</span> : null}
                      <span className="ml-auto flex-none text-[12px] text-muted">{formatDateTime(m.createdAt)}</span>
                    </span>
                    <span className="mt-1.5 block truncate text-[14.5px] font-semibold">{m.subject}</span>
                    <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">
                      {m.from} → {m.to.join(', ')}
                      {m.safeRedirected ? <span className="text-warn"> (really for {m.originalTo.join(', ')})</span> : null}
                    </span>
                    {!open ? <span className="mt-1 block truncate text-[13px] text-muted">{m.snippet}</span> : null}
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-line px-4 py-3">
                    {detail?.mailpitId === m.mailpitId ? (
                      <>
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{detail.text}</p>
                        {detail.attachments.length ? (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {detail.attachments.map((a) => (
                              <li key={a.name} className="chip font-mono !text-[11.5px]">
                                <Paperclip size={12} aria-hidden />
                                {a.name} · {formatBytes(a.size)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <Skeleton className="h-20 w-full" />
                    )}
                    <p className={clsx('mt-3 border-t border-line pt-2.5 text-[12.5px]')}>
                      <ExternalLink href={`${mailpitUrl}/view/${m.mailpitId.replace(/^mp-/, '')}`}>View in the inbox</ExternalLink>
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No mail yet" icon={Mail}>
          Every mail the agent sends lands in the team inbox, never in a real admissions office. Replies come back into the applicant’s thread.
        </EmptyState>
      )}
    </div>
  );
}
