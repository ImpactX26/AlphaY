import type { CommunityPostDTO } from '@educaro/shared';
import clsx from 'clsx';
import { MessageCircle, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { errorText } from '../api/client';
import { useAnnouncements, useReplyInCommunity } from '../api/queries';
import { relativeTime, hostOf } from '../lib/format';
import { Button } from '../ui/Button';
import { EmptyState, ExternalLink } from '../ui/misc';
import { toast } from '../ui/Toast';

/**
 * What is new in Germany this week, where the cohort already is.
 *
 * It sits beside the thread rather than inside it because they are different things: a feed is
 * skimmed and a conversation is read, and the API posts them to different Discord channels for the
 * same reason. Each item is its own post, so it can be replied to — a wall of twenty links is read
 * by nobody, and the replies are where a cohort is actually useful.
 */

const KINDS = [
  { id: 'all', label: 'Everything' },
  { id: '💼', label: 'Jobs' },
  { id: '🎓', label: 'Programmes' },
  { id: '⏳', label: 'Deadlines' },
] as const;

/**
 * The API writes each item as `{icon} **{title}**\n{detail}\n{url}`. Parsing it back is better than
 * rendering the markdown raw: the icon becomes a filter and the link becomes a real one. Anything
 * that does not match this shape falls through and is shown as written, so a hand-written note from
 * staff still reads correctly.
 */
function parse(post: CommunityPostDTO) {
  const [first, ...rest] = post.text.split('\n');
  const m = /^(\S+)\s+\*\*(.+)\*\*$/.exec(first.trim());
  const url = rest.find((l) => /^https?:\/\//.test(l.trim()))?.trim() ?? null;
  const detail = rest.filter((l) => l.trim() && l.trim() !== url).join(' ');
  return m ? { icon: m[1], title: m[2], detail, url } : { icon: '📣', title: first, detail, url };
}

export function AnnouncementsPanel() {
  const { data: posts, isLoading } = useAnnouncements();
  const [kind, setKind] = useState<string>('all');

  const items = useMemo(() => (posts ?? []).map((p) => ({ post: p, ...parse(p) })), [posts]);
  // Only offer a filter that would actually return something.
  const available = KINDS.filter((k) => k.id === 'all' || items.some((i) => i.icon === k.id));
  const shown = kind === 'all' ? items : items.filter((i) => i.icon === kind);

  if (isLoading) return null;
  if (!items.length)
    return (
      <EmptyState title="Nothing new this week" icon={MessageCircle}>
        Every Monday the agent collects new German job openings, new programmes and any deadline closing soon, and posts them here.
      </EmptyState>
    );

  return (
    <div>
      {available.length > 2 ? (
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {available.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className={clsx('qr', kind === k.id && 'border-agent bg-[color-mix(in_srgb,var(--agent)_10%,transparent)] font-semibold text-agent')}
            >
              {k.label}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="space-y-2.5">
        {shown.map((item) => (
          <AnnouncementItem key={item.post.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function AnnouncementItem({ item }: { item: { post: CommunityPostDTO; icon: string; title: string; detail: string; url: string | null } }) {
  const { post, icon, title, detail, url } = item;
  const reply = useReplyInCommunity('announcements');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const send = () => {
    const value = text.trim();
    if (!value) return;
    reply.mutate(
      { postId: post.id, text: value },
      { onSuccess: () => setText(''), onError: (err) => toast(errorText(err), 'error') },
    );
  };

  return (
    <li className="rounded-[var(--r)] border border-line px-3.5 py-3">
      <div className="flex gap-2.5">
        <span aria-hidden className="mt-px flex-none text-[16px] leading-tight">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug">{title}</p>
          {detail ? <p className="mt-0.5 text-[13px] text-muted">{detail}</p> : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
            {url ? (
              <ExternalLink href={url}>{hostOf(url)}</ExternalLink>
            ) : null}
            <span>{relativeTime(post.createdAt)}</span>
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-ink" onClick={() => setOpen((v) => !v)}>
              <MessageCircle size={12} aria-hidden />
              {post.replies.length ? `${post.replies.length} ${post.replies.length === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </button>
          </p>
        </div>
      </div>

      {open ? (
        <div className="mt-2.5 border-t border-line pt-2.5">
          {post.replies.length ? (
            <ul className="mb-2.5 space-y-2">
              {post.replies.map((r) => (
                <li key={r.id} className="text-[13px]">
                  <span className="font-semibold">{r.author}</span>
                  {r.viaDiscord ? <span className="ml-1.5 text-[11.5px] text-muted">via Discord</span> : null}
                  <span className="ml-1.5 text-[11.5px] text-muted">{relativeTime(r.createdAt)}</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-muted">{r.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={`reply-${post.id}`}>
              Reply to {title}
            </label>
            <textarea
              id={`reply-${post.id}`}
              className="input min-h-[38px] flex-1 resize-y py-2"
              rows={1}
              value={text}
              placeholder="Ask about this one"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line — the same rule as every other composer.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button size="sm" icon={Send} onClick={send} loading={reply.isPending} disabled={!text.trim()}>
              Reply
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
