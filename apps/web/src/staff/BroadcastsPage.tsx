import { useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Megaphone, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, errorText } from '../api/client';
import { qk, useBroadcasts } from '../api/queries';
import { relativeTime } from '../lib/format';
import { Button } from '../ui/Button';
import { EmptyState, PageHeader, Skeleton } from '../ui/misc';
import { Avatar } from '../ui/misc';
import { RoleLabel, Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

const STATUS = {
  draft: { label: 'Draft, waiting for you', cls: 't-warn' },
  approved: { label: 'Approved', cls: 't-web' },
  sent: { label: 'Sent', cls: 't-ver' },
} as const;

const EXAMPLES = ['ÖSD exam dates for spring 2027 are published', 'APS fees change from 1 January', 'Three new nursing openings in Cologne'];

export default function BroadcastsPage() {
  const qc = useQueryClient();
  const { data: broadcasts, isLoading } = useBroadcasts();
  const [topic, setTopic] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const draft = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setDrafting(true);
    try {
      await api.createBroadcast(value);
      void qc.invalidateQueries({ queryKey: qk.broadcasts });
      setTopic('');
      toast('Drafted, one message per person. Read them, then approve.');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setDrafting(false);
    }
  };

  const approve = async (id: string) => {
    setApproving(id);
    try {
      await api.approveBroadcast(id);
      void qc.invalidateQueries({ queryKey: qk.broadcasts });
      toast('Approved and sent. Each person got their own message.');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Broadcasts">
        Give the agent a topic. It picks who it affects and writes each person their own note, in their own situation. You read them and approve the batch.
      </PageHeader>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void draft(topic);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Topic</span>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What changed?" aria-label="Broadcast topic" />
        </label>
        <Button type="submit" variant="primary" icon={Sparkles} loading={drafting} disabled={!topic.trim()}>
          Draft the messages
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="chip" disabled={drafting} onClick={() => void draft(example)}>
            {example}
          </button>
        ))}
      </div>

      <div className="mt-7 space-y-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : broadcasts?.length ? (
          broadcasts.map((b) => (
            <section key={b.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <RoleLabel role="agent">Topic</RoleLabel>
                  <h2 className="display mt-1 text-[16px] font-bold leading-snug">{b.topic}</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {b.messages.length} {b.messages.length === 1 ? 'person' : 'people'} · {relativeTime(b.createdAt)}
                  </p>
                </div>
                <Tag s={STATUS[b.status]} className="flex-none" />
              </div>
              <ul className="divide-y divide-line">
                {b.messages.map((m) => (
                  <li key={m.applicantId} className="flex gap-3 px-4 py-3">
                    <Avatar name={m.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/staff/applicants/${m.applicantId}`} className="text-[13.5px] font-semibold text-ink no-underline hover:underline">
                        {m.name}
                      </Link>
                      <p className="mt-0.5 text-[14px] leading-relaxed">{m.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {b.status === 'draft' ? (
                <div className="border-t border-line bg-surface-2/40 px-4 py-3">
                  <Button variant="approve" icon={CheckCheck} loading={approving === b.id} onClick={() => void approve(b.id)}>
                    Approve all {b.messages.length} and send
                  </Button>
                </div>
              ) : null}
            </section>
          ))
        ) : (
          <EmptyState title="No broadcasts yet" icon={Megaphone}>
            A changed rule or a new opening: the agent works out who it affects and writes to each of them.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
