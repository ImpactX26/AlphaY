import type { Block } from '@educaro/shared';
import { ArrivalCard, BudgetCard, LettersCard, ReadinessCard, ServicesCard, TimelineCard } from './blocks/outcome';
import { PlacesCard } from './blocks/PlacesCard';
import { ChecklistCard, DocumentsCard, NextStepCard, NoteCard, QuestionCard, TruthMapCard } from './blocks/core';
import { GapPlanCard, MatrixCard, OpportunitiesCard, RouteCard, ShortlistCard } from './blocks/plan';

/**
 * One component per block type. The switch is exhaustive: a new type in screen.ts
 * fails the build here until it has a component.
 */
export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'next_step':
      return <NextStepCard block={block} />;
    case 'question':
      return <QuestionCard block={block} />;
    case 'checklist':
      return <ChecklistCard block={block} />;
    case 'documents':
      return <DocumentsCard block={block} />;
    case 'truth_map':
      return <TruthMapCard block={block} />;
    case 'route':
      return <RouteCard block={block} />;
    case 'opportunities':
      return <OpportunitiesCard block={block} />;
    case 'shortlist':
      return <ShortlistCard block={block} />;
    case 'requirement_matrix':
      return <MatrixCard block={block} />;
    case 'gap_plan':
      return <GapPlanCard block={block} />;
    case 'readiness':
      return <ReadinessCard block={block} />;
    case 'budget':
      return <BudgetCard block={block} />;
    case 'timeline':
      return <TimelineCard block={block} />;
    case 'services':
      return <ServicesCard block={block} />;
    case 'places':
      return <PlacesCard block={block} />;
    case 'letters':
      return <LettersCard block={block} />;
    case 'arrival':
      return <ArrivalCard block={block} />;
    case 'note':
      return <NoteCard block={block} />;
    default:
      return exhaustive(block);
  }
}

/** A block type with no component is a build error, not a runtime surprise. */
function exhaustive(block: never): null {
  console.error('[screen] no component for block', block);
  return null;
}
