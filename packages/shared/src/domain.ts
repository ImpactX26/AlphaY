import { z } from 'zod';

/** The four field tags. Every saved fact carries exactly one. */
export const Tag = z.enum(['verified', 'said', 'web', 'ai']);
export type Tag = z.infer<typeof Tag>;

export const TAG_LABEL: Record<Tag, string> = {
  verified: 'Verified',
  said: 'You said',
  web: 'Web-sourced',
  ai: 'AI-generated',
};

export const Route = z.enum(['study', 'ausbildung', 'nursing', 'skilled_job', 'chancenkarte']);
export type Route = z.infer<typeof Route>;

export const ROUTE_LABEL: Record<Route, string> = {
  study: "Study (Bachelor or Master)",
  ausbildung: 'Ausbildung',
  nursing: 'Nursing with Anerkennung',
  skilled_job: 'Skilled job',
  chancenkarte: 'Opportunity Card (Chancenkarte)',
};

/** Where a claim came from. Only `document` can make a fact Verified. */
export const SourceKind = z.enum(['video', 'cv', 'document', 'web', 'agent', 'applicant']);
export type SourceKind = z.infer<typeof SourceKind>;

export const Role = z.enum(['applicant', 'staff', 'employer']);
export type Role = z.infer<typeof Role>;

export const PipelineStage = z.enum(['new_story', 'profiling', 'gap_plan', 'ready', 'matched', 'applied', 'visa', 'arrived']);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const PIPELINE_LABEL: Record<PipelineStage, string> = {
  new_story: 'New story',
  profiling: 'Profiling',
  gap_plan: 'Gap plan',
  ready: 'Ready',
  matched: 'Matched',
  applied: 'Applied',
  visa: 'Visa',
  arrived: 'Arrived',
};

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR)[number];

/** Classified document kinds. Sorting happens on arrival. */
export const DocKind = z.enum([
  'cv',
  'degree_certificate',
  'diploma_certificate',
  'marksheet_10',
  'marksheet_12',
  'transcript',
  'experience_letter',
  'payslip',
  'language_certificate',
  'passport',
  'registration_certificate',
  'aps_certificate',
  'video',
  'other',
]);
export type DocKind = z.infer<typeof DocKind>;

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  cv: 'CV',
  degree_certificate: 'Degree certificate',
  diploma_certificate: 'Diploma certificate',
  marksheet_10: 'Class 10 marksheet',
  marksheet_12: 'Class 12 marksheet',
  transcript: 'Semester transcript',
  experience_letter: 'Experience letter',
  payslip: 'Payslip',
  language_certificate: 'Language certificate',
  passport: 'Passport',
  registration_certificate: 'Nursing council registration',
  aps_certificate: 'APS certificate',
  video: 'Intro video',
  other: 'Other document',
};

export type TruthStatus = 'verified' | 'conflict' | 'no_proof' | 'said';

export interface FactDTO {
  id: string;
  key: string;
  label: string;
  value: string;
  tag: Tag;
  sourceKind: SourceKind;
  sourceRef: string | null;
  sourceUrl: string | null;
  quote: string | null;
  createdAt: string;
}

export interface TruthRow {
  key: string;
  label: string;
  video: string | null;
  cv: string | null;
  document: string | null;
  status: TruthStatus;
  note: string;
  questionId?: string | null;
}

export interface QuestionDTO {
  id: string;
  prompt: string;
  why: string;
  options: string[];
  factKey: string | null;
  status: 'open' | 'answered' | 'dismissed';
  answer: string | null;
  createdAt: string;
}

export interface ApprovalDTO {
  id: string;
  applicantId: string;
  kind: 'email' | 'discord' | 'event' | 'submit' | 'broadcast' | 'employer_profile';
  title: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'sent';
  needsStaff: boolean;
  applicantApprovedAt: string | null;
  staffApprovedAt: string | null;
  createdAt: string;
}

export interface TraceDTO {
  id: string;
  applicantId: string | null;
  runId: string | null;
  kind: 'plan' | 'tool' | 'llm' | 'source' | 'guard' | 'approval' | 'email' | 'event' | 'move';
  name: string;
  detail: Record<string, unknown>;
  costUsd: number;
  createdAt: string;
}

export const AgentEventType = z.enum([
  'upload',
  'chat',
  'answer',
  'email_reply',
  'discord',
  'timer',
  'recheck',
  'shortlist',
  'approval',
  'route_set',
  'visa_granted',
]);
export type AgentEventType = z.infer<typeof AgentEventType>;
