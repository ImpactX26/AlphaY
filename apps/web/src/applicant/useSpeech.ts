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

  /** Says it, and resolves when it has finished — so the recorder can start on the last word. */
  const say = useCallback(
    (text: string): Promise<void> => {
      if (!supported || mutedRef.current || !text.trim()) return Promise.resolve();
      return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice.current) u.voice = voice.current;
        u.lang = voice.current?.lang ?? 'en-GB';
        // Slightly under default: an interview question read at full speed is hard to follow in a
        // second language, which is the opposite of what this is for.
        u.rate = 0.95;
        u.pitch = 1;
        const done = () => {
          setSpeaking(false);
          resolve();
        };
        u.onend = done;
        // A failed utterance must not hang the turn — the question is on screen either way.
        u.onerror = done;
        setSpeaking(true);
        window.speechSynthesis.speak(u);
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
