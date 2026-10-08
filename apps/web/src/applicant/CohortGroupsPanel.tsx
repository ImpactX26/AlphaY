import clsx from 'clsx';
import { Check, Home, Plane, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useCohortGroups, useProposeShare, useRespondToGroup } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/misc';
import { toast } from '../ui/Toast';

const euro = (n: number) => `€${Math.round(n).toLocaleString('en-GB')}`;

/**
 * Flat-shares and travel groups, with the part that was missing: a way to say yes.
 *
 * The old block computed a sentence — "a flat for three in Ehrenfeld works out at about EUR 490
 * each" — which is true and does nothing. Everything here is an action: ask somebody, answer
 * somebody, see what you would actually each pay.
 *
 * An invitation waiting on you is pulled to the top and is the only thing on this panel with a
 * filled button, because it is the only thing here that somebody else is blocked on.
 */
export function CohortGroupsPanel() {
  const applicantId = useApplicantId();
  const { data, isLoading } = useCohortGroups(applicantId);
  const respond = useRespondToGroup(applicantId);
  const propose = useProposeShare(applicantId);
  const [asking, setAsking] = useState<string | null>(null);

  if (isLoading || !data) return null;
  const { groups, suggestion } = data;
  const waiting = groups.filter((g) => g.awaitingYou);
  const mine = groups.filter((g) => g.youAre === 'joined');
  const open = groups.filter((g) => g.youAre === null && g.status === 'open');

  if (!groups.length && !suggestion?.candidates.length) return null;

  function ask(who: string, label: string) {
    setAsking(who);
    propose.mutate(
      { who },
      {
        onSuccess: () => toast(`Asked ${label}. They decide — nothing is shared until they say yes.`),
        onError: () => toast(`I could not reach ${label} just now.`, 'error'),
        onSettled: () => setAsking(null),
      },
    );
  }

  return (
    <section className="mb-6">
      <SectionTitle>Going where you are going</SectionTitle>

      {waiting.map((g) => (
        <div key={g.id} className="mt-2 rounded-[var(--r)] border border-agent/50 bg-[color-mix(in_srgb,var(--agent)_5%,var(--surface))] p-4 shadow-[var(--lift)]">
          <p className="display text-[16px] font-bold leading-snug">
            {g.members.find((m) => m.role === 'owner')?.label ?? 'Someone'} asked you to {g.kind === 'travel' ? 'travel together' : 'share a flat'}
          </p>
          <p className="mt-1 text-[13.5px] text-muted">
            {g.city}, {g.month}
            {g.district ? ` · ${g.district}` : ''}
            {g.shareEachEur ? (
              <>
                {' '}
                · about <span className="num font-semibold text-ink">{euro(g.shareEachEur)}</span> each a month, split evenly
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={Check}
              loading={respond.isPending}
              onClick={() => respond.mutate({ groupId: g.id, accept: true }, { onSuccess: () => toast('You are in. I will start looking for flats that take all of you.') })}
            >
              Yes, count me in
            </Button>
            <Button icon={X} onClick={() => respond.mutate({ groupId: g.id, accept: false }, { onSuccess: () => toast('Declined. Nothing was shared.') })}>
              No thanks
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-muted">They do not see anything about you unless you accept.</p>
        </div>
      ))}

      {mine.map((g) => {
        const joined = g.members.filter((m) => m.status === 'joined');
        return (
          <div key={g.id} className="mt-2 rounded-[var(--r)] border border-line bg-surface-2/50 p-4">
            <p className="flex items-center gap-2 text-[14.5px] font-semibold">
              {g.kind === 'travel' ? <Plane size={16} className="flex-none text-muted" aria-hidden /> : <Home size={16} className="flex-none text-muted" aria-hidden />}
              {g.title}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {joined.length} of {g.seats}
              {g.shareEachEur ? (
                <>
                  {' '}
                  · <span className="num font-semibold text-ink">{euro(g.shareEachEur)}</span> each a month when it is full
                  {/* The two figures answer different questions, and showing only the first one makes
                      an unfilled group look cheaper than living in it would actually be this month. */}
                  {g.shareNowEur && g.shareNowEur !== g.shareEachEur ? `, about ${euro(g.shareNowEur)} each until then` : ''}
                </>
              ) : null}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {joined.map((m, i) => (
                <li key={i} className="rounded-full border border-line px-3 py-1 text-[13px]">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted"> · {m.route.replace(/_/g, ' ')}</span>
                  {m.homeCity ? <span className="text-muted"> · from {m.homeCity}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {open.length ? (
        <ul className="mt-2 space-y-2">
          {open.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2">
              <span className="min-w-0 flex-1 text-[13.5px]">
                <span className="font-medium">{g.title}</span>
                <span className="text-muted">
                  {' '}
                  · {g.seatsLeft} place{g.seatsLeft === 1 ? '' : 's'} left{g.shareEachEur ? `, about ${euro(g.shareEachEur)} each` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Nobody is in a group at first, and a list of strangers is not an invitation. This is the
          one-tap version of the thing the Discord bot does when somebody says it out loud. */}
      {!mine.length && suggestion?.candidates.length ? (
        <div className="mt-2 rounded-md border border-line px-3 py-3">
          <p className="text-[13.5px]">
            {suggestion.candidates.length} other{suggestion.candidates.length === 1 ? '' : 's'} heading for {suggestion.city} around {suggestion.month}. A flat for{' '}
            {suggestion.seats} there is about <span className="num font-semibold">{euro(suggestion.budgetEachEur)}</span> each — less than any of you would pay alone.
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {suggestion.candidates.map((c) => (
              <li key={c.applicantId}>
                <button
                  type="button"
                  onClick={() => ask(c.applicantId, c.label)}
                  disabled={asking === c.applicantId}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] transition hover:border-agent/60',
                    asking === c.applicantId && 'opacity-60',
                  )}
                >
                  <UserPlus size={13} aria-hidden />
                  <span className="font-medium">{c.label}</span>
                  {c.sharedInterest ? <span className="text-muted">· {c.sharedInterest}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">They get the choice. Nothing about you is shared unless they say yes.</p>
        </div>
      ) : null}
    </section>
  );
}
