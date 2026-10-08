import type { ChecklistBlock, DocumentsBlock, NextStepBlock, NoteBlock, QuestionBlock, TruthMapBlock } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowUpRight, CircleAlert, CircleCheck, FileText, Info, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { FILE_STATUS, ITEM_STATUS, TRUTH_STATUS } from '../../lib/tags';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { FieldTag, RoleLabel, Tag } from '../../ui/Tag';
import { BlockFrame } from '../BlockFrame';
import { useRunAction, useScreenActions } from '../context';

export function NextStepCard({ block }: { block: NextStepBlock }) {
  const { readOnly, goUpload } = useScreenActions();
  const run = useRunAction();
  return (
    <BlockFrame
      tone="accent"
      kicker={block.title ?? 'Your next step'}
      title={undefined}
      body={undefined}
      footer={
        block.service ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RoleLabel role="staff">Educaro</RoleLabel>
            <a href={block.service.url} target="_blank" rel="noopener noreferrer" className="font-semibold">
              {block.service.name}
            </a>
            {block.service.why ? <span>· {block.service.why}</span> : null}
          </span>
        ) : null
      }
    >
      {block.body ? <p className="display text-[17.5px] font-bold leading-snug">{block.body}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {block.actions.map((action) =>
          action.kind === 'link' || action.kind === 'service' ? (
            action.value?.startsWith('/') ? (
              <Link key={action.label} to={action.value} className="qr no-underline">
                {action.label}
              </Link>
            ) : (
              <a key={action.label} href={action.value} target="_blank" rel="noopener noreferrer" className="qr no-underline">
                {action.label}
                <ArrowUpRight size={14} aria-hidden />
              </a>
            )
          ) : (
            <button key={action.label} type="button" className="qr" disabled={readOnly} onClick={() => (action.kind === 'upload' ? goUpload() : run(action))}>
              {action.kind === 'upload' ? <Upload size={14} aria-hidden /> : null}
              {action.label}
            </button>
          ),
        )}
        {block.tags.map((t) => (
          <FieldTag key={t} tag={t} />
        ))}
      </div>
    </BlockFrame>
  );
}

export function QuestionCard({ block }: { block: QuestionBlock }) {
  const { answerQuestion, answeringQuestionId, readOnly, sendChat } = useScreenActions();
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const busy = answeringQuestionId === block.questionId;
  const freeText = block.options.some((o) => /explain|something else|other/i.test(o));
  // A question is waiting on the applicant, so it stays framed: it is a thing to act on.
  return (
    <BlockFrame tone="accent" kicker={block.title ?? 'One question'}>
      <p className="text-[15.5px] font-semibold leading-snug">{block.prompt}</p>
      <p className="mt-1.5 text-[13.5px] text-muted">{block.why}</p>
      {typing ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const text = typed.trim();
            if (!text) return;
            sendChat(`About "${block.prompt}": ${text}`);
            answerQuestion(block.questionId, text);
            setTyped('');
            setTyping(false);
          }}
        >
          <input
            className="input"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Tell the agent in your own words"
            aria-label={`Your answer to: ${block.prompt}`}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={busy} disabled={!typed.trim()}>
              Send
            </Button>
            <Button variant="ghost" onClick={() => setTyping(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {block.options.map((option) => (
            <button
              key={option}
              type="button"
              className="qr"
              disabled={readOnly || busy}
              onClick={() => (/explain|something else|other/i.test(option) ? setTyping(true) : answerQuestion(block.questionId, option))}
            >
              {option}
            </button>
          ))}
          {!freeText ? (
            <button type="button" className="text-[13px] font-semibold text-muted underline-offset-2 hover:underline" disabled={readOnly || busy} onClick={() => setTyping(true)}>
              Type instead
            </button>
          ) : null}
          {busy ? <Spinner size={15} className="text-agent" label="Sending your answer" /> : null}
        </div>
      )}
    </BlockFrame>
  );
}

export function ChecklistCard({ block }: { block: ChecklistBlock }) {
  return (
    <BlockFrame kicker={block.title ?? 'Checklist'} body={block.body}>
      <ul className="divide-y divide-line">
        {block.items.map((item) => {
          const s = ITEM_STATUS[item.status];
          return (
            <li key={item.label} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <span className="text-[14px]">{item.label}</span>
                {item.note ? <span className="block text-[12.5px] text-muted">{item.note}</span> : null}
              </span>
              <Tag s={s} className="mt-px flex-none" />
            </li>
          );
        })}
      </ul>
    </BlockFrame>
  );
}

