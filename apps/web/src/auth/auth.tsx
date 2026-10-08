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

/**
 * The signed-in applicant's id. Only use inside the applicant app, which `RequireApplicant`
 * guarantees has one.
 *
 * It used to fall back to `''`, which does not throw anywhere — it builds `/applicants//video`,
 * and the upload 404s before it reaches the API. An id that is missing is a broken session, so
 * it says so here rather than three layers down in a request nobody is watching.
 */
export function useApplicantId(): string {
  const { me } = useAuth();
  if (!me?.applicantId) throw new Error('No applicant id on this session: useApplicantId outside RequireApplicant');
  return me.applicantId;
}

export const homeFor = (role: Role | undefined): string => (role === 'staff' ? '/staff' : '/app');

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { me, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullPageSpinner label="Signing you in" />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me.role !== role) return <Navigate to={homeFor(me.role)} replace />;
  if (role === 'applicant' && !me.applicantId) return <NoApplicantRow />;
  return <>{children}</>;
}

/**
 * An applicant user with no `applicants` row. `AuthUser.applicantId` is nullable in the contract,
 * so this is reachable — and every id-shaped call would otherwise go out with an empty segment.
 * Says what is wrong and offers the way out, instead of an upload button that quietly 404s.
 */
function NoApplicantRow() {
  const { signOut } = useAuth();
  return (
    <div className="mx-auto max-w-prose px-4 py-16">
      <h1 className="headline">This account has no applicant profile yet.</h1>
      <p className="mt-3 text-[15px] text-muted">
        You are signed in, but there is no applicant record attached to the account, so there is nothing to upload
        documents to. On a fresh demo database this means the seed has not run: <code>npm run seed</code>.
      </p>
      <button type="button" onClick={signOut} className="mt-5 text-[14px] font-semibold underline underline-offset-2">
        Sign in as someone else
      </button>
    </div>
  );
}

export function HomeRedirect() {
  const { me, ready } = useAuth();
  if (!ready) return <FullPageSpinner label="Loading" />;
  return <Navigate to={me ? homeFor(me.role) : '/login'} replace />;
}
