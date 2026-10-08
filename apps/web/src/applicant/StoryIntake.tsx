import clsx from 'clsx';
import { CircleAlert, FileUp, RotateCcw, Square, Upload, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorText } from '../api/client';
import { qk, useFiles } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { formatDuration } from '../lib/format';
import { Button } from '../ui/Button';
import { RoleLabel } from '../ui/Tag';
import { toast } from '../ui/Toast';
import { DocumentList, DropZone } from './DocumentDrop';
import { useRecorder } from './useRecorder';

const PROMPTS = ['Who are you?', 'What have you studied and worked on?', 'Why Germany?', 'Where do you want to be in two years?'];
const MIN_SECONDS = 20;
const MAX_SECONDS = 180;

/** Stage 2: one video and a document drop, instead of two forms. */
export function StoryIntake({ headline, footnote }: { headline: string; footnote: string }) {
  return (
    <div className="min-w-0">
      <h1 className="headline max-w-[30ch]">{headline}</h1>
      <p className="mt-3 max-w-prose text-[15px] text-muted">
        No forms. Talk for a minute or two, drop every document you have, and the agent asks only what it cannot find.
      </p>
      <div className="mt-6 space-y-4">
        <VideoStep />
        <DocumentStep />
      </div>
      <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">{footnote}</p>
    </div>
  );
}

function VideoStep() {
  const qc = useQueryClient();
  const applicantId = useApplicantId();
  const { data: files } = useFiles(applicantId);
  const recorder = useRecorder('video', MAX_SECONDS);
  const [recorded, setRecorded] = useState<{ blob: Blob; extension: string; seconds: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const liveRef = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploaded = files?.find((f) => f.kind === 'video');

  useEffect(() => {
    if (liveRef.current && recorder.stream) liveRef.current.srcObject = recorder.stream;
  }, [recorder.stream]);

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const upload = async (blob: Blob, filename: string) => {
    setProgress(0);
    try {
      await api.uploadVideo(applicantId, blob, filename, setProgress);
      toast('Video uploaded. The agent is listening to it now.');
      setRecorded(null);
      setPreviewUrl(null);
      void qc.invalidateQueries({ queryKey: qk.files(applicantId) });
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setProgress(null);
    }
  };

  const stop = async () => {
    const result = await recorder.stop();
    if (!result) return;
    setRecorded(result);
    setPreviewUrl(URL.createObjectURL(result.blob));
  };

  const tooShort = recorded !== null && recorded.seconds < MIN_SECONDS;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <RoleLabel role="applicant">Step 1</RoleLabel>
          <h2 className="display mt-1.5 text-[17px] font-bold">Tell your story, 1 to 3 minutes</h2>
        </div>
        {uploaded ? <span className="tag t-ver flex-none">Video received</span> : null}
      </div>

      <div className="px-4 py-4 sm:px-5">
        {recorder.state === 'recording' || recorded ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg bg-ink">
              {recorder.state === 'recording' ? (
                // Mirrored like a selfie camera, so moving feels natural.
                <video ref={liveRef} autoPlay muted playsInline className="aspect-video w-full -scale-x-100 object-cover" aria-label="Camera preview" />
              ) : (
                <video src={previewUrl ?? undefined} controls playsInline className="aspect-video w-full object-cover" aria-label="Your recording" />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              {recorder.state === 'recording' ? (
                <>
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-bad">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" aria-hidden />
                    Recording
                    <span className="num ml-auto tabular-nums text-ink">
                      {formatDuration(recorder.seconds)} / {formatDuration(MAX_SECONDS)}
                    </span>
                  </p>
                  <ol className="mt-3 space-y-2">
                    {PROMPTS.map((prompt, i) => {
                      // The prompts walk forward so there is always something to say.
                      const slot = Math.floor(recorder.seconds / 25);
                      return (
                        <li
                          key={prompt}
                          className={clsx(
                            'flex gap-2.5 rounded-md px-2.5 py-2 text-[14px] transition-colors',
                            i === slot ? 'bg-agent/10 font-semibold text-agent' : i < slot ? 'text-muted line-through decoration-line' : 'text-muted',
                          )}
                        >
                          <span className="num flex-none opacity-60">{i + 1}</span>
                          {prompt}
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-auto flex gap-2 pt-4">
                    <Button variant="ghost" onClick={recorder.cancel}>
                      Cancel
                    </Button>
                    <Button variant="primary" icon={Square} onClick={stop} disabled={recorder.seconds < 3}>
                      Stop
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-semibold">
                    {formatDuration(recorded?.seconds ?? 0)} recorded.{' '}
                    {tooShort ? <span className="text-warn">That is quite short — the agent gets more out of a minute or two.</span> : 'Watch it back, then send it.'}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button
                      variant="primary"
                      loading={progress !== null}
                      onClick={() => recorded && upload(recorded.blob, `intro-video.${recorded.extension}`)}
                    >
                      {progress !== null && progress < 1 ? `Sending ${Math.round(progress * 100)}%` : 'Send to the agent'}
                    </Button>
                    <Button
                      icon={RotateCcw}
                      onClick={() => {
                        setRecorded(null);
                        setPreviewUrl(null);
                        void recorder.start();
                      }}
                    >
                      Record again
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <ol className="grid gap-2 sm:grid-cols-2">
              {PROMPTS.map((prompt, i) => (
                <li key={prompt} className="flex gap-2.5 rounded-lg border border-line px-3.5 py-2.5 text-[14px]">
                  <span className="num flex-none font-semibold text-muted">{i + 1}</span>
                  {prompt}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-muted">English is fine. Only the audio is transcribed; the picture is stored and never analysed.</p>
            {recorder.error ? (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[13px]">
                <CircleAlert size={15} className="mt-0.5 flex-none text-warn" aria-hidden />
                {recorder.error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {recorder.supported ? (
                <Button variant="primary" size="lg" icon={Video} loading={recorder.state === 'starting'} onClick={recorder.start}>
                  Record in the browser
                </Button>
              ) : null}
              <Button size="lg" icon={FileUp} onClick={() => fileInput.current?.click()} loading={progress !== null}>
                Upload a video file
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file, file.name);
                  e.target.value = '';
                }}
              />
            </div>
          </>
        )}
      </div>
    </section>
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
