import { SECTION_LABEL, type Block, type SectionId } from '@educaro/shared';
import { FolderOpen } from 'lucide-react';
import { useMemo } from 'react';
import { useScreen } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { BlockList } from '../screen/ComposedScreen';
import { ScreenActionsProvider, useReadOnlyActions } from '../screen/context';
import { EmptyState, PageHeader } from '../ui/misc';
import { SafetyCheckPanel } from './SafetyCheckPanel';

/**
 * One section of the screen, whatever the API decided to put in it.
 *
 * Money and Safety had no page, so the API was returning a finance plan and a scam check that no
 * route displayed — which from the outside is indistinguishable from not having built them. Rather
 * than write a page per section and repeat the mistake on the next one, this renders by section id
 * and takes its order from `screen.sections`, so a new block type needs no change here at all.
 *
 * Life and Plan keep their own pages, because they group their blocks into tabs that this cannot
 * know about.
 */
const INTRO: Partial<Record<SectionId, string>> = {
  money: 'What the whole plan costs, when each piece is due, and what is still missing.',
  safety: 'Check anything you have been sent before you reply to it, and read the rights that hold whatever a contract says.',
  papers: 'Every document you have given me, and what each one proves.',
  community: 'The people on your route, and the thread you share with them.',
};

export default function SectionPage({ section }: { section: SectionId }) {
  const applicantId = useApplicantId();
  const { data: screen, isLoading } = useScreen(applicantId);
  const readOnly = useReadOnlyActions(applicantId);

  // The API's own ordering when it sent one, so this page agrees with the nav that led here.
  const blocks = useMemo<Block[]>(() => {
    const all = screen?.blocks ?? [];
    const listed = screen?.sections?.find((s) => s.id === section);
    if (listed) {
      const order = new Map(listed.blockIds.map((id, i) => [id, i]));
      return all.filter((b) => order.has(b.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    return all.filter((b) => b.section === section);
  }, [screen, section]);

  const label = SECTION_LABEL[section];

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader title={label}>{INTRO[section]}</PageHeader>

      {/* Safety is the one section with something to do rather than something to read: the whole
          point of the shield is that an applicant can bring us the thing they were sent. The blocks
          below it are the agent's own findings and the rights that apply either way. */}
      {section === 'safety' ? (
        <div className="mb-6">
          <SafetyCheckPanel />
        </div>
      ) : null}

      {blocks.length ? (
        <ScreenActionsProvider value={readOnly}>
          <BlockList blocks={blocks} />
        </ScreenActionsProvider>
      ) : section === 'safety' ? null : (
        <EmptyState title={isLoading ? 'Loading' : 'Nothing here yet'} icon={FolderOpen}>
          {isLoading
            ? `Reading your ${label.toLowerCase()}.`
            : `The agent puts things here as it works. Nothing in ${label.toLowerCase()} needs you right now.`}
        </EmptyState>
      )}
    </div>
  );
}
