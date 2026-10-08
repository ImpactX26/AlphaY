import type { BlockAction, Route } from '@educaro/shared';
import { createContext, type ReactNode, use, useMemo } from 'react';

export interface ScreenActions {
  applicantId: string;
  /** Staff viewing an applicant's screen: everything renders, nothing is clickable. */
  readOnly: boolean;
  answerQuestion: (questionId: string, answer: string) => void;
  answeringQuestionId: string | null;
  sendChat: (text: string) => void;
  shortlist: (input: { programmeId?: string; openingId?: string; url?: string }) => void;
  shortlistingId: string | null;
  openApproval: (approvalId: string) => void;
  goUpload: () => void;
  setRoute: (route: Route) => void;
}

const noop = () => {};

const FALLBACK: ScreenActions = {
  applicantId: '',
  readOnly: true,
  answerQuestion: noop,
  answeringQuestionId: null,
  sendChat: noop,
  shortlist: noop,
  shortlistingId: null,
  openApproval: noop,
  goUpload: noop,
  setRoute: noop,
};

const ScreenContext = createContext<ScreenActions>(FALLBACK);

export function ScreenActionsProvider({ value, children }: { value: ScreenActions; children: ReactNode }) {
  return <ScreenContext value={value}>{children}</ScreenContext>;
}

export function useScreenActions(): ScreenActions {
  return use(ScreenContext);
}

/** Read-only screens (the staff view) keep every block but disable its controls. */
export function useReadOnlyActions(applicantId: string): ScreenActions {
  return useMemo(() => ({ ...FALLBACK, applicantId }), [applicantId]);
}

/** Runs a `BlockAction` the agent put on a block. */
export function useRunAction(): (action: BlockAction) => void {
  const a = useScreenActions();
  return (action: BlockAction) => {
    if (a.readOnly) return;
    switch (action.kind) {
      case 'chat':
        if (action.value) a.sendChat(action.value);
        break;
      case 'upload':
        a.goUpload();
        break;
      case 'shortlist':
        if (action.value) a.shortlist({ programmeId: action.value });
        break;
      case 'open_approval':
        if (action.value) a.openApproval(action.value);
        break;
      case 'answer':
        break;
      default:
        break;
    }
  };
}
