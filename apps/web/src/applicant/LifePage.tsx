import type { Block } from '@educaro/shared';
import clsx from 'clsx';
import { Home as HomeIcon } from 'lucide-react';
import { useState } from 'react';
import { useScreen } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { BlocksOfType } from '../screen/ComposedScreen';
import { ScreenActionsProvider, useReadOnlyActions } from '../screen/context';
import { EmptyState, PageHeader } from '../ui/misc';

/**
 * Where you will actually live.
 *
 * The map, the rent locator, the budget and the arrival steps were buried mid-plan, where a 280px
 * map had no room. They are one subject — the move — but several jobs: choosing a place, paying
 * for it, arriving, and knowing when you are being cheated. One page, tabs, so none is a wall.
 *
 * A tab with nothing in it never renders, so a persona who has no scam check or no finance plan
 * simply sees fewer tabs rather than an empty one.
 */
const TABS = {
  place: { label: 'Where you’ll live', types: ['rentals', 'places'] as Block['type'][] },
  money: { label: 'What it costs', types: ['finance_plan', 'budget'] as Block['type'][] },
  // The honest version of the route, next to the people arriving with her: both are "what am I
  // actually walking into", and both belong before the money is spent rather than after.
  truth: { label: 'What it’s really like', types: ['reality_check', 'cohort_group'] as Block['type'][] },
  safe: { label: 'Is it safe?', types: ['scam_check', 'help'] as Block['type'][] },
  settling: { label: 'Settling in', types: ['arrival'] as Block['type'][] },
};
type TabKey = keyof typeof TABS;

export default function LifePage() {
  const applicantId = useApplicantId();
  const { data: screen } = useScreen(applicantId);
  const readOnly = useReadOnlyActions(applicantId);
  const [tab, setTab] = useState<TabKey>('place');

  const blocks = screen?.blocks ?? [];
  const available = (Object.keys(TABS) as TabKey[]).filter((k) => blocks.some((b) => TABS[k].types.includes(b.type)));
  const active = available.includes(tab) ? tab : available[0];

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader title="Your life there">
        Where you could live, what it costs over the whole plan, what the route is really like, and how to tell when someone is
        cheating you.
      </PageHeader>

      {available.length ? (
        <>
          {available.length > 1 ? (
            <div className="mb-6 flex flex-wrap gap-1.5 border-b border-line" role="tablist" aria-label="Your life there">
              {available.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active === k}
                  onClick={() => setTab(k)}
                  className={clsx(
                    'relative -mb-px px-3 py-2 text-[14px] font-semibold transition-colors',
                    active === k
                      ? 'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-ink'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  {TABS[k].label}
                </button>
              ))}
            </div>
          ) : null}

          <ScreenActionsProvider value={readOnly}>
            <BlocksOfType screen={screen} types={TABS[active].types} />
          </ScreenActionsProvider>
        </>
      ) : (
        <EmptyState title="Not yet" icon={HomeIcon}>
          Once your city is set, the agent finds rooms near where you are going, works out what a month costs there, and lists what
          to do in your first weeks.
        </EmptyState>
      )}
    </div>
  );
}
