import type { ChatMessageDTO } from '@educaro/shared';
import clsx from 'clsx';
import { CircleAlert, Mic, MicOff, Send, Square } from 'lucide-react';
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

/** Two minutes is a long question. The recorder stops itself there and the note is still sent. */
const VOICE_MAX_SECONDS = 120;

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
  // A question is not a monologue, and the server caps the upload at 30 MB — better to stop at two
  // minutes than to let someone talk past the limit and lose the whole recording on upload.
  const recorder = useRecorder('audio', VOICE_MAX_SECONDS);

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

  // `recorder` and `voice` are fresh objects every render, so the latest closure goes in a ref and
  // the effect below depends only on primitives.
  const sendRef = useRef<() => Promise<void>>(async () => {});
  // Latched, not a concurrency guard: `stop()` resolves before React re-renders with the new
  // state, so a flag that cleared on completion let every extra render at the cap send again.
  // It stays set until the next recording starts.
  const sent = useRef(false);
  sendRef.current = async () => {
    if (sent.current) return;
    sent.current = true;
    const result = await recorder.stop();
    if (!result) return;
    voice.mutate(
      { audio: result.blob, filename: `voice-note.${result.extension}` },
      { onError: (err) => toast(errorText(err), 'error') },
    );
  };
  const stopAndSend = () => void sendRef.current();

  const startRecording = () => {
    sent.current = false;
    recorder.start();
  };

  // The recorder stops itself at the cap but cannot know what to do with the result, so the timer
  // would keep climbing over a recording that already ended and the note would never be sent.
  useEffect(() => {
    if (recorder.state === 'recording' && recorder.seconds >= VOICE_MAX_SECONDS) void sendRef.current();
  }, [recorder.state, recorder.seconds]);

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

      {/* A blocked or missing microphone is the common case on a borrowed laptop. Without this the
          mic button does nothing at all when tapped, which reads as a broken feature. */}
      {recorder.error ? (
        <p role="status" className="flex items-start gap-2 border-t border-line bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[13px]">
          <CircleAlert size={15} className="mt-0.5 flex-none text-warn" aria-hidden />
          {recorder.error}
        </p>
      ) : null}

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line bg-surface px-3 py-2.5">
        {recorder.state === 'recording' ? (
          <div className="flex flex-1 items-center gap-3 px-1">
            <span className="h-2.5 w-2.5 flex-none animate-pulse rounded-full bg-bad" aria-hidden />
            <span className="num text-[14px] font-semibold" aria-live="off">
              {formatDuration(recorder.seconds)} / {formatDuration(VOICE_MAX_SECONDS)}
            </span>
            <span className="text-[13px] text-muted">Recording a voice note</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                // Latch it closed: a cancelled note must not be sent by a render that still
                // sees `recording` at the cap.
                sent.current = true;
                recorder.cancel();
              }}
            >
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
            {/* A browser that cannot record still shows the button, disabled, with the reason on
                hover: silently hiding it makes the feature look unbuilt rather than unavailable. */}
            {text.trim() ? null : recorder.supported ? (
              <IconButton label="Record a voice note" icon={Mic} onClick={startRecording} disabled={voice.isPending} />
            ) : (
              <IconButton label={recorder.unsupportedReason ?? 'This browser cannot record audio'} icon={MicOff} disabled />
            )}
            <Button type="submit" variant="primary" icon={Send} loading={send.isPending || voice.isPending} disabled={!text.trim()} aria-label="Send message">
              <span className="sr-only sm:not-sr-only">Send</span>
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
