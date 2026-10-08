import type { ApplicantDTO, FactDTO, FileDTO, QuestionDTO, Screen } from '@educaro/shared';
import type { ChatMessageDTO } from '@educaro/shared';
import type { PipelineStage, Route } from '@educaro/shared';

/**
 * DB row -> contract DTO. Kept in one file so a schema change shows up as one diff,
 * and so no controller invents its own shape.
 */

const iso = (d: Date | string | null): string | null => (d ? (d instanceof Date ? d.toISOString() : d) : null);
const isoNow = (d: Date | string | null): string => iso(d) ?? new Date().toISOString();

type ApplicantRow = {
  id: string;
  name: string;
  email: string | null;
  subtitle: string | null;
  homeCity: string | null;
  route: string | null;
  routeAlternatives: string[];
  routeReasons: string[];
  targetCity: string | null;
  stage: string;
  stageReason: string | null;
  mode: 'onboarding' | 'planning' | 'germany';
  staffSecondKey: boolean;
  submittedAt: Date | null;
  approvedByStaffAt: Date | null;
  cohortChannel: string | null;
  createdAt: Date;
};

export function toApplicant(r: ApplicantRow): ApplicantDTO {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    subtitle: r.subtitle,
    homeCity: r.homeCity,
    route: (r.route as Route | null) ?? null,
    routeAlternatives: (r.routeAlternatives ?? []) as Route[],
    routeReasons: r.routeReasons ?? [],
    targetCity: r.targetCity,
    stage: r.stage as PipelineStage,
    stageReason: r.stageReason,
    mode: r.mode,
    staffSecondKey: r.staffSecondKey,
    submittedAt: iso(r.submittedAt),
    approvedByStaffAt: iso(r.approvedByStaffAt),
    cohortChannel: r.cohortChannel,
    createdAt: isoNow(r.createdAt),
  };
}

type FileRow = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  kind: string;
  kindLabel: string | null;
  status: 'queued' | 'reading' | 'done' | 'unclear';
  confidence: number | null;
  createdAt: Date;
};

export const toFile = (r: FileRow): FileDTO => ({
  id: r.id,
  originalName: r.originalName,
  mime: r.mime,
  size: r.size,
  kind: r.kind,
  kindLabel: r.kindLabel,
  status: r.status,
  confidence: r.confidence,
  createdAt: isoNow(r.createdAt),
});

type FactRow = {
  id: string;
  key: string;
  label: string;
  value: string;
  tag: 'verified' | 'said' | 'web' | 'ai';
  sourceKind: 'video' | 'cv' | 'document' | 'web' | 'agent' | 'applicant';
  sourceRef: string | null;
  sourceUrl: string | null;
  quote: string | null;
  createdAt: Date;
};

export const toFact = (r: FactRow): FactDTO => ({
  id: r.id,
  key: r.key,
  label: r.label,
  value: r.value,
  tag: r.tag,
  sourceKind: r.sourceKind,
  sourceRef: r.sourceRef,
  sourceUrl: r.sourceUrl,
  quote: r.quote,
  createdAt: isoNow(r.createdAt),
});

type QuestionRow = {
  id: string;
  prompt: string;
  why: string;
  options: string[];
  factKey: string | null;
  status: 'open' | 'answered' | 'dismissed';
  answer: string | null;
  createdAt: Date;
};

export const toQuestion = (r: QuestionRow): QuestionDTO => ({
  id: r.id,
  prompt: r.prompt,
  why: r.why,
  options: r.options ?? [],
  factKey: r.factKey,
  status: r.status,
  answer: r.answer,
  createdAt: isoNow(r.createdAt),
});

type ChatRow = {
  id: string;
  applicantId: string;
  author: 'applicant' | 'agent' | 'staff' | 'system';
  channel: 'web' | 'email' | 'discord';
  text: string;
  createdAt: Date;
};

export const toChat = (r: ChatRow): ChatMessageDTO => ({
  id: r.id,
  applicantId: r.applicantId,
  author: r.author,
  channel: r.channel,
  text: r.text,
  createdAt: isoNow(r.createdAt),
});

/**
 * The screen the composer stored, or an empty onboarding screen.
 *
 * A brand-new applicant must get `blocks: []` and their own mode rather than a 404,
 * because the web app shows the story-intake view exactly then (docs/requests.md).
 */
export function toScreen(
  applicantId: string,
  row: { version: number; data: Record<string, unknown>; updatedAt: Date } | undefined,
  applicant: { mode: 'onboarding' | 'planning' | 'germany' },
): Screen {
  if (row?.data && Array.isArray((row.data as { blocks?: unknown }).blocks)) {
    const stored = row.data as unknown as Screen;
    return { ...stored, applicantId, version: row.version, updatedAt: isoNow(row.updatedAt) };
  }
  return {
    applicantId,
    version: row?.version ?? 0,
    mode: applicant.mode,
    headline: 'Tell me your story once, and I’ll build your plan for Germany.',
    footnote: 'Nothing is sent anywhere until you tap to approve it.',
    blocks: [],
    composedBy: 'rules',
    updatedAt: isoNow(row?.updatedAt ?? null),
  };
}
