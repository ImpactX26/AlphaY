import type { ScreenSection, SectionId } from '@educaro/shared';

/**
 * Where each of the API's sections lives in the router.
 *
 * Three of these predate sections and have pages written for them — `plan`, `life` and `inbox`
 * each lay out their own tabs and empty states, so they keep their own route. Everything else is
 * served by the generic `SectionPage`, which renders whatever the API put in the section. That is
 * the point of the contract change: a new block type needs no change on this side.
 *
 * `papers` deliberately folds into Profile rather than earning a nav slot. It is the document list
 * and the truth map, which is reference material people go looking for, not somewhere they start.
 */
const PATHS: Record<SectionId, string> = {
  home: '/app',
  plan: '/app/plan',
  papers: '/app/profile',
  money: '/app/money',
  life: '/app/life',
  safety: '/app/safety',
  community: '/app/inbox',
  inbox: '/app/inbox',
};

export const sectionPath = (id: SectionId): string => PATHS[id] ?? '/app';

/** The sections that get their own nav entry, in the API's reading order. */
const NAV_SECTIONS: SectionId[] = ['plan', 'money', 'life', 'safety', 'inbox'];

/**
 * Nav entries from the screen, in the order the API sent them.
 *
 * Only sections that actually hold blocks are returned, so an applicant who has no money plan yet
 * does not get a Money tab that opens onto nothing. `community` and `inbox` both land on Inbox, so
 * they are merged and the attention flag is ORed — two dots on one tab would be a lie either way.
 */
export function navSections(sections: ScreenSection[] | undefined): { id: SectionId; label: string; to: string; needsAttention: boolean }[] {
  if (!sections?.length) return [];
  const byPath = new Map<string, { id: SectionId; label: string; to: string; needsAttention: boolean }>();
  for (const s of sections) {
    if (!s.blockIds.length) continue;
    const id = s.id === 'community' ? 'inbox' : s.id;
    if (!NAV_SECTIONS.includes(id)) continue;
    const to = sectionPath(id);
    const existing = byPath.get(to);
    if (existing) existing.needsAttention = existing.needsAttention || s.needsAttention;
    else byPath.set(to, { id, label: id === 'inbox' ? 'Inbox' : s.label, to, needsAttention: s.needsAttention });
  }
  return [...byPath.values()];
}
