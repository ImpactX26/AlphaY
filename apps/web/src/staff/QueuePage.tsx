import type { StaffQueueItemDTO } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCheck, CircleHelp, FileWarning, Inbox, ScanEye, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, errorText } from '../api/client';
import { qk, useQueue } from '../api/queries';
import { relativeTime } from '../lib/format';
import { Button } from '../ui/Button';
import { EmptyState, PageHeader, Skeleton } from '../ui/misc';
import { Chip } from '../ui/Tag';
import { toast } from '../ui/Toast';

const KIND: Record<StaffQueueItemDTO['kind'], { label: string; icon: typeof Send; tone: 'staff' | 'warn' | 'bad' | 'agent' }> = {
  approval: { label: 'Outgoing application', icon: Send, tone: 'staff' },
  submission: { label: 'Submit to Educaro', icon: CheckCheck, tone: 'agent' },
  low_confidence_read: { label: 'Low-confidence read', icon: ScanEye, tone: 'warn' },
  unproved_conflict: { label: 'Conflict explained, not proved', icon: FileWarning, tone: 'warn' },
  escalation: { label: 'The agent must not answer alone', icon: TriangleAlert, tone: 'bad' },
};

export default function QueuePage() {
  const { data: queue, isLoading } = useQueue();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, call: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await call();
      void qc.invalidateQueries({ queryKey: qk.queue });
      void qc.invalidateQueries({ queryKey: qk.pipeline });
      toast(done);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Approval queue">
        Everything that needs a human: outgoing applications, documents the agent could not read with confidence, conflicts it could not prove, and questions it must not answer alone.
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : queue?.length ? (
        <ul className="space-y-2.5">
          {queue.map((item) => {
            const k = KIND[item.kind];
            return (
              <li key={item.id} className="card px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Chip tone={k.tone}>
                    <k.icon size={13} aria-hidden />
                    {k.label}
                  </Chip>
                  <span className="flex-none text-[12px] text-muted">{relativeTime(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-[15px] font-semibold leading-snug">{item.title}</p>
                <p className="mt-1 text-[13.5px] text-muted">{item.detail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link to={`/staff/applicants/${item.applicantId}`} className="btn btn-secondary btn-sm no-underline">
                    Open {item.applicantName}
                  </Link>
                  {item.kind === 'submission' ? (
                    <Button
                      size="sm"
                      variant="approve"
                      icon={CheckCheck}
                      loading={busy === item.id}
                      onClick={() => act(item.id, () => api.approveSubmission(item.applicantId), `Approved ${item.applicantName}’s submission`)}
                    >
                      Approve the submission
                    </Button>
                  ) : null}
                  {item.kind === 'approval' && item.refId ? (
                    <Button
                      size="sm"
                      variant="approve"
                      icon={Send}
                      loading={busy === item.id}
                      onClick={() => act(item.id, () => api.approve(item.refId as string), 'Approved and sent')}
                    >
                      Give the second key
                    </Button>
                  ) : null}
                  {item.kind === 'escalation' ? (
                    <Button
                      size="sm"
                      icon={CircleHelp}
                      loading={busy === item.id}
                      onClick={() => act(item.id, () => api.bookConsultant(item.applicantId), 'Consultant call booked. They have been told.')}
                    >
                      Book a consultant call
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="The queue is empty" icon={Inbox}>
          Nothing needs a human right now. New items land here the moment the agent raises them.
        </EmptyState>
      )}
    </div>
  );
}
