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

  /** Audio only. The picture is stored and never analysed. */
  /**
   * Whisper's API already accepts the containers a browser records into, so the ffmpeg step is an
   * optimisation, not a requirement: it only earns its keep on a file too big to post, or in a
   * container the API will not take. Treating it as mandatory made the whole feature depend on a
   * binary that npm resolves per-platform and can get wrong — which is exactly what happened here.
   */
  private async toUploadable(absPath: string): Promise<string> {
    const ext = path.extname(absPath).toLowerCase().replace('.', '');
    const accepted = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'opus', 'wav', 'webm'];
    const big = (await fs.promises.stat(absPath).catch(() => null))?.size ?? 0;
    if (accepted.includes(ext) && big > 0 && big < 24 * 1024 * 1024) return absPath;

    const audio = absPath.replace(/\.[^.]+$/, '') + '.audio.mp3';
    try {
      await run(ffmpegPath, ['-y', '-i', absPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', audio], { windowsHide: true });
      return audio;
    } catch (e: any) {
      this.log.warn(`ffmpeg unavailable (${e?.message ?? e}); sending the original file to Whisper`);
      return absPath;
    }
  }

  async transcribe(absPath: string): Promise<Transcript> {
    const audio = await this.toUploadable(absPath);

    if (this.groq) {
      try {
        const res: any = await this.groq.audio.transcriptions.create({
          file: fs.createReadStream(audio),
          model: config.groqTranscribeModel,
          response_format: 'verbose_json',
          language: 'en',
        });
        return {
          text: String(res.text ?? '').trim(),
          segments: (res.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: String(s.text).trim() })),
          provider: 'groq',
        };
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
    return { text: out.text, segments: out.segments, provider: 'local' };
  }
}
