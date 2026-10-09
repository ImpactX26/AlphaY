import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecorderResult {
  blob: Blob;
  extension: string;
  seconds: number;
}

export type RecorderState = 'idle' | 'starting' | 'recording' | 'error';

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

function pickType(kind: 'audio' | 'video'): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return (kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES).find((t) => MediaRecorder.isTypeSupported(t));
}

const extensionFor = (mime: string): string => (mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm');

/**
 * MediaRecorder wrapper for voice notes ('audio') and the intro video ('video').
 * `stream` is exposed so a <video> element can show a live preview.
 */
export function useRecorder(kind: 'audio' | 'video' = 'audio', maxSeconds?: number) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  /**
   * Why not, in words the person can act on.
   *
   * getUserMedia only exists in a secure context, so opening the app on a phone over the laptop's
   * IP — exactly what anyone does when they want to record with a real camera — makes
   * navigator.mediaDevices undefined and the record button vanish with no explanation. "It is not
   * working" is the only possible conclusion, and it is the wrong one.
   */
  const unsupportedReason =
    supported || typeof window === 'undefined'
      ? null
      : !window.isSecureContext
        ? `Your browser only allows the ${kind === 'video' ? 'camera' : 'microphone'} on a secure page. Open this on http://localhost:5173 or over https, or upload a file instead.`
        : `This browser cannot record ${kind === 'video' ? 'video' : 'audio'}. Upload a file instead.`;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
    setStream(null);
    setSeconds(0);
    setState('idle');
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!supported) {
      setError('This browser cannot record. Upload a file instead.');
      setState('error');
      return;
    }
    setError(null);
    setState('starting');
    try {
      /**
       * Ask the browser for a clean voice, not for "audio".
       *
       * `audio: true` takes the default device with every processor off, so the microphone records
       * the room, the laptop fan and — worst — whatever the speakers are playing. The interview
       * coach reads its question aloud while the mic is open, so without echo cancellation the next
       * thing transcribed is the agent's own question coming back through the speakers, which is
       * exactly what made voice input return nonsense.
       *
       * Mono at 16 kHz is also what Whisper wants: it downsamples to that anyway, and sending
       * stereo at 48 kHz is three times the upload for no extra accuracy.
       */
      const voice: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16_000,
      };
      const media = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: voice } : { audio: voice },
      );
      const mimeType = pickType(kind);
      const rec = new MediaRecorder(media, {
        ...(mimeType ? { mimeType } : {}),
        // Speech needs far less than the default; this keeps a two-minute note small enough to
        // upload on a phone connection.
        ...(kind === 'audio' ? { audioBitsPerSecond: 32_000 } : {}),
      });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.start(1000);
      recorder.current = rec;
      setStream(media);
      startedAt.current = Date.now();
      setState('recording');
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(elapsed);
        if (maxSeconds && elapsed >= maxSeconds && recorder.current?.state === 'recording') recorder.current.stop();
      }, 250);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError'
          ? `Your browser blocked the ${kind === 'video' ? 'camera' : 'microphone'}. Allow it in the address bar, or upload a file instead.`
          : name === 'NotFoundError'
            ? `No ${kind === 'video' ? 'camera' : 'microphone'} found. Upload a file instead.`
            : 'Recording could not start. Upload a file instead.',
      );
      setState('error');
    }
  }, [kind, maxSeconds, supported]);

  const stop = useCallback(async (): Promise<RecorderResult | null> => {
    const rec = recorder.current;
    if (!rec) return null;
    const elapsed = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const blob = await new Promise<Blob>((resolve) => {
      const finish = () => resolve(new Blob(chunks.current, { type: rec.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm') }));
      if (rec.state === 'inactive') finish();
      else {
        rec.onstop = finish;
        rec.stop();
      }
    });
    cleanup();
    return blob.size ? { blob, extension: extensionFor(blob.type), seconds: elapsed } : null;
  }, [cleanup, kind]);

  return { state, seconds, error, stream, supported, unsupportedReason, start, stop, cancel: cleanup };
}
