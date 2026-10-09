import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { config } from '../config';

const run = promisify(execFile);
/**
 * ffmpeg, from whichever of three places actually has a working binary.
 *
 * `ffmpeg-static` resolves a binary per platform and npm got it wrong on this machine -- the
 * package installed with no executable in it at all. That is silent until someone records a long
 * video: a 140 MB phone clip is over Whisper's 25 MB limit, so it has to be stripped to audio
 * first, and with no ffmpeg the original went to the API and was refused. Check the file is there
 * rather than trusting the resolver, and let FFMPEG_PATH override when a real one is installed.
 */
function resolveFfmpeg(): string {
  const candidates: (string | undefined)[] = [process.env.FFMPEG_PATH];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    candidates.push(require('ffmpeg-static'));
  } catch {
    /* not installed at all */
  }
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return 'ffmpeg'; // on PATH, or the spawn fails and we fall back to the original file
}
const ffmpegPath: string = resolveFfmpeg();

export interface Transcript {
  text: string;
  segments: { start: number; end: number; text: string }[];
  provider: 'groq' | 'local';
}

/**
 * The words this cohort says that a general model has never heard.
 *
 * Whisper conditions on this text as if it were the transcript so far, so it biases the decoder's
 * vocabulary rather than instructing it. Without it the German process nouns come back as English
 * near-homophones — "Anerkennung" as "an according", "Chancenkarte" as "chancing cart", "ÖSD" as
 * "o s d" — and the agent then reasons over a word that was never said. Kept to names and terms
 * only: a prompt containing sentences makes the model continue them when the audio is quiet.
 */
const TRANSCRIBE_PROMPT =
  'Educaro, Germany, Anerkennung, Chancenkarte, Ausbildung, Bewerbung, Aufenthaltstitel, Anmeldung, Bürgeramt, Blocked account, Sperrkonto, APS, uni-assist, Studienkolleg, ' +
  'Goethe, telc, ÖSD, TestDaF, IELTS, CEFR, A1, A2, B1, B2, C1, Pflegefachkraft, Krankenpflege, GNM, B.Tech, CGPA, RWTH Aachen, TUM, TU Darmstadt, Kochi, Pune, Kerala, visa.';

/**
 * Whisper's stock phrases on silence, and a segment that repeats itself to death.
 *
 * On near-silent or unintelligible audio the model falls back on what it saw most in training:
 * sign-offs from captioned video. "Thank you for watching" at the end of a voice note is not
 * something the person said, and the agent must not treat it as a fact about them. The repeat
 * check catches the other failure, where a decoder that has lost the timeline emits the same
 * sentence until the audio runs out.
 */
const STOCK = [
  /^thank(s| you)( very much)?( for watching)?[.!]?$/i,
  /^thanks for watching[.!]?$/i,
  /^please subscribe[.!]?$/i,
  /^subtitles? by .*$/i,
  /^amara\.org.*$/i,
  /^\[?\s*(music|applause|silence|blank_audio|inaudible)\s*\]?[.!]?$/i,
  /^you[.!]?$/i,
  /^bye[.!]?$/i,
];

function dropHallucinations(t: { text: string; segments: { start: number; end: number; text: string }[] }): {
  text: string;
  segments: { start: number; end: number; text: string }[];
} {
  const segments = (t.segments ?? []).filter((s) => s.text && !STOCK.some((re) => re.test(s.text.trim())));

  // The same sentence four times running is a decoder stuck in a loop, not a person repeating
  // themselves. Collapse it to one rather than dropping it: they may well have said it once.
  const deduped: typeof segments = [];
  for (const s of segments) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.text.trim().toLowerCase() === s.text.trim().toLowerCase()) continue;
    deduped.push(s);
  }

  // With segments we can rebuild the text from what survived. Without them (some responses carry
  // none) fall back to filtering the whole string as one line.
  if (deduped.length) return { text: deduped.map((s) => s.text).join(' ').trim(), segments: deduped };
  const whole = (t.text ?? '').trim();
  return { text: STOCK.some((re) => re.test(whole)) ? '' : whole, segments: [] };
}

/** Turns files into text. No paid model is involved: PDFs by text layer, images by local OCR, audio by Groq or local Whisper. */
@Injectable()
export class MediaService implements OnModuleDestroy {
  private readonly log = new Logger('Media');
  private ocrWorker: any = null;
  private groq = config.groqKey ? new OpenAI({ apiKey: config.groqKey, baseURL: 'https://api.groq.com/openai/v1' }) : null;

  async onModuleDestroy() {
    await this.ocrWorker?.terminate?.();
  }

