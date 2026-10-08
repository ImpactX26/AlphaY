import type { ItemStatus, MatrixStatus, ReadinessDTO, Tag, TruthStatus } from '@educaro/shared';

/** One place for every status → label + tag style. Labels follow the spec; "rejected" never appears. */

export interface TagStyle {
  label: string;
  cls: string;
}

export const FIELD_TAG: Record<Tag, TagStyle> = {
  verified: { label: 'Verified', cls: 't-ver' },
  said: { label: 'You said', cls: 't-said' },
  web: { label: 'Web-sourced', cls: 't-web' },
  ai: { label: 'AI-generated', cls: 't-ai' },
};

export const ITEM_STATUS: Record<ItemStatus, TagStyle> = {
  verified: { label: 'Verified', cls: 't-ver' },
  missing: { label: 'Missing', cls: 't-warn' },
  planned: { label: 'Planned', cls: 't-ai' },
  pending: { label: 'Pending', cls: 't-warn' },
  said: { label: 'You said', cls: 't-said' },
  ready: { label: 'Ready', cls: 't-ver' },
  gaps: { label: 'Gaps', cls: 't-warn' },
  checking: { label: 'Checking', cls: 't-web' },
};

export const MATRIX_STATUS: Record<MatrixStatus, TagStyle> = {
  meets: { label: 'Meets', cls: 't-ver' },
  missing: { label: 'Missing', cls: 't-bad' },
  pending: { label: 'Proof pending', cls: 't-warn' },
  start_now: { label: 'Start now', cls: 't-bad' },
  info: { label: 'For your plan', cls: 't-web' },
  not_needed: { label: 'Not needed', cls: 't-muted' },
};

export const TRUTH_STATUS: Record<TruthStatus, TagStyle> = {
  verified: { label: 'Verified', cls: 't-ver' },
  conflict: { label: 'Conflict', cls: 't-bad' },
  no_proof: { label: 'No proof yet', cls: 't-warn' },
  said: { label: 'You said', cls: 't-said' },
};

export const EXAM_STATUS: Record<'done' | 'pending' | 'not_started' | 'not_needed', TagStyle> = {
  done: { label: 'done', cls: 't-ver' },
  pending: { label: 'proof pending', cls: 't-warn' },
  not_started: { label: 'not started', cls: 't-bad' },
  not_needed: { label: 'not needed', cls: 't-ver' },
};

export const OUTCOME: Record<ReadinessDTO['outcome'], TagStyle> = {
  ready: { label: 'Ready', cls: 't-ver' },
  ready_after_plan: { label: 'Ready after the plan', cls: 't-warn' },
  better_route: { label: 'Better route found', cls: 't-web' },
};

export const FILE_STATUS: Record<'queued' | 'reading' | 'done' | 'unclear', TagStyle> = {
  queued: { label: 'Queued', cls: 't-muted' },
  reading: { label: 'Reading', cls: 't-web' },
  done: { label: 'Read', cls: 't-ver' },
  unclear: { label: 'Unclear', cls: 't-warn' },
};

export const APPROVAL_STATUS: Record<'pending' | 'approved' | 'rejected' | 'sent', TagStyle> = {
  pending: { label: 'Waiting for you', cls: 't-warn' },
  approved: { label: 'Approved, waiting for staff', cls: 't-web' },
  rejected: { label: 'Not sent', cls: 't-muted' },
  sent: { label: 'Sent', cls: 't-ver' },
};

export function approvalStatus(status: string): TagStyle {
  return status in APPROVAL_STATUS ? APPROVAL_STATUS[status as keyof typeof APPROVAL_STATUS] : { label: status, cls: 't-muted' };
}
