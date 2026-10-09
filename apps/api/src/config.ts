import * as path from 'node:path';
import * as dotenv from 'dotenv';

/**
 * Load `apps/api/.env`, then fall back to the one at the repository root.
 *
 * Two files, one of them open in somebody's editor, and only one of them read: a key pasted into
 * the root `.env` left the API quietly running on the free tier with `openai=false` in its own boot
 * log, which nobody reads twice. `override: false` keeps the nearer file authoritative, so this
 * only ever fills in what `apps/api/.env` left blank.
 */
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: false });
import { applySandbox } from './config.sandbox';

// Before anything is read: SANDBOX=1 blanks the keys and pins the outside edges to their offline
// paths, so the config below sees the same environment every other process would.
applySandbox();

const env = (k: string, d = '') => process.env[k]?.trim() || d;

export const config = {
  port: Number(env('PORT', '3000')),
  databaseUrl: env('DATABASE_URL', 'postgres://educaro:educaro@localhost:5433/educaro'),
  redisUrl: env('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: env('JWT_SECRET', 'dev-secret'),
  webUrl: env('WEB_URL', 'http://localhost:5173'),
  apiUrl: env('API_URL', 'http://localhost:3000'),
  storageDir: path.resolve(process.cwd(), env('STORAGE_DIR', '../../storage')),

  groqKey: env('GROQ_API_KEY'),
  groqModel: env('GROQ_MODEL', 'openai/gpt-oss-120b'),
  // `whisper-large-v3`, not the turbo distil. Groq's own figures: 10.3% word error rate against
  // turbo's 12%, and they recommend it for error-sensitive work. Turbo cuts the decoder from 32
  // layers to 4, which is exactly the part that resolves an unfamiliar accent — and both are free.
  // Transcription accuracy is the whole input to the agent here, so the slower one is correct.
  groqTranscribeModel: env('GROQ_TRANSCRIBE_MODEL', 'whisper-large-v3'),
  openaiKey: env('OPENAI_API_KEY'),
  openaiModel: env('OPENAI_MODEL', 'gpt-5-mini'),
  openaiBudgetUsd: Number(env('OPENAI_BUDGET_USD', '40')),
  qualityProvider: env('LLM_QUALITY_PROVIDER', 'openai') as 'openai' | 'groq',
  /**
   * Which provider to try first for *every* call, not just the quality tier.
   *
   * 'auto' keeps the original split: Groq for cheap work, OpenAI for quality. 'openai' puts OpenAI
   * in front of everything, which is what you want once a paid key exists and the free tier's
   * 8,000-tokens-a-minute ceiling is doing more harm than the spend saves. The budget cap still
   * applies either way, and Groq stays as the fallback underneath it.
   */
  llmProvider: env('LLM_PROVIDER', 'auto') as 'openai' | 'groq' | 'auto',

  localWhisperPython: env('LOCAL_WHISPER_PYTHON', path.resolve(process.cwd(), '../../tools/whisper/.venv/Scripts/python.exe')),
  localWhisperScript: path.resolve(process.cwd(), '../../tools/whisper/transcribe.py'),
  localWhisperModel: env('LOCAL_WHISPER_MODEL', 'small.en'),

  searchProvider: env('SEARCH_PROVIDER', 'duckduckgo') as 'duckduckgo' | 'tavily',
  tavilyKey: env('TAVILY_API_KEY'),

  // The interviewer's voice. Optional on purpose: with no key the browser's own speechSynthesis
  // reads the question for free, so this is an upgrade and never a dependency. ElevenLabs bills
  // per character, so the cache in tts.service.ts matters more than it looks.
  elevenLabsKey: env('ELEVENLABS_API_KEY'),
  // Rachel: calm, neutral, clearly enunciated English, which is what someone practising an
  // interview in a second language needs. Any voice id from the account's library works.
  elevenLabsVoiceId: env('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
  // Turbo v2.5 is their low-latency model: this is a live call, and a two-second pause before
  // every question is worse than a slightly richer voice.
  elevenLabsModel: env('ELEVENLABS_MODEL', 'eleven_turbo_v2_5'),

  // Mail: the team's own mailbox (SMTP to send, IMAP to read replies). Without credentials, Mailpit catches everything.
  smtpUser: env('SMTP_USER'),
  smtpPass: env('SMTP_PASS'),
  smtpHost: env('SMTP_HOST', env('SMTP_USER') ? 'smtp.gmail.com' : 'localhost'),
  smtpPort: Number(env('SMTP_PORT', env('SMTP_USER') ? '465' : '1025')),
  smtpSecure: env('SMTP_SECURE', env('SMTP_USER') ? 'true' : 'false') === 'true',
  imapHost: env('IMAP_HOST', 'imap.gmail.com'),
  imapPort: Number(env('IMAP_PORT', '993')),
  mailpitUrl: env('MAILPIT_URL', 'http://localhost:8025'),
  // A model on this machine (Ollama and anything else that speaks the OpenAI API).
  localLlmUrl: env('LOCAL_LLM_URL', 'http://localhost:11434/v1'),
  localLlmModel: env('LOCAL_LLM_MODEL'),
  localLlmFirst: env('LOCAL_LLM_FIRST') === '1' || env('LOCAL_LLM_FIRST') === 'true',
  sandbox: env('SANDBOX') === '1' || env('SANDBOX') === 'true',
  offline: env('OFFLINE') === '1',
  mailFrom: env('MAIL_FROM', env('SMTP_USER') ? `Educaro Agent <${env('SMTP_USER')}>` : 'Educaro Agent <agent@educaro.local>'),
  /** Safe mode: every third-party recipient is redirected to the team inbox. Never mail a real office from a prototype. */
  mailSafeMode: env('MAIL_SAFE_MODE', 'true') !== 'false',
  mailSafeRedirect: env('MAIL_SAFE_REDIRECT', env('SMTP_USER', 'demo-inbox@educaro.local')),
  mailAllowed: env('MAIL_ALLOWED')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  mailPollSeconds: Number(env('MAIL_POLL_SECONDS', '20')),

  discordToken: env('DISCORD_TOKEN'),
  discordAppId: env('DISCORD_APP_ID'),
  discordGuildId: env('DISCORD_GUILD_ID'),
};
