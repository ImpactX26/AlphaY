import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from '../config';

/**
 * The interviewer's voice, spoken properly.
 *
 * The browser's `speechSynthesis` is free and works offline, and it stays the fallback for exactly
 * that reason — the product has to run with no keys. But a mock interview is the one place where
 * the voice *is* the product: someone is practising being spoken to by a stranger, and a flat
 * robotic reading teaches them nothing about how that feels.
 *
 * Two things make this safe to ship:
 *
 * **The key never leaves the server.** The browser asks our own route for audio; it never sees the
 * ElevenLabs credential. A `<audio src>` pointing at ElevenLabs with a key in the query string is
 * the usual way this gets leaked.
 *
 * **Every clip is cached on disk by hash.** ElevenLabs bills per character and the free tier is
 * about 10k characters a month — roughly 125 interview questions. But the questions come from a
 * fixed bank of fifteen, so the second run of a session costs nothing and a rehearsed demo costs
 * nothing after the first pass. Without the cache, running the demo ten times would exhaust the
 * month's quota on the same fifteen sentences.
 */
@Injectable()
export class TtsService {
  private readonly log = new Logger('Tts');
  /** Clips live outside applicant storage: they are content, not somebody's documents. */
  private readonly dir = path.resolve(config.storageDir, 'tts');

  get enabled(): boolean {
    return Boolean(config.elevenLabsKey);
  }

  private keyFor(text: string): string {
    // The voice and the model are part of the identity: changing either must not serve the old
    // audio back from cache.
    return createHash('sha1').update(`${config.elevenLabsVoiceId}:${config.elevenLabsModel}:${text}`).digest('hex');
  }

  /**
   * MP3 bytes for one line, or null when there is no key, the text is empty, or the call fails.
   *
   * Null is a normal answer, not an error: the caller falls back to the browser voice, and the
   * question is on screen in every case. A voice that is down must never stop someone practising.
   */
  async speak(text: string): Promise<{ bytes: Buffer; cached: boolean } | null> {
    const line = (text ?? '').trim();
    if (!this.enabled || !line) return null;
    // A sentence, not an essay: this is called with interview questions, and an unbounded body
    // would be an unbounded bill.
    if (line.length > 600) return null;

    const file = path.join(this.dir, `${this.keyFor(line)}.mp3`);
    const hit = await fs.promises.readFile(file).catch(() => null);
    if (hit?.length) return { bytes: hit, cached: true };

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.elevenLabsVoiceId)}`, {
        method: 'POST',
        headers: { 'xi-api-key': config.elevenLabsKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: line,
          model_id: config.elevenLabsModel,
          // Stability up, style down: an interviewer should sound steady and the same every time,
          // not perform. The default settings are tuned for expressive narration.
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
        }),
        // A live call cannot wait: past this the browser voice is the better answer.
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        // 401 is a bad key, 429 is the quota — different problems, so print which.
        this.log.warn(`ElevenLabs ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
        return null;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length) return null;
      await fs.promises.mkdir(this.dir, { recursive: true });
      await fs.promises.writeFile(file, bytes);
      this.log.log(`spoke ${line.length} chars (${bytes.length} bytes), cached as ${path.basename(file)}`);
      return { bytes, cached: false };
    } catch (e: any) {
      this.log.warn(`ElevenLabs failed, falling back to the browser voice: ${e?.message ?? e}`);
      return null;
    }
  }
}
