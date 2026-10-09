import type { InterviewDTO } from '@educaro/shared';
import clsx from 'clsx';
import { CircleAlert, Keyboard, Mic, Play, Repeat, Square, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from '../api/client';
import { formatDuration } from '../lib/format';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { toast } from '../ui/Toast';
import { useRecorder } from './useRecorder';
import { useSpeech } from './useSpeech';

/** Long enough for a real answer, short enough that nobody rambles into the upload cap. */
const MAX_SECONDS = 120;

/**
 * The mock interview as a call: they hear the question and answer out loud.
 *
 * Typing an answer tests whether you can write one. The thing people actually fail is saying it —
 * in a second language, to a stranger, with no time to edit. So the question is spoken, the camera
 * is on, and the clock runs while they talk. Nothing here is a simulation of a face: the
 * interviewer is a speaking indicator, because a fake human likeness would be a lie told to
 * someone already anxious about being judged.
 *
 * Everything degrades rather than blocks. No speech synthesis and the question is read on screen;
 * no camera and it is a voice call; no microphone, or a transcript that comes back empty, and the
 * typed box is still there. The person must never be stuck because of their hardware.
 */
export function InterviewCall({
  session,
  busy,
  onSession,
  onBusy,
  onTypeInstead,
}: {
  session: InterviewDTO;
  busy: boolean;
  onSession: (s: InterviewDTO) => void;
  onBusy: (b: boolean) => void;
  onTypeInstead: () => void;
}) {
  const speech = useSpeech();
  const recorder = useRecorder('video', MAX_SECONDS);
  const selfRef = useRef<HTMLVideoElement>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // The browser refused to speak until the page is interacted with: show a way to ask for it.
  const [needsTap, setNeedsTap] = useState(false);
  // A real voice is playing, versus the browser's own. Tracked separately because the <audio>
  // element has no equivalent of speechSynthesis's `speaking` flag.
  const [speakingReal, setSpeakingReal] = useState(false);
  const [realVoice, setRealVoice] = useState(false);

  const question = [...session.turns].reverse().find((t) => t.role === 'coach')?.text ?? '';
  const talking = speech.speaking || speakingReal;
  const asked = session.turns.filter((t) => t.role === 'coach').length;
  const live = recorder.state === 'recording';

  useEffect(() => {
    if (selfRef.current && recorder.stream) selfRef.current.srcObject = recorder.stream;
  }, [recorder.stream]);

  // Ask the question aloud whenever a new one arrives. Keyed on the question itself rather than a
  // turn count, so a re-render cannot make the interviewer repeat itself mid-sentence.
  //
  // Depends on `say`, which is a stable useCallback — not on the whole `speech` object, which is a
  // fresh literal every render and so re-ran this effect continuously (including while it was
  // speaking, since `speaking` is part of it).
  const { say, stop: stopSpeaking } = speech;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Ask the question aloud: the real voice if the server has one, the browser's otherwise.
   *
   * Both paths can be refused by the same autoplay policy — an `<audio>` element started before
   * the page has been interacted with rejects its `play()` promise, exactly as `speechSynthesis`
   * silently drops an utterance. Either way the answer is the same: offer a Play button.
   */
  const ask = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text || speech.muted) return false;
      audioRef.current?.pause();
      audioRef.current = null;

      const clip = await api.interviewSay(session.id, text).catch(() => null);
      if (clip) {
        const url = URL.createObjectURL(clip);
        const el = new Audio(url);
        audioRef.current = el;
        setRealVoice(true);
        try {
          setSpeakingReal(true);
          // Resolves when playback actually begins; rejects when the browser blocks it.
          await el.play();
          await new Promise<void>((resolve) => {
            el.onended = () => resolve();
            el.onerror = () => resolve();
          });
          return true;
        } catch {
          return false;
        } finally {
          setSpeakingReal(false);
          URL.revokeObjectURL(url);
        }
      }

      // No key, no quota, or the call failed: the browser reads it. Nothing is lost — the
      // question is on screen either way.
      setRealVoice(false);
      return say(text);
    },
    [session.id, say, speech.muted],
  );

  const spoken = useRef<string>('');
  useEffect(() => {
    if (!question || spoken.current === question) return;
    spoken.current = question;
    setHeard(null);
    void ask(question).then((ok) => {
      // Chrome refuses audio until the page has been interacted with, so the very first question —
      // which arrives on mount, before any click — is silently swallowed. There is no error and no
      // event from speechSynthesis; an <audio> element rejects instead. Offer the button rather
      // than leave them wondering whether the sound is broken.
      if (!ok) setNeedsTap(true);
    });
  }, [question, ask]);

  // Stop talking the moment this unmounts, or a voice keeps going over the next screen. The
  // cleanup has braces so it returns nothing: React only accepts `undefined` or a function back
  // from an effect, and a concise body hands it whatever the call returned.
  /**
   * Silence both playback paths.
   *
   * There are two: `speechSynthesis` and an `<audio>` element for the real voice, and only
   * stopping one leaves the other talking into the microphone.
   */
  const hush = useCallback(() => {
    stopSpeaking();
    audioRef.current?.pause();
    audioRef.current = null;
  }, [stopSpeaking]);

  // Stop talking the moment this unmounts, or a voice keeps going over the next screen.
  useEffect(() => () => hush(), [hush]);

  const send = useCallback(async () => {
    const result = await recorder.stop();
    if (!result) return;
    setSending(true);
    onBusy(true);
    try {
      const res = await api.answerInterviewByVoice(session.id, result.blob, `interview-answer.${result.extension}`);
      if (!res.transcribed) {
        // Scoring silence as a weak answer would be the coach marking them down for a microphone
        // problem, so the API returns the session untouched and they simply go again.
        setHeard('');
        toast('I could not make that out. Try again, or type it instead.', 'error');
        return;
      }
      setHeard(res.heard);
      onSession(res);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSending(false);
      onBusy(false);
    }
  }, [recorder, session.id, onSession, onBusy]);

  // The recorder stops itself at the cap; send what it captured rather than dropping it.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (recorder.state === 'recording' && recorder.seconds >= MAX_SECONDS) void sendRef.current();
  }, [recorder.state, recorder.seconds]);

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-px bg-line sm:grid-cols-2">
        {/* The interviewer. A speaking indicator, not a face. */}
        <div className="relative grid aspect-video place-items-center bg-ink">
          <div className="flex flex-col items-center gap-3">
            <span
              aria-hidden
              className={clsx(
                'grid size-16 place-items-center rounded-full bg-agent/20 text-[20px] font-bold text-agent transition-transform',
                talking && 'animate-pulse scale-110',
              )}
            >
              AI
            </span>
            <span className="text-[12.5px] text-bg/70">{talking ? 'Speaking…' : sending ? 'Listening to your answer' : live ? 'Listening' : 'Ready'}</span>
          </div>
          <span className="absolute left-2.5 top-2.5 rounded bg-black/40 px-2 py-0.5 text-[11.5px] font-medium text-white">Interviewer</span>
          {speech.supported ? (
            <button
              type="button"
              onClick={() => {
                audioRef.current?.pause();
                speech.toggleMute();
              }}
              aria-label={speech.muted ? 'Unmute the interviewer' : 'Mute the interviewer'}
              className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded bg-black/40 text-white hover:bg-black/60"
            >
              {speech.muted ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
            </button>
          ) : null}
        </div>

        {/* Them. Mirrored, like every video call they have used. */}
        <div className="relative grid aspect-video place-items-center bg-ink">
          <video ref={selfRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label="Your camera" />
          {!recorder.stream ? <span className="absolute text-[12.5px] text-bg/60">Your camera turns on when you answer</span> : null}
          <span className="absolute left-2.5 top-2.5 rounded bg-black/40 px-2 py-0.5 text-[11.5px] font-medium text-white">You</span>
          {live ? (
            <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded bg-black/50 px-2 py-0.5 text-[11.5px] font-medium text-white">
              <span className="size-2 animate-pulse rounded-full bg-bad" aria-hidden />
              <span className="num">{formatDuration(recorder.seconds)}</span> / {formatDuration(MAX_SECONDS)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-3.5 sm:px-5">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted">Question {asked}</p>
        {/* Always on screen, never only in audio: a question you half-heard is unanswerable, and
            this has to work with the sound off. */}
        <div className="mt-1 flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{question}</p>
          {(speech.supported || realVoice) && !speech.muted ? (
            // Hearing it again is a normal thing to want in a second language, and it is the same
            // button that unblocks the first question — a tap is exactly what the browser wants.
            <button
              type="button"
              onClick={() => {
                setNeedsTap(false);
                void ask(question);
              }}
              disabled={talking}
              aria-label={needsTap ? 'Play the question' : 'Hear the question again'}
              className="mt-0.5 inline-flex flex-none items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
            >
              {needsTap ? <Play size={13} aria-hidden /> : <Repeat size={13} aria-hidden />}
              {needsTap ? 'Play' : 'Again'}
            </button>
          ) : null}
        </div>

        {needsTap ? (
          <p className="mt-2 text-[12.5px] text-muted">Your browser will not play audio until you tap something on the page. Tap Play to hear the question.</p>
        ) : null}

        {heard ? (
          <p className="mt-2.5 rounded-md border border-line bg-surface-2/50 px-3 py-2 text-[13px]">
            <span className="font-semibold">I heard:</span> {heard}
          </p>
        ) : null}

        {recorder.error ? (
          <p className="mt-2.5 flex items-start gap-2 rounded-md border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[13px]">
            <CircleAlert size={15} className="mt-0.5 flex-none text-warn" aria-hidden />
            {recorder.error}
          </p>
        ) : null}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {recorder.supported ? (
            live ? (
              <Button variant="primary" icon={Square} onClick={send} loading={sending} disabled={recorder.seconds < 2}>
                Stop and send
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={Mic}
                loading={recorder.state === 'starting' || busy}
                disabled={session.status !== 'active'}
                onClick={() => {
                  // Cut the question short if they are ready before it finishes.
                  stopSpeaking();
                  audioRef.current?.pause();
                  // This tap also satisfies the browser's "user has interacted" rule, so the next
                  // question will be allowed to speak even if the first one was blocked.
                  setNeedsTap(false);
                  // Stop the interviewer before opening the microphone. Echo cancellation handles
                  // most of it, but the surest way not to transcribe our own question back is not
                  // to be playing it: the model otherwise hears the question as the answer.
                  hush();
                  void recorder.start();
                }}
              >
                {heard === '' ? 'Try that again' : 'Answer out loud'}
              </Button>
            )
          ) : (
            <p className="flex items-start gap-2 text-[13px] text-muted">
              <CircleAlert size={15} className="mt-0.5 flex-none text-warn" aria-hidden />
              {recorder.unsupportedReason ?? 'This browser cannot record.'}
            </p>
          )}

          {live ? (
            <Button variant="ghost" onClick={recorder.cancel}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" icon={Keyboard} onClick={onTypeInstead}>
              Type instead
            </Button>
          )}

          {sending ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
              <Spinner size={13} className="text-agent" /> Transcribing and scoring
            </span>
          ) : null}
        </div>

        {!speech.supported && !realVoice ? <p className="mt-2 text-[12px] text-muted">This browser cannot read the question aloud, so it is written above.</p> : null}
      </div>
    </div>
  );
}
