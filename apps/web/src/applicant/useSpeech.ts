import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The interviewer's voice, from the browser itself.
 *
 * `speechSynthesis` ships in every current browser, costs nothing, needs no key and works with no
 * network — which matters here, because the demo has to run on a conference wifi and the whole
 * product is built to survive with zero keys. A hosted TTS would sound better and would be the one
 * thing on stage that fails when the network does.
 *
 * It is deliberately not required: `supported` is false on a browser without it, and the caller
 * shows the question as text instead. Nobody is blocked from practising because their browser
 * cannot talk.
 */

/** Prefer a real human-sounding English voice, and never read German place names in a German accent. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  // Named voices are the better engines on every platform that has both; `localService` ones do
  // not need the network, which is the point of using this at all.
  const preferred = ['Google UK English Female', 'Microsoft Libby', 'Microsoft Sonia', 'Samantha', 'Google US English'];
  for (const name of preferred) {
    const hit = pool.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  return pool.find((v) => v.localService) ?? pool[0];
}

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (!supported) return;
    // Voices load asynchronously in Chrome: the first call returns [] and `voiceschanged` fires
    // later. Reading once at mount would silently leave the default robotic voice forever.
    const load = () => {
      voice.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /**
   * Says it, and resolves `true` once it has finished — so the caller can start the recorder on
   * the last word, and can tell the difference between "said it" and "was not allowed to".
   *
   * Resolves `false` when nothing was spoken. The case that matters is Chrome's autoplay policy:
   * `speak()` before the page has been interacted with is dropped with no error and no event, so
   * the first question of a session is silent and the only way to know is that `onstart` never
   * fired. The caller offers a tap-to-hear button instead of leaving the person to wonder whether
   * their sound is broken.
   */
  const say = useCallback(
    (text: string): Promise<boolean> => {
      if (!supported || mutedRef.current || !text.trim()) return Promise.resolve(false);
      return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice.current) u.voice = voice.current;
        u.lang = voice.current?.lang ?? 'en-GB';
        // Slightly under default: an interview question read at full speed is hard to follow in a
        // second language, which is the opposite of what this is for.
        u.rate = 0.95;
        u.pitch = 1;

        let started = false;
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          setSpeaking(false);
          resolve(ok);
        };
        u.onstart = () => {
          started = true;
          setSpeaking(true);
        };
        u.onend = () => finish(true);
        // A failed utterance must not hang the turn — the question is on screen either way.
        u.onerror = () => finish(false);

        window.speechSynthesis.speak(u);

        // Blocked speech fires no event at all, so a short watchdog is the only way to notice.
        // Long enough that a slow voice engine is not mistaken for a block.
        window.setTimeout(() => {
          if (!started) finish(false);
        }, 1200);
      });
    },
    [supported],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) window.speechSynthesis?.cancel();
      return !m;
    });
  }, []);

  return { supported, speaking, muted, say, stop, toggleMute };
}
