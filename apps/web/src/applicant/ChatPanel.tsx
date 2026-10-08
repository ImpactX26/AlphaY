import type { ChatMessageDTO } from '@educaro/shared';
import clsx from 'clsx';
import { Mic, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorText } from '../api/client';
import { useChat, useSendChat, useSendVoiceNote } from '../api/queries';
import { formatDuration, formatTime } from '../lib/format';
import { useAgentActivity } from '../realtime/agentStatus';
import { Button, IconButton } from '../ui/Button';
import { Avatar, Skeleton } from '../ui/misc';
import { Spinner } from '../ui/Spinner';
import { toast } from '../ui/Toast';
import { useRecorder } from './useRecorder';

const AUTHOR_LABEL: Record<ChatMessageDTO['author'], string> = { applicant: 'You', agent: 'Educaro agent', staff: 'Educaro staff', system: 'Educaro' };

function Bubble({ message }: { message: ChatMessageDTO }) {
  const mine = message.author === 'applicant';
  const system = message.author === 'system';
  return (
    <li className={clsx('flex gap-2.5', mine && 'flex-row-reverse')}>
      {!mine && !system ? <Avatar name={message.author === 'staff' ? 'Educaro Staff' : 'AI'} tone={message.author === 'staff' ? 'staff' : 'agent'} size={26} /> : null}
      <div className={clsx('min-w-0 max-w-[85%]', mine && 'text-right', system && 'mx-auto max-w-full text-center')}>
        <div
          className={clsx(
            'inline-block rounded-2xl px-3.5 py-2 text-left text-[14px] leading-relaxed',
            mine && 'rounded-br-md bg-ink text-bg',
            !mine && !system && 'rounded-bl-md border border-line bg-surface',
            system && 'border border-dashed border-line bg-surface-2/60 text-[13px] text-muted',
          )}
        >
          {message.channel === 'discord' && !system ? <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-outside">On Discord</span> : null}
          {message.channel === 'email' && !system ? <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-outside">By email</span> : null}
          <span className="whitespace-pre-wrap">{message.text}</span>
        </div>
        <p className="mt-0.5 px-1 text-[11.5px] text-muted">
          <span className="sr-only">{AUTHOR_LABEL[message.author]}, </span>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </li>
  );
}

export function ChatPanel({ applicantId, className, autoFocus }: { applicantId: string; className?: string; autoFocus?: boolean }) {
  const { data: messages, isLoading } = useChat(applicantId);
  const send = useSendChat(applicantId);
  const voice = useSendVoiceNote(applicantId);
  const activity = useAgentActivity(applicantId);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const recorder = useRecorder();

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages?.length, activity.status]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || send.isPending) return;
    setText('');
    send.mutate(value, { onError: (err) => toast(errorText(err), 'error') });
  };

  const stopAndSend = async () => {
    const result = await recorder.stop();
    if (!result) return;
    voice.mutate(
      { audio: result.blob, filename: `voice-note.${result.extension}` },
      { onError: (err) => toast(errorText(err), 'error') },
    );
  };

  return (
    <div className={clsx('flex min-h-0 flex-col', className)}>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="ml-auto h-10 w-3/5" />
            <Skeleton className="h-20 w-4/5" />
          </div>
        ) : (
          <ul className="space-y-3">
            {messages?.map((m) => <Bubble key={m.id} message={m} />)}
            {activity.status !== 'idle' ? (
              <li className="flex items-center gap-2.5" aria-live="polite">
                <Avatar name="AI" tone="agent" size={26} />
                <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2 text-[13px] text-muted">
                  <Spinner size={13} className="text-agent" />
                  {activity.detail ?? (activity.status === 'thinking' ? 'Thinking…' : 'Working…')}
                </span>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line bg-surface px-3 py-2.5">
        {recorder.state === 'recording' ? (
          <div className="flex flex-1 items-center gap-3 px-1">
            <span className="h-2.5 w-2.5 flex-none animate-pulse rounded-full bg-bad" aria-hidden />
            <span className="num text-[14px] font-semibold" aria-live="off">
              {formatDuration(recorder.seconds)}
            </span>
            <span className="text-[13px] text-muted">Recording a voice note</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={recorder.cancel}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={Square} onClick={stopAndSend}>
              Send
            </Button>
          </div>
        ) : (
          <>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message the agent</span>
              <textarea
                className="input max-h-32 min-h-10 py-2"
                rows={1}
                value={text}
                autoFocus={autoFocus}
                placeholder="Ask anything"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) submit(e);
                }}
              />
            </label>
            {recorder.supported && !text.trim() ? (
              <IconButton label="Record a voice note" icon={Mic} onClick={recorder.start} disabled={voice.isPending} />
            ) : null}
            <Button type="submit" variant="primary" icon={Send} loading={send.isPending || voice.isPending} disabled={!text.trim()} aria-label="Send message">
              <span className="sr-only sm:not-sr-only">Send</span>
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
