import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, DemoPersona, MeDTO } from '@educaro/shared';
import { api, setUnauthorizedHandler } from '@/api/client';
import { getToken, setToken } from '@/api/mode';
import { realtime } from '@/api/realtime';

type Status = 'loading' | 'authed' | 'anon';

interface AuthCtx {
  status: Status;
  me: MeDTO | null;
  loginDemo(persona: DemoPersona): Promise<MeDTO>;
  login(email: string, password: string): Promise<MeDTO>;
  register(name: string, email: string, password: string): Promise<MeDTO>;
  logout(): void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anon'));
  const [me, setMe] = useState<MeDTO | null>(null);

  const signOut = useCallback(() => {
    setToken(null);
    realtime.disconnect();
    qc.clear();
    setMe(null);
    setStatus('anon');
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  useEffect(() => {
    if (status !== 'loading') return;
    let alive = true;
    api
      .me()
      .then((user) => {
        if (!alive) return;
        setMe(user);
        setStatus('authed');
      })
      .catch(() => {
        if (alive) signOut();
      });
    return () => {
      alive = false;
    };
  }, [status, signOut]);

  useEffect(() => {
    if (status === 'authed') realtime.connect(getToken());
  }, [status]);

  const finish = useCallback(
    (res: AuthResponse) => {
      setToken(res.token);
      qc.clear();
      setMe(res.user);
      setStatus('authed');
      realtime.connect(res.token);
      return res.user;
    },
    [qc],
  );

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      me,
      loginDemo: async (persona) => finish(await api.demo(persona)),
      login: async (email, password) => finish(await api.login({ email, password })),
      register: async (name, email, password) => finish(await api.register({ name, email, password })),
      logout: signOut,
    }),
    [status, me, finish, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** The signed-in applicant's id (applicant role). */
export function useMyApplicantId(): string {
  const { me } = useAuth();
  if (!me?.applicantId) throw new Error('No applicant profile on this account');
  return me.applicantId;
}
