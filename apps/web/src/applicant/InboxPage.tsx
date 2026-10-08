import type { EmailDTO } from '@educaro/shared';
import clsx from 'clsx';
import { CalendarPlus, Inbox, Mail, MailCheck, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, errorText, links } from '../api/client';
import { useApplicant, useApprovals, useCalendar, useEmails } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { formatDate, formatDateTime, formatTime, relativeTime } from '../lib/format';
import { approvalStatus } from '../lib/tags';
import { Button } from '../ui/Button';
import { EmptyState, PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

const REPLY_LABEL: Record<NonNullable<EmailDTO['classified']>['kind'], { label: string; cls: string }> = {
  interview: { label: 'Interview invite', cls: 't-ver' },
  missing_paper: { label: 'They need a paper', cls: 't-warn' },
  rejection: { label: 'Position filled', cls: 't-muted' },
  other: { label: 'Reply', cls: 't-muted' },
};

const EVENT_TONE = { deadline: 'border-bad', exam: 'border-agent', task: 'border-muted', event: 'border-applicant', interview: 'border-staff' } as const;

export default function InboxPage() {
  const applicantId = useApplicantId();
  const { data: emails, isLoading: emailsLoading } = useEmails(applicantId);
  const { data: calendar } = useCalendar(applicantId);
  const { data: approvals } = useApprovals(applicantId);
  const { data: applicant } = useApplicant(applicantId);

  const threads = new Map<string, EmailDTO[]>();
  for (const email of emails ?? []) {
    const list = threads.get(email.threadKey) ?? [];
    list.push(email);
    threads.set(email.threadKey, list);
  }
  const ordered = [...threads.values()].map((list) => [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  ordered.sort((a, b) => (b.at(-1)?.createdAt ?? '').localeCompare(a.at(-1)?.createdAt ?? ''));
  const pending = approvals?.filter((a) => a.status === 'pending' || a.status === 'approved') ?? [];
  const upcoming = calendar ?? [];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Inbox and calendar">Every mail sent for you and every reply, plus the dates the agent put in your calendar.</PageHeader>

      {pending.length ? (
        <section className="mb-8">
          <SectionTitle>Waiting for you</SectionTitle>
          <ul className="space-y-2">
            {pending.map((a) => {
              const status = approvalStatus(a.status);
              return (
                <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{a.title}</span>
                    <span className="block text-[12.5px] text-muted">Drafted {relativeTime(a.createdAt)}</span>
                  </span>
                  <Tag s={status} className="flex-none" />
                  <Link to={`/app/approvals/${a.id}`} className="btn btn-primary btn-sm flex-none no-underline">
                    {a.status === 'pending' ? 'Review and send' : 'Open'}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mb-8">
        <SectionTitle>Mail</SectionTitle>
        {emailsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : ordered.length ? (
          <ul className="space-y-4">
            {ordered.map((thread) => (
              <li key={thread[0].threadKey} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/40 px-4 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{thread[0].subject}</p>
                  <span className="flex-none text-[12px] text-muted">
                    {thread.length} {thread.length === 1 ? 'message' : 'messages'}
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {thread.map((email) => {
                    const incoming = email.direction === 'in';
                    return (
                      <li key={email.id} className={clsx('px-4 py-3', incoming && 'bg-[color-mix(in_srgb,var(--applicant)_4%,transparent)]')}>
                        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                          {incoming ? <MailCheck size={14} className="flex-none text-applicant" aria-hidden /> : <Mail size={14} className="flex-none" aria-hidden />}
                          <span className="font-mono">{incoming ? email.fromAddr : `→ ${email.toAddr}`}</span>
                          <span>·</span>
                          <span>{formatDateTime(email.createdAt)}</span>
                          {email.classified ? <Tag s={REPLY_LABEL[email.classified.kind]} className="ml-auto flex-none" /> : null}
                        </div>
                        {email.classified ? <p className="mt-1.5 text-[13.5px] font-semibold">{email.classified.summary}</p> : null}
                        <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{email.text}</p>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No mail yet" icon={Inbox}>
            When the agent sends an application for you, it appears here with every reply in the same thread.
          </EmptyState>
        )}
      </section>

      <section className="mb-8">
        <SectionTitle>Calendar</SectionTitle>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((event) => (
              <li key={event.id} className={clsx('card flex flex-wrap items-center gap-3 border-l-[3px] px-4 py-3', EVENT_TONE[event.kind])}>
                <span className="w-[86px] flex-none">
                  <span className="num block text-[14px] font-bold">{formatDate(event.startsAt)}</span>
                  <span className="num block text-[12.5px] text-muted">{formatTime(event.startsAt)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">{event.title}</span>
                  <span className="block text-[12.5px] text-muted">
                    {event.location ? `${event.location} · ` : ''}
                    {event.durationMin ? `${event.durationMin} min` : 'All day'}
                  </span>
                  {event.description ? <span className="mt-0.5 block text-[13px]">{event.description}</span> : null}
                </span>
                <a href={links.ics(event.id)} download={`${event.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`} className="btn btn-secondary btn-sm flex-none no-underline">
                  <CalendarPlus size={15} aria-hidden />
                  Add to calendar
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing in your calendar yet" icon={CalendarPlus}>
            The agent sends real invites, not reminders: exam dates, deadlines, interviews and consultant calls.
          </EmptyState>
        )}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <h2 className="display flex items-center gap-2 text-[15px] font-bold">
            <MessageCircle size={16} className="text-outside" aria-hidden />
            Your Discord
          </h2>
          <p className="mt-1 max-w-prose text-[13.5px] text-muted">
            {applicant?.cohortChannel ? (
              <>
                You are in <span className="font-mono font-semibold text-ink">{applicant.cohortChannel}</span> with others on the same route and city. The agent posts your deadlines
                there too.
              </>
            ) : (
              'Link Discord and the agent joins you to a cohort channel for your route and city, and pings your deadlines there.'
            )}
          </p>
        </div>
        <DiscordLinkButton applicantId={applicantId} />
      </section>
    </div>
  );
}

function DiscordLinkButton({ applicantId }: { applicantId: string }) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  if (code)
    return (
      <p className="flex-none text-[13.5px]">
        In Discord, type <span className="kbd">/link {code}</span>
      </p>
    );
  return (
    <Button
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await api.discordLink(applicantId);
          setCode(res.code);
        } catch (err) {
          toast(errorText(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      Get my link code
    </Button>
  );
}
