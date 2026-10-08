import type { DemoPersona } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowRight, FlaskConical, GraduationCap, Headset, Sparkles, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api, errorText, isMock, setMockMode } from '../api/client';
import { ThemeToggle } from '../app/chrome';
import { Button } from '../ui/Button';
import { FullPageSpinner } from '../ui/Spinner';
import { Tag } from '../ui/Tag';
import { homeFor, useAuth } from './auth';

const DEMOS: { persona: DemoPersona; name: string; sub: string; icon: typeof Stethoscope; tone: string }[] = [
  { persona: 'ananya', name: 'Ananya Nair', sub: 'GNM nurse · Kochi · mid-plan', icon: Stethoscope, tone: 'text-applicant' },
  { persona: 'rohan', name: 'Rohan Mehta', sub: 'B.Tech CS · Pune · shortlisting', icon: GraduationCap, tone: 'text-agent' },
  { persona: 'fresh', name: 'Start from nothing', sub: 'Empty profile, upload your own story', icon: Sparkles, tone: 'text-loop' },
  { persona: 'staff', name: 'Educaro staff', sub: 'The command centre', icon: Headset, tone: 'text-staff' },
];

export function Login() {
  const { me, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'demo' | 'login' | 'register'>('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <FullPageSpinner label="Loading" />;
  if (me) return <Navigate to={(location.state as { from?: string } | null)?.from ?? homeFor(me.role)} replace />;

  const run = async (label: string, call: () => Promise<Parameters<typeof signIn>[0]>) => {
    setBusy(label);
    setError(null);
    try {
      const res = await call();
      signIn(res);
      navigate(homeFor(res.user.role), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Left: what this is. The hero is the agent's promise, in its own voice. */}
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden bg-ink px-6 py-8 text-bg sm:px-10 lg:py-12">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="7" fill="var(--bg)" />
            <path d="M8 8h14v3.6h-9.7v2.7h8.4v3.4h-8.4v2.7H22V24H8z" fill="var(--ink)" />
            <rect x="23" y="14.3" width="3.4" height="3.4" rx=".8" fill="#0c7683" />
          </svg>
          <span className="display text-[19px] font-extrabold">Educaro</span>
          <span className="ml-auto text-[12px] uppercase tracking-[0.12em] opacity-60">Applicant flow v2</span>
        </div>

        <div className="max-w-[26ch]">
          <h1 className="display text-[clamp(30px,5.2vw,46px)] font-extrabold leading-[1.04] tracking-[-0.02em]">
            Talk once.
            <br />
            Upload everything.
            <br />
            <span className="text-[#46c1cf]">Get a real plan.</span>
          </h1>
          <p className="mt-5 max-w-[42ch] text-[15.5px] leading-relaxed opacity-80">
            Record a short video, drop every document, and the agent builds your profile, checks it against the real requirements of the university or employer you pick, and fixes the
            gaps with Educaro’s own courses and services.
          </p>
        </div>

        <ul className="grid max-w-md gap-2.5 text-[14px]">
          {[
            ['Every fact carries its source', 'Verified, You said, Web-sourced or AI-generated. Only a document can verify.'],
            ['Never a rejection', 'Every gap gets a plan: what, where, how long, what it costs.'],
            ['Nothing leaves without your tap', 'The agent drafts applications. You approve them.'],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3 border-l-2 border-[#46c1cf] pl-3.5">
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block opacity-70">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Right: sign in. */}
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:py-12">
        <div className="mb-8 flex items-center justify-end gap-2">
          {isMock ? (
            <Tag s={{ label: 'Demo data', cls: 't-warn' }} title="Mock mode: nothing is sent to a server">
              <FlaskConical size={12} aria-hidden /> Demo data
            </Tag>
          ) : null}
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-sm">
          <h2 className="display text-[26px] font-extrabold leading-tight">{mode === 'register' ? 'Create your account' : 'Sign in'}</h2>
          <p className="mt-1.5 text-[14px] text-muted">
            {mode === 'demo' ? 'Pick a seeded persona, or use your own account.' : mode === 'register' ? 'Email and password. Your profile stays yours.' : 'With the email and password you signed up with.'}
          </p>

          {error ? (
            <p role="alert" className="mt-4 rounded-md border border-bad/40 bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[13.5px] text-bad">
              {error}
            </p>
          ) : null}

          {mode === 'demo' ? (
            <>
              <ul className="mt-5 space-y-2">
                {DEMOS.map((d) => (
                  <li key={d.persona}>
                    <button
                      type="button"
                      className="group flex w-full items-center gap-3.5 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-ink disabled:opacity-60"
                      disabled={busy !== null}
                      onClick={() => run(d.persona, () => api.demo(d.persona))}
                    >
                      <d.icon size={20} className={clsx('flex-none', d.tone)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold">{d.name}</span>
                        <span className="block text-[13px] text-muted">{d.sub}</span>
                      </span>
                      {busy === d.persona ? (
                        <span className="flex-none text-[12.5px] text-muted">Signing in…</span>
                      ) : (
                        <ArrowRight size={17} className="flex-none text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[12px] uppercase tracking-wider text-muted">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => setMode('login')}>
                  Sign in with email
                </Button>
                <Button className="flex-1" onClick={() => setMode('register')}>
                  Create an account
                </Button>
              </div>
            </>
          ) : (
            <form
              className="mt-5 space-y-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                void run('form', () => (mode === 'register' ? api.register({ email, password, name }) : api.login({ email, password })));
              }}
            >
              {mode === 'register' ? (
                <label className="block">
                  <span className="label">Your name</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </label>
              ) : null}
              <label className="block">
                <span className="label">Email</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                />
              </label>
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === 'form'}>
                {mode === 'register' ? 'Create account' : 'Sign in'}
              </Button>
              <button type="button" className="w-full text-[13.5px] font-semibold text-muted hover:text-ink" onClick={() => setMode('demo')}>
                Back to the demo logins
              </button>
            </form>
          )}

          <p className="mt-8 text-[12.5px] text-muted">
            {isMock ? (
              <>
                Running on demo data, with no server.{' '}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setMockMode(false)}>
                  Use the live API instead
                </button>
                .
              </>
            ) : (
              <>
                Connected to the Educaro API.{' '}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setMockMode(true)}>
                  Switch to demo data
                </button>{' '}
                if the server is not running.
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