export function DocumentsCard({ block }: { block: DocumentsBlock }) {
  const { goUpload, readOnly } = useScreenActions();
  const reading = block.items.filter((i) => i.status === 'reading' || i.status === 'queued').length;
  const unclear = block.items.filter((i) => i.status === 'unclear');
  return (
    <BlockFrame
      kicker={block.title ?? 'Your documents'}
      body={block.body}
      headerExtra={
        reading ? (
          <span className="flex flex-none items-center gap-2 text-[12.5px] font-medium text-agent">
            <Spinner size={14} />
            Reading {reading} of {block.items.length}
          </span>
        ) : (
          <span className="flex-none text-[12.5px] text-muted">
            {block.items.length} {block.items.length === 1 ? 'file' : 'files'}
          </span>
        )
      }
      footer={
        !readOnly ? (
          <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-ink" onClick={goUpload}>
            <Upload size={14} aria-hidden />
            Add more files
          </button>
        ) : null
      }
    >
      <ul className="divide-y divide-line">
        {block.items.map((item) => {
          const s = FILE_STATUS[item.status];
          return (
            <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0">
              {item.status === 'reading' || item.status === 'queued' ? (
                <Spinner size={16} className="flex-none text-agent" />
              ) : item.status === 'unclear' ? (
                <CircleAlert size={16} className="flex-none text-warn" aria-hidden />
              ) : (
                <CircleCheck size={16} className="flex-none text-ok" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{item.kind}</span>
                <span className="block truncate font-mono text-[11.5px] text-muted">{item.name}</span>
              </span>
              <Tag s={s} className="flex-none" />
            </li>
          );
        })}
      </ul>
      {unclear.length ? (
        <p className="mt-3 rounded-md border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[13px]">
          {unclear.length === 1 ? 'One photo is' : `${unclear.length} photos are`} hard to read. Retake in daylight, flat on a table, all four corners in the frame. The agent will not guess
          what it says.
        </p>
      ) : null}
    </BlockFrame>
  );
}

export function NoteCard({ block }: { block: NoteBlock }) {
  const Icon = block.tone === 'warn' ? CircleAlert : block.tone === 'success' ? CircleCheck : Info;
  return (
    <BlockFrame tone={block.tone === 'warn' ? 'warn' : block.tone === 'success' ? 'success' : 'quiet'}>
      <div className="flex gap-3">
        <Icon size={18} className={clsx('mt-0.5 flex-none', block.tone === 'warn' ? 'text-warn' : block.tone === 'success' ? 'text-ok' : 'text-muted')} aria-hidden />
        <div className="min-w-0">
          {block.title ? <p className="display text-[15.5px] font-bold leading-snug">{block.title}</p> : null}
          {block.body ? <p className="mt-1 text-[14px] leading-relaxed">{block.body}</p> : null}
        </div>
      </div>
    </BlockFrame>
  );
}

/** The truth map: what they said, wrote and proved, side by side. */
export function TruthMapCard({ block, bare }: { block: TruthMapBlock; bare?: boolean }) {
  const conflicts = block.rows.filter((r) => r.status === 'conflict').length;
  return (
    <BlockFrame bare={bare}
      kicker={block.title ?? 'What you said, wrote and proved'}
      body={block.body}
      headerExtra={
        conflicts ? (
          <Tag s={TRUTH_STATUS.conflict} className="flex-none">
            {conflicts} {conflicts === 1 ? 'conflict' : 'conflicts'}
          </Tag>
        ) : block.rows.length ? (
          <Tag s={TRUTH_STATUS.verified} className="flex-none">
            Everything lines up
          </Tag>
        ) : null
      }
      footer={<span>Only a document can make a fact Verified.</span>}
    >
      <TruthTable rows={block.rows} />
    </BlockFrame>
  );
}

export function TruthTable({ rows }: { rows: TruthMapBlock['rows'] }) {
  if (!rows.length)
    return (
      <p className="flex items-center gap-2 py-3 text-[13.5px] text-muted">
        <FileText size={15} aria-hidden /> Nothing read yet. Rows appear here as each file is read.
      </p>
    );
  return (
    <>
      {/* Phone: one card per fact. Desktop: the spec's table. */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="rounded-lg border border-line px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-semibold">{row.label}</p>
              <Tag s={TRUTH_STATUS[row.status]} className="flex-none" />
            </div>
            <dl className="mt-2 space-y-1 text-[13px]">
              {(
                [
                  ['Video says', row.video],
                  ['CV says', row.cv],
                  ['Document says', row.document],
                ] as const
              ).map(([label, value]) =>
                value ? (
                  <div key={label} className="flex gap-2">
                    <dt className="w-[92px] flex-none text-muted">{label}</dt>
                    <dd className="min-w-0">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {row.note ? <p className="mt-1.5 text-[13px] text-muted">{row.note}</p> : null}
          </li>
        ))}
      </ul>
      <div tabIndex={0} className="tbl-wrap hidden md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Fact</th>
              <th scope="col">Video says</th>
              <th scope="col">CV says</th>
              <th scope="col">Document says</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={clsx(row.status === 'conflict' && 'bg-[color-mix(in_srgb,var(--bad)_5%,transparent)]')}>
                <th scope="row" className="font-semibold">
                  {row.label}
                </th>
                <td className="text-muted">{row.video ?? '—'}</td>
                <td className="text-muted">{row.cv ?? '—'}</td>
                <td>{row.document ?? '—'}</td>
                <td>
                  <Tag s={TRUTH_STATUS[row.status]} />
                  {row.note ? <span className="mt-1 block text-[12.5px] text-muted">{row.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
