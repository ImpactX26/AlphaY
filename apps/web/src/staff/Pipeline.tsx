import { PIPELINE_LABEL, PipelineStage, ROUTE_LABEL, type PipelineCardDTO } from '@educaro/shared';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CircleAlert, FileWarning, GripVertical, MessageCircleQuestion, Stamp } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import { api, errorText } from '../api/client';
import { qk, usePipeline } from '../api/queries';
import { relativeTime } from '../lib/format';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Avatar, PageHeader, Skeleton } from '../ui/misc';
import { toast } from '../ui/Toast';

const STAGES = PipelineStage.options;

function Signal({ icon: Icon, count, label, tone }: { icon: typeof CircleAlert; count: number; label: string; tone: string }) {
  if (!count) return null;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[12px] font-semibold', tone)} title={`${count} ${label}`}>
      <Icon size={13} aria-hidden />
      {count}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Card({ card, dragging, onDragStart }: { card: PipelineCardDTO; dragging: boolean; onDragStart: () => void }) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.applicantId);
        onDragStart();
      }}
      className={clsx('card group px-3 py-2.5 transition-opacity', dragging && 'opacity-40')}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={card.name} size={28} tone={card.route === 'study' ? 'agent' : 'applicant'} />
        <div className="min-w-0 flex-1">
          <Link to={`/staff/applicants/${card.applicantId}`} className="block truncate text-[14px] font-semibold text-ink no-underline hover:underline">
            {card.name}
          </Link>
          <p className="truncate text-[12px] text-muted">{card.subtitle ?? (card.route ? ROUTE_LABEL[card.route] : 'Route not set')}</p>
        </div>
        <GripVertical size={14} className="mt-1 flex-none cursor-grab text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="bar h-1.5 flex-1" role="meter" aria-label={`Readiness ${card.readiness}%`} aria-valuenow={card.readiness} aria-valuemin={0} aria-valuemax={100}>
          <i className={clsx(card.readiness < 50 && 'lo', card.readiness >= 100 && 'ok')} style={{ '--v': `${card.readiness}%` } as CSSProperties} />
        </span>
        <span className="num flex-none text-[11.5px] text-muted">{card.readiness}%</span>
      </div>

      {card.stageReason ? <p className="mt-2 line-clamp-2 text-[12px] italic leading-snug text-muted">“{card.stageReason}”</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Signal icon={CircleAlert} count={card.conflicts} label="conflicts" tone="text-bad" />
        <Signal icon={FileWarning} count={card.openGaps} label="open gaps" tone="text-warn" />
        <Signal icon={MessageCircleQuestion} count={card.openQuestions} label="open questions" tone="text-agent" />
        <Signal icon={Stamp} count={card.pendingApprovals} label="pending approvals" tone="text-staff" />
        <span className="ml-auto text-[11px] text-muted">{relativeTime(card.updatedAt)}</span>
      </div>
    </li>
  );
}

export default function Pipeline() {
  const { data: cards, isLoading } = usePipeline();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [move, setMove] = useState<{ card: PipelineCardDTO; stage: PipelineStage } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const byStage = (stage: string) => (cards ?? []).filter((c) => c.stage === stage);

  const commit = async () => {
    if (!move || !reason.trim()) return;
    setBusy(true);
    try {
      await api.setStage(move.card.applicantId, move.stage, reason.trim());
      void qc.invalidateQueries({ queryKey: qk.pipeline });
      setMove(null);
      setReason('');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Pipeline">
        The agent moves each applicant between columns and writes why. Drag a card to move it yourself; you will be asked for a reason, and it goes into the trace.
      </PageHeader>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {STAGES.slice(0, 5).map((s) => (
            <Skeleton key={s} className="h-64 w-[248px] flex-none" />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {STAGES.map((stage) => {
            const list = byStage(stage);
            return (
              <section
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  setDragId(null);
                  const card = cards?.find((c) => c.applicantId === id);
                  if (card && card.stage !== stage) setMove({ card, stage });
                }}
                className={clsx(
                  'flex w-[252px] flex-none flex-col rounded-xl border p-2 transition-colors',
                  overStage === stage ? 'border-agent bg-agent/5' : 'border-line bg-surface-2/70',
                )}
              >
                <h2 className="flex items-baseline justify-between gap-2 px-1.5 py-1.5">
                  <span className="display text-[13.5px] font-bold">{PIPELINE_LABEL[stage]}</span>
                  <span className="num text-[12px] text-muted">{list.length}</span>
                </h2>
                <ul className="flex flex-1 flex-col gap-2">
                  {list.map((card) => (
                    <Card key={card.applicantId} card={card} dragging={dragId === card.applicantId} onDragStart={() => setDragId(card.applicantId)} />
                  ))}
                  {!list.length ? <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-muted">Empty</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Dialog
        open={move !== null}
        onClose={() => {
          setMove(null);
          setReason('');
        }}
        title={move ? `Move ${move.card.name} to ${PIPELINE_LABEL[move.stage]}?` : ''}
        description="Your reason is shown on the card and saved in the trace, next to the agent's own reasons."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setMove(null);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={!reason.trim()} onClick={commit}>
              Move the card
            </Button>
          </>
        }
      >
        <div className="px-5 py-4">
          {move?.card.stageReason ? (
            <p className="mb-3 rounded-md border border-line bg-surface-2/60 px-3 py-2 text-[13px]">
              <span className="font-semibold">The agent said:</span> “{move.card.stageReason}”
            </p>
          ) : null}
          <label className="block">
            <span className="label">Why are you moving it?</span>
            <textarea
              className="input min-h-20"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Spoke to her on the phone; the B1 certificate is on its way."
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
