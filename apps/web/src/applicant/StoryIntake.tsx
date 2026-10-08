import { Upload } from 'lucide-react';
import { useFiles } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { RoleLabel } from '../ui/Tag';
import { DocumentList, DropZone } from './DocumentDrop';
import { VideoRecorder } from './VideoRecorder';

/**
 * Stage 2: one video and a document drop, instead of two forms.
 * The agent writes the headline and footnote; these stand-ins only cover the moment before it has
 * composed anything, so a new applicant still sees a complete page.
 */
export function StoryIntake({ headline, footnote }: { headline?: string; footnote?: string }) {
  return (
    <div className="min-w-0">
      <h1 className="headline max-w-[30ch]">{headline || 'Tell me your story once, and I’ll build your plan for Germany.'}</h1>
      <p className="mt-3 max-w-prose text-[15px] text-muted">
        No forms. Talk for a minute or two, drop every document you have, and the agent asks only what it cannot find.
      </p>
      <div className="mt-6 space-y-4">
        <VideoRecorder step="Step 1" />
        <DocumentStep />
      </div>
      <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">
        {footnote || 'Nothing is sent anywhere until you tap to approve it.'}
      </p>
    </div>
  );
}

function DocumentStep() {
  const applicantId = useApplicantId();
  const { data: files } = useFiles(applicantId);
  const documents = files?.filter((f) => f.kind !== 'video') ?? [];
  return (
    <section className="card overflow-hidden" id="upload">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <RoleLabel role="applicant">Step 2</RoleLabel>
          <h2 className="display mt-1.5 text-[17px] font-bold">Drop every document</h2>
        </div>
        {documents.length ? (
          <span className="flex-none text-[12.5px] text-muted">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-4 sm:px-5">
        <DropZone applicantId={applicantId} />
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-[13.5px] text-muted sm:grid-cols-2">
          <li>CV, any format</li>
          <li>Degree, diploma, 10th and 12th marksheets, transcripts</li>
          <li>Experience letters, payslips</li>
          <li>Language certificates: IELTS, Goethe, ÖSD, telc</li>
          <li>Passport</li>
          <li>Anything else you think matters</li>
        </ul>
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-muted">
          <Upload size={14} aria-hidden />
          Any order, any file name. Phone photos are fine.
        </p>
        {documents.length ? <DocumentList files={documents} className="mt-4" /> : null}
      </div>
    </section>
  );
}
