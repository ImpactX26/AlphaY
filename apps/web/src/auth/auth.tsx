import type { AuthResponse, MeDTO, Role } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, onUnauthorized, tokenStore } from '../api/client';
import { connectRealtime, disconnectRealtime } from '../realtime/socket';
import { FullPageSpinner } from '../ui/Spinner';

interface AuthContextValue {
  me: MeDTO | null;
  ready: boolean;
  signIn: (res: AuthResponse) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [me, setMe] = useState<MeDTO | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => {
    tokenStore.set(null);
    disconnectRealtime();
    qc.clear();
    setMe(null);
  }, [qc]);

  const signIn = useCallback(
    (res: AuthResponse) => {
      qc.clear();
      tokenStore.set(res.token);
      connectRealtime(res.token);
      setMe(res.user);
    },
    [qc],
  );

  useEffect(() => {
    onUnauthorized(signOut);
    const token = tokenStore.get();
    if (!token) {
      setReady(true);
      return;
    }
    let live = true;
    api
      .me()
      .then((user) => {
        if (!live) return;
        connectRealtime(token);
        setMe(user);
      })
      .catch(() => {
        if (live) tokenStore.set(null);
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [signOut]);

  const value = useMemo(() => ({ me, ready, signIn, signOut }), [me, ready, signIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in applicant's id. Only use inside the applicant app. */
export function useApplicantId(): string {
  const { me } = useAuth();
  return me?.applicantId ?? '';
}

export const homeFor = (role: Role | undefined): string => (role === 'staff' ? '/staff' : '/app');

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { me, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullPageSpinner label="Signing you in" />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me.role !== role) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}

export function HomeRedirect() {
  const { me, ready } = useAuth();
  if (!ready) return <FullPageSpinner label="Loading" />;
  return <Navigate to={me ? homeFor(me.role) : '/login'} replace />;
}
