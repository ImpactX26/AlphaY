import 'dotenv/config';
import * as path from 'node:path';

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

  smtpHost: env('SMTP_HOST', 'localhost'),
  smtpPort: Number(env('SMTP_PORT', '1025')),
  mailpitUrl: env('MAILPIT_URL', 'http://localhost:8025'),
  mailFrom: env('MAIL_FROM', 'Educaro Agent <agent@educaro.local>'),
  mailReplyDomain: env('MAIL_REPLY_DOMAIN', 'educaro.local'),

  discordToken: env('DISCORD_TOKEN'),
  discordAppId: env('DISCORD_APP_ID'),
  discordGuildId: env('DISCORD_GUILD_ID'),
};
