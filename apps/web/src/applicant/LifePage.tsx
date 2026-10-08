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
 * map had no room. They are one subject — the move — but two jobs: choosing a place, and the list
 * you work through once you land. One page, two tabs, so neither is a wall.
 */
const TABS = {
  place: { label: 'Where you’ll live', types: ['rentals', 'places', 'budget'] as Block['type'][] },
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
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Your life there">Where you could live, what a month costs, and what happens in your first weeks.</PageHeader>

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
