import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { ApplicantShell } from './applicant/ApplicantShell';
import { Home } from './applicant/Home';
import { AuthProvider, HomeRedirect, RequireRole } from './auth/auth';
import { Login } from './auth/Login';
import { ErrorBoundary, ErrorCard } from './app/ErrorBoundary';
import { NotFound } from './app/NotFound';
import { RealtimeBridge } from './realtime/RealtimeBridge';
import { StaffShell } from './staff/StaffShell';
import { Toaster } from './ui/Toast';

// Applicant
const Profile = lazy(() => import('./applicant/Profile'));
const ShortlistPage = lazy(() => import('./applicant/ShortlistPage'));
const PlanPage = lazy(() => import('./applicant/PlanPage'));
const InboxPage = lazy(() => import('./applicant/InboxPage'));
const ApprovalPage = lazy(() => import('./applicant/ApprovalPage'));
const InterviewPage = lazy(() => import('./applicant/InterviewPage'));

// Staff
const Pipeline = lazy(() => import('./staff/Pipeline'));
const ApplicantDetail = lazy(() => import('./staff/ApplicantDetail'));
const QueuePage = lazy(() => import('./staff/QueuePage'));
const CopilotPage = lazy(() => import('./staff/CopilotPage'));
const OpeningsPage = lazy(() => import('./staff/OpeningsPage'));
const PlannerPage = lazy(() => import('./staff/PlannerPage'));
const BroadcastsPage = lazy(() => import('./staff/BroadcastsPage'));
const MailTrackerPage = lazy(() => import('./staff/MailTrackerPage'));
const AuditPage = lazy(() => import('./staff/AuditPage'));

export function App() {
  return (
    <ErrorBoundary
      label="Educaro"
      fallback={(reset, error) => (
        <div className="mx-auto max-w-lg px-4 py-16">
          <ErrorCard label="Educaro" error={error} onRetry={reset} />
          <p className="mt-4 text-[13px] text-muted">
            If this keeps happening, reload the page. Nothing you have uploaded or approved is lost.
          </p>
        </div>
      )}
    >
      <AuthProvider>
      <RealtimeBridge />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/app"
          element={
            <RequireRole role="applicant">
              <ApplicantShell />
            </RequireRole>
          }
        >
          <Route index element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="shortlist" element={<ShortlistPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="approvals/:approvalId" element={<ApprovalPage />} />
          <Route path="interview" element={<InterviewPage />} />
        </Route>

        <Route
          path="/staff"
          element={
            <RequireRole role="staff">
              <StaffShell />
            </RequireRole>
          }
        >
          <Route index element={<Pipeline />} />
          <Route path="applicants/:applicantId" element={<ApplicantDetail />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="copilot" element={<CopilotPage />} />
          <Route path="openings" element={<OpeningsPage />} />
          <Route path="openings/:openingId" element={<OpeningsPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="broadcasts" element={<BroadcastsPage />} />
          <Route path="mail" element={<MailTrackerPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}
