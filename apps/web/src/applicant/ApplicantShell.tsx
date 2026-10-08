import clsx from 'clsx';
import { CalendarCheck, FlaskConical, House, Inbox, MailX, Repeat, UserRound, Waypoints } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { RouteBoundary } from '../app/RouteBoundary';
import { isMock } from '../api/client';
import { mockDemo } from '../api/mock';
import { useApprovals, useQuestions } from '../api/queries';
import { AgentPill, Logo, MenuItem, MockBadge, ThemeToggle, UserMenu } from '../app/chrome';
import { useApplicantId } from '../auth/auth';
import { FullPageSpinner } from '../ui/Spinner';

/**
 * Four places to look, not six. Profile and Shortlist are reached from Plan, which is where you
 * are already thinking about them; Life holds the move itself.
 */
const NAV = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/plan', label: 'Plan', icon: Waypoints, end: false },
  { to: '/app/life', label: 'Life', icon: UserRound, end: false },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox, end: false },
] as const;

function useBadges(applicantId: string): Record<string, number> {
  const approvals = useApprovals(applicantId);
  const questions = useQuestions(applicantId);
  return {
    '/app': questions.data?.filter((q) => q.status === 'open').length ?? 0,
    '/app/inbox': approvals.data?.filter((a) => a.status === 'pending').length ?? 0,
  };
}

export function ApplicantShell() {
  const applicantId = useApplicantId();
  const badges = useBadges(applicantId);
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1460px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo to="/app" />
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    'relative rounded-md px-3 py-2 text-[14px] font-semibold no-underline transition-colors',
                    isActive ? 'text-ink' : 'text-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {n.label}
                    {badges[n.to] ? <span className="ml-1.5 rounded-full bg-agent px-1.5 py-px text-[11px] font-bold text-surface">{badges[n.to]}</span> : null}
                    {isActive ? <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-ink" aria-hidden /> : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <MockBadge />
            <AgentPill applicantId={applicantId} className="hidden max-w-[260px] md:inline-flex" />
            <ThemeToggle />
            <UserMenu
              extra={
                isMock
                  ? (close) => (
                      <div className="border-b border-line pb-1.5">
                        <p className="flex items-center gap-1.5 px-3.5 pb-1 pt-2 text-[12px] font-semibold text-loop">
                          <FlaskConical size={13} aria-hidden /> Demo tools
                        </p>
                        <MenuItem
                          icon={Repeat}
                          onClick={() => {
                            close();
                            mockDemo.replayIntake(applicantId);
                          }}
                        >
                          Replay the intake live
                        </MenuItem>
                        <MenuItem
                          icon={CalendarCheck}
                          onClick={() => {
                            close();
                            mockDemo.employerReply(applicantId, 'interview');
                          }}
                        >
                          Simulate an interview invite
                        </MenuItem>
                        <MenuItem
                          icon={MailX}
                          onClick={() => {
                            close();
                            mockDemo.employerReply(applicantId, 'missing_paper');
                          }}
                        >
                          Simulate a missing-paper reply
                        </MenuItem>
                      </div>
                    )
                  : undefined
              }
            />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1460px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-14 lg:pt-7">
        <Suspense fallback={<FullPageSpinner label="Loading" />}>
          <RouteBoundary>
            <Outlet />
          </RouteBoundary>
        </Suspense>
      </main>

      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5 px-1 pt-1.5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx('relative flex flex-col items-center gap-0.5 rounded-md py-1 text-[11px] font-semibold no-underline', isActive ? 'text-ink' : 'text-muted')
                }
              >
                {({ isActive }) => (
                  <>
                    <n.icon size={21} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                    {n.label}
                    {badges[n.to] ? (
                      <span className="absolute right-[calc(50%-20px)] top-0 min-w-4 rounded-full bg-agent px-1 text-center text-[10px] font-bold leading-4 text-surface">
                        {badges[n.to]}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
