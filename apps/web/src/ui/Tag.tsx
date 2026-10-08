import type { Tag as FieldTagType } from '@educaro/shared';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { FIELD_TAG, type TagStyle } from '../lib/tags';

export function Tag({ s, children, className, title }: { s: TagStyle; children?: ReactNode; className?: string; title?: string }) {
  return (
    <span className={clsx('tag', s.cls, className)} title={title}>
      {children ?? s.label}
    </span>
  );
}

/** The four field tags from the spec: Verified, You said, Web-sourced, AI-generated. */
export function FieldTag({ tag, className }: { tag: FieldTagType; className?: string }) {
  return <Tag s={FIELD_TAG[tag]} className={className} />;
}

export type ChipTone = 'applicant' | 'agent' | 'outside' | 'staff' | 'loop' | 'ok' | 'warn' | 'bad';

export function Chip({ tone, children, className }: { tone?: ChipTone; children: ReactNode; className?: string }) {
  return <span className={clsx('chip', tone && ['tone', `c-${tone}`], className)}>{children}</span>;
}

export type RoleKind = 'applicant' | 'agent' | 'rules' | 'staff' | 'outside';

/** Who did this: the spec's role label with its coloured square. */
export function RoleLabel({ role, children, className }: { role: RoleKind; children: ReactNode; className?: string }) {
  return <span className={clsx('role', `r-${role}`, className)}>{children}</span>;
}
