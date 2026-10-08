import { Link } from 'react-router';
import { useAuth, homeFor } from '../auth/auth';

export function NotFound() {
  const { me } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <p className="display text-[48px] font-black leading-none text-muted">404</p>
        <h1 className="display mt-3 text-[22px] font-bold">This page does not exist</h1>
        <p className="mt-2 text-[14px] text-muted">The link may be old, or the page moved.</p>
        <Link to={me ? homeFor(me.role) : '/login'} className="btn btn-primary mt-5 no-underline">
          {me ? 'Back to your screen' : 'Sign in'}
        </Link>
      </div>
    </div>
  );
}
