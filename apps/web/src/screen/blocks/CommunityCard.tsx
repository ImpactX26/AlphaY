import type { CommunityBlock } from '@educaro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { api, errorText } from '../../api/client';
import { qk } from '../../api/queries';
import { relativeTime } from '../../lib/format';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { RoleLabel } from '../../ui/Tag';
import { useScreenActions } from '../context';
import { BlockFrame } from '../BlockFrame';

/**
 * The cohort thread, in the app. It is the same conversation that lives in Discord, so a post
 * written here is mirrored there and a post written there arrives here marked `viaDiscord`.
 */
export function CommunityCard({ block, bare }: { block: CommunityBlock; bare?: boolean }) {
  const { applicantId, readOnly } = useScreenActions();
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const send = useMutation({
    mutationFn: (value: string) => api.postToCommunity({ text: value, applicantId }),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: qk.community() });
      void qc.invalidateQueries({ queryKey: qk.screen(applicantId) });
    },
    onError: (err) => toast(errorText(err), 'error'),
  });

  const submit = () => {
    const value = text.trim();
    if (value) send.mutate(value);
  };

  return (
    <BlockFrame
      bare={bare}
      kicker={block.title ?? 'Your cohort'}
      body={block.body}
      headerExtra={block.channel ? <span className="flex-none font-mono text-[12.5px] text-muted">#{block.channel}</span> : undefined}
      footer={<span>The same thread runs in Discord. Anything you post here appears there too.</span>}
    >
      {block.posts.length ? (
        <ul className="space-y-3.5">
          {block.posts.map((p) => (
            <li key={p.id} className="flex gap-2.5">
              <span
                aria-hidden
                className={clsx(
                  'mt-0.5 grid size-7 flex-none place-items-center rounded-full text-[11px] font-bold',
                  p.authorKind === 'agent' && 'bg-[color-mix(in_srgb,var(--agent)_14%,transparent)] text-agent',
                  p.authorKind === 'staff' && 'bg-[color-mix(in_srgb,var(--staff)_14%,transparent)] text-staff',
                  p.authorKind === 'applicant' && 'bg-surface-2 text-muted',
                )}
              >
                {p.author.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[13.5px] font-semibold">{p.author}</span>
                  {p.authorKind !== 'applicant' ? <RoleLabel role={p.authorKind === 'agent' ? 'agent' : 'staff'}>{p.authorKind}</RoleLabel> : null}
                  {p.viaDiscord ? <span className="text-[11.5px] text-muted">via Discord</span> : null}
                  <span className="text-[11.5px] text-muted">{relativeTime(p.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed">{p.text}</p>
                {p.replies > 0 ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-muted">
                    <MessageCircle size={12} aria-hidden />
                    {p.replies} {p.replies === 1 ? 'reply' : 'replies'}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">Nothing posted yet. Ask the first question — someone on your route has had it too.</p>
      )}

      {!readOnly ? (
        <div className="mt-4 flex items-end gap-2 border-t border-line pt-3.5">
          <label className="sr-only" htmlFor="community-post">
            Write to your cohort
          </label>
          <textarea
            id="community-post"
            className="input min-h-[42px] flex-1 resize-y py-2.5"
            rows={1}
            value={text}
            placeholder="Ask your cohort something"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a new line — the same rule as the agent chat.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button icon={Send} onClick={submit} loading={send.isPending} disabled={!text.trim()}>
            Post
          </Button>
        </div>
      ) : null}
    </BlockFrame>
  );
}