  isVideoOrAudio(mime: string, name: string) {
    return /^(video|audio)\//.test(mime) || /\.(mp4|mov|webm|mkv|m4a|mp3|wav|ogg)$/i.test(name);
  }

  async extractText(absPath: string, mime: string, name: string): Promise<{ text: string; method: string }> {
    const lower = name.toLowerCase();
    if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
      const text = await this.pdfText(absPath);
      if (text.replace(/\s/g, '').length > 40) return { text, method: 'pdf-text' };
      return { text: '', method: 'pdf-scanned' };
    }
    if (/^image\//.test(mime) || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(lower)) {
      return { text: await this.ocr(absPath), method: 'ocr' };
    }
    if (lower.endsWith('.docx')) {
      return { text: await this.docxText(absPath), method: 'docx' };
    }
    if (/^text\//.test(mime) || /\.(txt|md)$/i.test(lower)) {
      return { text: fs.readFileSync(absPath, 'utf8'), method: 'text' };
    }
    return { text: '', method: 'unsupported' };
  }

  private async pdfText(absPath: string): Promise<string> {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(absPath)));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : text;
  }

  private async ocr(absPath: string): Promise<string> {
    if (!this.ocrWorker) {
      const { createWorker } = await import('tesseract.js');
      this.ocrWorker = await createWorker('eng');
    }
    const { data } = await this.ocrWorker.recognize(absPath);
    return data.text as string;
  }

  private async docxText(absPath: string): Promise<string> {
    try {
      const mammoth: any = await import('mammoth');
      const res = await (mammoth.default ?? mammoth).extractRawText({ path: absPath });
      return res.value as string;
    } catch (e) {
      this.log.warn(`docx read failed: ${e}`);
      return '';
    }
  }

  /**
   * Audio only, decoded to what Whisper actually wants. The picture is never analysed.
   *
   * The previous version passed any accepted extension straight through, on the reasoning that
   * Whisper's API takes the containers a browser records into. It does take them — but a
   * `MediaRecorder` WebM is not an ordinary WebM. `rec.start(1000)` emits timesliced chunks that
   * are concatenated into one blob, and that blob has no duration and no cues in its header,
   * because only the first chunk carries initialisation data. Decoders tolerate this to wildly
   * different degrees: the usual results are a transcript that stops after the first few seconds,
   * or one that free-runs into invented sentences once the decoder loses the timeline. Both read
   * to the person as "it is making things up".
   *
   * So a browser recording is always re-encoded. 16 kHz mono is Whisper's own input format, so
   * this is not a lossy detour — it is the decode Whisper would do anyway, done by ffmpeg, which
   * is far better at reading a damaged container. WAV rather than MP3: it is what the model wants,
   * it costs no quality, and at 16 kHz mono a two-minute note is about 3.8 MB, well inside the
   * limit. A long video still goes to MP3, where the size matters more than the last decibel.
   */
  private async toUploadable(absPath: string): Promise<string> {
    const ext = path.extname(absPath).toLowerCase().replace('.', '');
    const bytes = (await fs.promises.stat(absPath).catch(() => null))?.size ?? 0;
    if (!bytes) return absPath;

    // Already a plain, seekable audio file from a real recorder or an upload: leave it alone.
    const clean = ['mp3', 'wav', 'flac', 'm4a', 'mpga', 'mpeg'];
    if (clean.includes(ext) && bytes < 24 * 1024 * 1024) return absPath;

    // webm/ogg/opus come from MediaRecorder; mp4 is usually a phone video.
    //
    // WAV is uncompressed, so the choice is about duration, not input size: 16 kHz mono runs at
    // 32 kB/s and crosses Whisper's 24 MB limit at about 13 minutes. A 40 MB Opus file can be
    // hours. The in-app recorders cap at 2 and 3 minutes, but an uploaded file has no cap, so ask
    // ffprobe how long it actually is and fall back to MP3 for anything long. Unknown duration is
    // treated as long — guessing short is the one that fails.
    // Only worth probing when the file is big enough that it might be long: a voice note is a few
    // hundred kB, and decoding it twice to learn what the 2-minute cap already guarantees is waste.
    // 3 MB of Opus is well over an hour, so anything under it is certainly short enough for WAV.
    const seconds = bytes < 3 * 1024 * 1024 ? 0 : await this.durationSeconds(absPath);
    const toWav = ext !== 'mp4' && seconds !== null && seconds <= 600;
    const out = absPath.replace(/\.[^.]+$/, '') + (toWav ? '.audio.wav' : '.audio.mp3');
    const codec = toWav ? ['-c:a', 'pcm_s16le'] : ['-b:a', '48k'];
    try {
      // `-vn` drops any video. 16 kHz mono is what the model resamples to regardless.
      //
      // `speechnorm` before the resample because a laptop or phone mic held at arm's length
      // records quietly, and Whisper transcribes a quiet signal noticeably worse — it is the
      // cheapest accuracy left on the table. Unlike `loudnorm` this is a single pass and expands
      // speech peaks continuously, so it lifts a soft talker without pumping the room tone up
      // between sentences, which would give the model noise to hallucinate words out of.
      await run(ffmpegPath, ['-y', '-i', absPath, '-vn', '-af', 'speechnorm=e=12.5:r=0.0001:l=1', '-ac', '1', '-ar', '16000', ...codec, out], { windowsHide: true });
      const made = (await fs.promises.stat(out).catch(() => null))?.size ?? 0;
      if (made > 0) return out;
      this.log.warn(`ffmpeg produced an empty file for ${path.basename(absPath)}; sending the original`);
    } catch (e: any) {
      this.log.warn(`ffmpeg could not convert ${path.basename(absPath)} (${e?.message ?? e}); sending the original to Whisper`);
    }
    return absPath;
  }

  /**
   * How long the media is, or null if it cannot be worked out.
   *
   * Asked of ffmpeg rather than ffprobe on purpose: `ffmpeg-static` ships only the one binary, so
   * an ffprobe call would fail on every machine that relies on it and silently push every note
   * down the MP3 path. `-f null -` decodes the whole stream and discards it, printing a final
   * `time=` on stderr — which also means it reports the real duration of a streamed
   * MediaRecorder file whose header claims none. Cheap at these lengths, and allowed to fail.
   */
  private async durationSeconds(absPath: string): Promise<number | null> {
    try {
      const { stderr } = await run(ffmpegPath, ['-i', absPath, '-f', 'null', '-'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
      // ffmpeg prints progress repeatedly; the last `time=` is the total.
      const all = [...String(stderr).matchAll(/time=(\d+):(\d\d):(\d\d(?:\.\d+)?)/g)];
      const last = all[all.length - 1];
      if (!last) return null;
      const s = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
      return Number.isFinite(s) && s > 0 ? s : null;
    } catch {
      return null;
    }
  }

  async transcribe(absPath: string): Promise<Transcript> {
    const audio = await this.toUploadable(absPath);
    // Which decode actually happened, and which model read it. A silent fallback to the original
    // container is the difference between a good transcript and a garbled one, and without this
    // line the only symptom is "the agent is making things up" with nothing in the log to explain
    // it. `converted: false` on a browser recording means ffmpeg failed and is the first thing to
    // check when a transcript comes back wrong.
    const converted = audio !== absPath;
    this.log.log(`transcribing ${path.basename(absPath)} -> ${path.basename(audio)} (converted: ${converted}, model: ${this.groq ? config.groqTranscribeModel : config.localWhisperModel})`);

    if (this.groq) {
      try {
        const res: any = await this.groq.audio.transcriptions.create({
          file: fs.createReadStream(audio),
          model: config.groqTranscribeModel,
          response_format: 'verbose_json',
          language: 'en',
          // Greedy decoding is what invents text when the audio is unclear. 0 makes the model take
          // the likeliest token rather than sampling, which is the difference between a halting
          // transcript and a fluent wrong one.
          temperature: 0,
          // Names and terms this cohort says constantly, which a general model mangles into
          // nonsense: "Anerkennung" becomes "an according", "Chancenkarte" becomes "chancing cart".
          // Whisper conditions on this text, so it is a vocabulary hint, not an instruction.
          prompt: TRANSCRIBE_PROMPT,
        });
        const text = String(res.text ?? '').trim();
        const segments = (res.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: String(s.text).trim() }));
        const kept = dropHallucinations({ text, segments });
        if (kept.text) return { ...kept, provider: 'groq' };
        this.log.warn('Groq returned nothing usable; trying local Whisper');
      } catch (e: any) {
        this.log.warn(`Groq transcription failed, using local Whisper: ${e?.message ?? e}`);
      }
    }
    const { stdout } = await run(config.localWhisperPython, [config.localWhisperScript, audio, config.localWhisperModel], {
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
      cwd: path.dirname(config.localWhisperScript),
    });
    const out = JSON.parse(stdout.trim().split('\n').pop()!);
    return { ...dropHallucinations({ text: out.text, segments: out.segments ?? [] }), provider: 'local' };
  }
}
