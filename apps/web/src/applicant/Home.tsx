import type { Route } from '@educaro/shared';
import { MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText } from '../api/client';
import { useAddShortlist, useAnswerQuestion, useScreen, useSendChat, useSetRoute } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { ComposedScreen } from '../screen/ComposedScreen';
import { ScreenActionsProvider, type ScreenActions } from '../screen/context';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { toast } from '../ui/Toast';
import { ChatPanel } from './ChatPanel';
import { StoryIntake } from './StoryIntake';

export function Home() {
  const applicantId = useApplicantId();
  const navigate = useNavigate();
  const { data: screen, isLoading } = useScreen(applicantId);
  const answer = useAnswerQuestion(applicantId);
  const chat = useSendChat(applicantId);
  const shortlist = useAddShortlist(applicantId);
  const setRoute = useSetRoute(applicantId);
  const [chatOpen, setChatOpen] = useState(false);

  const actions = useMemo<ScreenActions>(
    () => ({
      applicantId,
      readOnly: false,
      answeringQuestionId: answer.isPending ? answer.variables.questionId : null,
      answerQuestion: (questionId, value) =>
        answer.mutate({ questionId, answer: value }, { onError: (err) => toast(errorText(err), 'error') }),
      sendChat: (text) => {
        setChatOpen(true);
        chat.mutate(text, { onError: (err) => toast(errorText(err), 'error') });
      },
      shortlistingId: shortlist.isPending ? (shortlist.variables.programmeId ?? shortlist.variables.openingId ?? 'pasted-url') : null,
      shortlist: (input) =>
        shortlist.mutate(input, {
          onSuccess: () => toast('Shortlisted. The agent is reading their page.'),
          onError: (err) => toast(errorText(err), 'error'),
        }),
      openApproval: (approvalId) => navigate(`/app/approvals/${approvalId}`),
      goUpload: () => navigate('/app/profile#upload'),
      setRoute: (route: Route) => setRoute.mutate(route, { onError: (err) => toast(errorText(err), 'error') }),
    }),
    [applicantId, answer, chat, shortlist, navigate, setRoute],
  );

  // No story yet: the first screen asks for one video and a pile of files. An applicant with nothing
  // composed yet must never land on a blank page, so the intake stands in whenever there are no blocks —
  // whatever the mode, and even if the screen endpoint 404s on a brand-new applicant.
  const empty = !isLoading && !screen?.blocks.length;

  return (
    <ScreenActionsProvider value={actions}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_352px] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {empty ? <StoryIntake headline={screen?.headline} footnote={screen?.footnote} /> : <ComposedScreen screen={screen} loading={isLoading} />}
        </div>

        {/* Desktop: chat beside the screen. Mobile: a bottom sheet. */}
        <aside className="sticky top-[72px] hidden h-[calc(100dvh-104px)] min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface lg:flex">
          <div className="border-b border-line px-4 py-2.5">
            <h2 className="display text-[15px] font-bold">Chat with your agent</h2>
            <p className="text-[12.5px] text-muted">It reads your answers and updates your screen.</p>
          </div>
          <ChatPanel applicantId={applicantId} className="min-h-0 flex-1" />
        </aside>
      </div>

      <Button
        variant="primary"
        className="fixed bottom-[76px] right-4 z-20 h-12 rounded-full px-4 shadow-[var(--overlay-shadow)] lg:hidden"
        icon={MessageCircle}
        onClick={() => setChatOpen(true)}
      >
        Chat
      </Button>
      <Dialog open={chatOpen} onClose={() => setChatOpen(false)} title="Chat with your agent" description="It reads your answers and updates your screen." variant="sheet">
        <ChatPanel applicantId={applicantId} className="h-[65dvh]" autoFocus />
      </Dialog>
    </ScreenActionsProvider>
  );
}
