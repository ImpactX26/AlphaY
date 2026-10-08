import { ROUTE_LABEL } from '@educaro/shared';
import clsx from 'clsx';
import { Download, FileText, MessageSquareQuote, Video } from 'lucide-react';
import { useState } from 'react';
import { links } from '../api/client';
import { useApplicant, useFacts, useFiles, useTranscript, useTruthMap } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { formatDuration, hostOf } from '../lib/format';
import { useHashScroll } from '../lib/useHashScroll';
import { TruthTable } from '../screen/blocks/core';
import { Button } from '../ui/Button';
import { EmptyState, ExternalLink, PageHeader, SectionTitle, Skeleton } from '../ui/misc';
import { FieldTag, Tag } from '../ui/Tag';
import { DocumentList, DropZone } from './DocumentDrop';
import { VideoRecorder } from './VideoRecorder';

export default function Profile() {
  const applicantId = useApplicantId();
  const { data: applicant } = useApplicant(applicantId);
  const { data: files, isLoading: filesLoading } = useFiles(applicantId);
  const { data: truth, isLoading: truthLoading } = useTruthMap(applicantId);
  const { data: transcript } = useTranscript(applicantId);
  const { data: facts } = useFacts(applicantId);
  const [showFacts, setShowFacts] = useState(false);
  const video = files?.find((f) => f.kind === 'video');
  const documents = files?.filter((f) => f.kind !== 'video') ?? [];
  const videoUrl = video ? links.file(video.id) : null;
  // #upload and #video arrive from the agent's own block actions, and both sections render only once
  // the file list has loaded.
  useHashScroll([filesLoading]);

  return (
    <div className="max-w-[1120px]">
      <PageHeader
        title="Your profile"
        actions={
          <a href={links.lebenslauf(applicantId, 'pdf')} target="_blank" rel="noopener noreferrer" className="btn btn-secondary no-underline">
            <Download size={17} aria-hidden />
            Lebenslauf (PDF)
          </a>
        }
      >
        Everything the agent knows about you, and where each piece came from. {applicant?.route ? `Route: ${ROUTE_LABEL[applicant.route]}.` : null}
      </PageHeader>

      <section className="mb-8">
        <SectionTitle>What you said, wrote and proved</SectionTitle>
        <div className="card px-4 py-4 sm:px-5">
          {truthLoading ? <Skeleton className="h-36 w-full" /> : <TruthTable rows={truth ?? []} />}
        </div>
      </section>

      <section className="mb-8">
        <SectionTitle
          action={
            <Button size="sm" variant="ghost" onClick={() => setShowFacts((s) => !s)}>
              {showFacts ? 'Hide every field' : `Show every field (${facts?.length ?? 0})`}
            </Button>
          }
        >
          Every field, with its tag
        </SectionTitle>
        {showFacts ? (
          facts?.length ? (
            <div tabIndex={0} className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Value</th>
                    <th scope="col">Tag</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.map((fact) => (
                    <tr key={fact.id}>
                      <th scope="row" className="whitespace-nowrap font-semibold">
                        {fact.label}
                      </th>
                      <td>{fact.value}</td>
                      <td>
                        <FieldTag tag={fact.tag} />
                      </td>
                      <td className="text-[12.5px] text-muted">
                        {fact.sourceUrl ? <ExternalLink href={fact.sourceUrl}>{hostOf(fact.sourceUrl)}</ExternalLink> : <span className="font-mono">{fact.sourceRef ?? fact.sourceKind}</span>}
                        {fact.quote ? <span className="mt-1 block italic">“{fact.quote}”</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No fields yet" icon={FileText}>
              Fields appear as the agent reads your video and documents.
            </EmptyState>
          )
        ) : (
          <p className="text-[13.5px] text-muted">Four tags: Verified (a document proves it), You said (video or CV), Web-sourced (an open page) and AI-generated.</p>
        )}
      </section>

      <section className="mb-8" id="upload">
        <SectionTitle>Your documents</SectionTitle>
        <DropZone applicantId={applicantId} compact />
        {filesLoading ? <Skeleton className="mt-3 h-24 w-full" /> : <DocumentList files={documents} className="mt-3" />}
      </section>

      <section className="mb-8" id="video">
        <SectionTitle>Your story</SectionTitle>
        {video ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg border border-line bg-ink">
              {videoUrl ? (
                <video src={videoUrl} controls playsInline className="aspect-video w-full" aria-label="Your intro video" />
              ) : (
                <div className="grid aspect-video place-items-center text-[13px] text-bg/70">
                  <span className="flex flex-col items-center gap-2">
                    <Video size={22} aria-hidden />
                    {video.kindLabel ?? 'Intro video'}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <MessageSquareQuote size={15} className="text-muted" aria-hidden />
                <span className="font-semibold">Transcript</span>
                {transcript ? <Tag s={{ label: transcript.provider, cls: 't-muted' }} /> : null}
              </p>
              {transcript ? (
                <>
                  <p tabIndex={0} aria-label="Transcript" className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface px-3.5 py-3 text-[14px] leading-relaxed">{transcript.text}</p>
                  {transcript.segments.length ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[13px] font-semibold text-muted">With timestamps</summary>
                      <ul className="mt-2 space-y-1">
                        {transcript.segments.map((seg) => (
                          <li key={seg.start} className="flex gap-2.5 text-[13.5px]">
                            <span className="num flex-none text-muted">{formatDuration(seg.start)}</span>
                            <span>{seg.text}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : (
                <p className={clsx('mt-2 text-[13.5px] text-muted')}>
                  {video.status === 'done' ? 'No transcript yet.' : 'The agent is listening to your video now. The transcript appears here.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <VideoRecorder title="No video yet — record one now" />
        )}
        {video ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-[13px] font-semibold text-muted">Record a new story</summary>
            <div className="mt-3">
              <VideoRecorder title="Record a new story" />
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
