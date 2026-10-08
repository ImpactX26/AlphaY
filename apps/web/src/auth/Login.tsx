import type { DemoPersona } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowRight, FlaskConical, GraduationCap, Headset, Sparkles, Stethoscope, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api, errorText, isMock, setMockMode } from '../api/client';
import { useSystemStatus } from '../api/queries';
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
  const status = useSystemStatus();

  if (!ready) return <FullPageSpinner label="Loading" />;
  if (me) return <Navigate to={(location.state as { from?: string } | null)?.from ?? homeFor(me.role)} replace />;

  // Demo insurance: a dead API should never be a dead screen.
  const apiDown = !isMock && status.isError;

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
    // One calm panel on the ground. The old page split the screen dark/light and ran a three-colour
    // headline beside three feature blurbs — a lot to take in before you have even signed in.
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-6 flex w-full max-w-[420px] items-center justify-between">
        <span className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="7" fill="var(--ink)" />
            <path d="M8 8h14v3.6h-9.7v2.7h8.4v3.4h-8.4v2.7H22V24H8z" fill="var(--bg)" />
            <rect x="23" y="14.3" width="3.4" height="3.4" rx=".8" fill="var(--applicant)" />
          </svg>
          <span className="display text-[19px] font-black">Educaro</span>
        </span>
        <span className="flex items-center gap-2">
          {isMock ? (
            <Tag s={{ label: 'Demo data', cls: 't-warn' }} title="Mock mode: nothing is sent to a server">
              <FlaskConical size={12} aria-hidden /> Demo data
            </Tag>
          ) : null}
          <ThemeToggle />
        </span>
      </div>

      <section className="card w-full max-w-[420px] px-6 py-7">
          <h2 className="display text-[26px] font-black leading-tight">{mode === 'register' ? 'Create your account' : 'Sign in'}</h2>
          <p className="mt-1.5 text-[14px] text-muted">
            {mode === 'demo' ? 'Pick a seeded persona, or use your own account.' : mode === 'register' ? 'Email and password. Your profile stays yours.' : 'With the email and password you signed up with.'}
          </p>

          {apiDown ? (
            <div role="alert" className="mt-4 rounded-lg border border-warn/45 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3.5 py-3">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                <TriangleAlert size={15} className="flex-none text-warn" aria-hidden />
                The Educaro server is not answering
              </p>
              <p className="mt-1 text-[13px] text-muted">Start it with <span className="kbd">npm run dev:api</span>, or carry on with demo data in the browser.</p>
              <Button size="sm" variant="primary" className="mt-2.5" icon={FlaskConical} onClick={() => setMockMode(true)}>
                Use demo data
              </Button>
            </div>
          ) : null}

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
      </section>
    </div>
  );
}
