import 'dotenv/config';
import * as path from 'node:path';
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
  groqTranscribeModel: env('GROQ_TRANSCRIBE_MODEL', 'whisper-large-v3-turbo'),
  openaiKey: env('OPENAI_API_KEY'),
  openaiModel: env('OPENAI_MODEL', 'gpt-5-mini'),
  openaiBudgetUsd: Number(env('OPENAI_BUDGET_USD', '40')),
  qualityProvider: env('LLM_QUALITY_PROVIDER', 'openai') as 'openai' | 'groq',

  localWhisperPython: env('LOCAL_WHISPER_PYTHON', path.resolve(process.cwd(), '../../tools/whisper/.venv/Scripts/python.exe')),
  localWhisperScript: path.resolve(process.cwd(), '../../tools/whisper/transcribe.py'),
  localWhisperModel: env('LOCAL_WHISPER_MODEL', 'base.en'),

  searchProvider: env('SEARCH_PROVIDER', 'duckduckgo') as 'duckduckgo' | 'tavily',
  tavilyKey: env('TAVILY_API_KEY'),

  // Mail: the team's own mailbox (SMTP to send, IMAP to read replies). Without credentials, Mailpit catches everything.
  smtpUser: env('SMTP_USER'),
  smtpPass: env('SMTP_PASS'),
  smtpHost: env('SMTP_HOST', env('SMTP_USER') ? 'smtp.gmail.com' : 'localhost'),
  smtpPort: Number(env('SMTP_PORT', env('SMTP_USER') ? '465' : '1025')),
  smtpSecure: env('SMTP_SECURE', env('SMTP_USER') ? 'true' : 'false') === 'true',
  imapHost: env('IMAP_HOST', 'imap.gmail.com'),
  imapPort: Number(env('IMAP_PORT', '993')),
  mailpitUrl: env('MAILPIT_URL', 'http://localhost:8025'),
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
