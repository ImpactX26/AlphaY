import type { FileDTO } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CircleAlert, CircleCheck, FileText, Image as ImageIcon, Paperclip, Upload, ShieldCheck } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { api, errorText, links } from '../api/client';
import { qk } from '../api/queries';
import { formatBytes, relativeTime } from '../lib/format';
import { FILE_STATUS } from '../lib/tags';
import { Spinner } from '../ui/Spinner';
import { Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

/** Drag, tap or paste. Many files, any order, phone photos fine. */
export function DropZone({ applicantId, compact }: { applicantId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const id = useId();

  const send = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setProgress(0);
    try {
      const added = await api.uploadFiles(applicantId, files, setProgress);
      toast(`${added.length} ${added.length === 1 ? 'file' : 'files'} uploaded. The agent is reading ${added.length === 1 ? 'it' : 'them'}.`);
      void qc.invalidateQueries({ queryKey: qk.files(applicantId) });
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void send(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.heic"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void send(e.target.files);
          e.target.value = '';
        }}
      />
      <label
        htmlFor={id}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 text-center transition-colors',
          compact ? 'py-5' : 'py-8',
          over ? 'border-agent bg-agent/5' : 'border-line hover:border-muted',
        )}
      >
        {progress !== null ? (
          <>
            <Spinner size={22} className="text-agent" />
            <span className="text-[14px] font-semibold">Uploading {Math.round(progress * 100)}%</span>
          </>
        ) : (
          <>
            <Upload size={compact ? 20 : 24} className="text-muted" aria-hidden />
            <span className="text-[14.5px] font-semibold">
              Drop your files here, or <span className="text-agent underline underline-offset-2">choose files</span>
            </span>
            <span className="text-[13px] text-muted">PDF, Word or photos. Several at once is fine.</span>
          </>
        )}
      </label>
    </div>
  );
}

function FileIcon({ file }: { file: FileDTO }) {
  if (file.status === 'reading' || file.status === 'queued') return <Spinner size={17} className="flex-none text-agent" />;
  if (file.status === 'unclear') return <CircleAlert size={17} className="flex-none text-warn" aria-hidden />;
  if (file.mime.startsWith('image/')) return <ImageIcon size={17} className="flex-none text-muted" aria-hidden />;
  return <FileText size={17} className="flex-none text-muted" aria-hidden />;
}

/** Live status per file: queued, reading, done or unclear, with its classified kind. */
export function DocumentList({ files, className, showOpen = true }: { files: FileDTO[]; className?: string; showOpen?: boolean }) {
  if (!files.length) return null;
  return (
    <ul className={clsx('divide-y divide-line overflow-hidden rounded-lg border border-line', className)}>
      {files.map((file) => {
        const href = showOpen ? links.file(file.id) : null;
        const low = file.confidence !== null && file.confidence < 0.5;
        return (
          <li key={file.id} className="px-3.5 py-2.5">
          <span className="flex items-center gap-3">
            <FileIcon file={file} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">
                {file.kindLabel ?? (file.status === 'done' ? 'Other document' : 'Sorting…')}
                {low ? <span className="num ml-1.5 text-[12px] font-normal text-warn">confidence {Math.round((file.confidence ?? 0) * 100)}%</span> : null}
              </span>
              <span className="block truncate text-[12px] text-muted">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono underline-offset-2 hover:underline">
                    {file.originalName}
                  </a>
                ) : (
                  <span className="font-mono">{file.originalName}</span>
                )}
                <span className="mx-1.5">·</span>
                {formatBytes(file.size)}
                <span className="mx-1.5">·</span>
                {relativeTime(file.createdAt)}
              </span>
            </span>
            {file.status === 'done' ? (
              <CircleCheck size={16} className="flex-none text-ok" aria-label={FILE_STATUS.done.label} />
            ) : (
              <Tag s={FILE_STATUS[file.status]} className="flex-none" />
            )}
          </span>
          <DocumentVerdict check={file.check} />
          </li>
        );
      })}
    </ul>
  );
}

export function FileCount({ files }: { files: FileDTO[] }) {
  const reading = files.filter((f) => f.status === 'reading' || f.status === 'queued').length;
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
      <Paperclip size={13} aria-hidden />
      {files.length} {files.length === 1 ? 'file' : 'files'}
      {reading ? <span className="text-agent">· reading {reading}</span> : null}
    </span>
  );
}

/**
 * What this document was checked against, and whether it passed.
 *
 * The answer to "verified against what?" belongs on the document itself, not in an admin panel the
 * applicant will never see. An accepted document says so in one quiet line; a rejected one has to
 * carry every reason, because "not accepted" with no reasons is exactly what a consulate already
 * does to these applicants and the only thing we can add is the why.
 */
export function DocumentVerdict({ check }: { check: FileDTO['check'] }) {
  if (!check) return null;
  const failed = check.checks.filter((c) => !c.passed);

  if (check.verdict === 'accepted') {
    return (
      <p className="mt-1.5 flex items-start gap-1.5 pl-[34px] text-[12.5px] text-muted">
        <ShieldCheck size={13} className="mt-[2px] flex-none text-ok" aria-hidden />
        <span>
          Meets the {check.standard.toLowerCase()} standard — checked against {check.authority}.
        </span>
      </p>
    );
  }

  return (
    <div
      className={clsx(
        'mt-2 ml-[34px] rounded-md border px-3 py-2',
        check.verdict === 'not_accepted' ? 'border-bad/40 bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]' : 'border-warn/40 bg-[color-mix(in_srgb,var(--warn)_7%,transparent)]',
      )}
    >
      <p className="text-[13px] font-semibold">
        {check.verdict === 'not_accepted' ? 'This will not be accepted as it stands' : 'Accepted, with something worth fixing'}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {failed.map((c, i) => (
          <li key={i} className="text-[12.5px]">
            <span className="font-medium">{c.found}</span>
            <span className="text-muted"> — expected {c.expected}. </span>
            <span className="text-muted">{c.because}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] text-muted">
        Checked against {check.authority}. If you think the rule is wrong, say so and a consultant will look.
      </p>
    </div>
  );
}
