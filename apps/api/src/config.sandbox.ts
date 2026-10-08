import { Logger } from '@nestjs/common';

/**
 * Sandbox mode: the whole product, no network, no keys, same code.
 *
 * Three things kept breaking demos of this build, and none of them were the product: a Groq daily
 * quota running out mid-sentence, Overpass blocked on a conference network, and a university's own
 * server being slow. Each one degrades gracefully in isolation, but together they make a live demo
 * a coin toss, and they make a reviewer's first five minutes depend on whether the wifi likes them.
 *
 * SANDBOX=1 forces every external dependency onto the path it would take if it were unavailable:
 * the rule-based fallbacks that already exist, the stand-in source pages we already serve, the
 * seeded city places, Mailpit instead of Gmail, and Discord off. Nothing is stubbed and no code
 * path is special-cased — it is the same system with its outside edges turned off, which is also
 * the honest way to show that the fallbacks are real rather than decorative.
 *
 * It is not a demo mode. If the product is worse in here, the product is worse.
 */
export function applySandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  const on = env.SANDBOX === '1' || env.SANDBOX === 'true';
  if (!on) return false;

  // Models: no keys means every task takes its rule-based path.
  env.GROQ_API_KEY = '';
  env.OPENAI_API_KEY = '';

  // Web: the stand-in pages we serve ourselves, never the live internet.
  env.SEARCH_PROVIDER = 'none';
  env.TAVILY_API_KEY = '';
  env.OFFLINE = '1';

  // Mail: Mailpit only. Nothing can reach a real inbox from in here.
  env.SMTP_USER = '';
  env.SMTP_PASS = '';
  env.SMTP_HOST = env.SMTP_HOST || 'localhost';
  env.SMTP_PORT = env.SMTP_PORT || '1025';
  env.SMTP_SECURE = 'false';
  env.MAIL_SAFE_MODE = 'true';

  // Discord off: a bot that cannot reach the gateway only produces noise in the log.
  env.DISCORD_TOKEN = '';

  new Logger('Sandbox').warn('SANDBOX=1 — no keys, no outbound network, stand-in sources, Mailpit only. Everything you see is the rule-based path.');
  return true;
}

export const isSandbox = () => process.env.SANDBOX === '1' || process.env.SANDBOX === 'true';
