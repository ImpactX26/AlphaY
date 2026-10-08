import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  real,
  vector,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'applicant' | 'staff' | 'employer'>().notNull(),
  name: text('name').notNull(),
  discordUserId: text('discord_user_id'),
  createdAt: createdAt(),
});

export const applicants = pgTable('applicants', {
  id: id(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  email: text('email'),
  subtitle: text('subtitle'),
  homeCity: text('home_city'),
  route: text('route'),
  routeAlternatives: jsonb('route_alternatives').$type<string[]>().notNull().default([]),
  routeReasons: jsonb('route_reasons').$type<string[]>().notNull().default([]),
  targetCity: text('target_city'),
  stage: text('stage').notNull().default('new_story'),
  stageReason: text('stage_reason'),
  mode: text('mode').$type<'onboarding' | 'planning' | 'germany'>().notNull().default('onboarding'),
  staffSecondKey: boolean('staff_second_key').notNull().default(false),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedByStaffAt: timestamp('approved_by_staff_at', { withTimezone: true }),
  germanyAddress: text('germany_address'),
  startDate: text('start_date'),
  cohortChannel: text('cohort_channel'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const files = pgTable(
  'files',
  {
    id: id(),
    applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
    originalName: text('original_name').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    storagePath: text('storage_path').notNull(),
    kind: text('kind').notNull().default('other'),
    kindLabel: text('kind_label'),
    status: text('status').$type<'queued' | 'reading' | 'done' | 'unclear'>().notNull().default('queued'),
    confidence: real('confidence'),
    text: text('text'),
    extracted: jsonb('extracted').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('files_applicant_idx').on(t.applicantId)],
);

export const facts = pgTable(
  'facts',
  {
    id: id(),
    applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    value: text('value').notNull(),
    tag: text('tag').$type<'verified' | 'said' | 'web' | 'ai'>().notNull(),
    sourceKind: text('source_kind').$type<'video' | 'cv' | 'document' | 'web' | 'agent' | 'applicant'>().notNull(),
    sourceRef: text('source_ref'),
    sourceUrl: text('source_url'),
    quote: text('quote'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('facts_applicant_key_idx').on(t.applicantId, t.key)],
);

export const questions = pgTable('questions', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  why: text('why').notNull(),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  factKey: text('fact_key'),
  /** Candidate id (e.g. "conflict:experience.aster") so the same question is never asked twice, plus option actions. */
  meta: jsonb('meta').$type<{ candidateId?: string; actions?: Record<string, string> }>().notNull().default({}),
  status: text('status').$type<'open' | 'answered' | 'dismissed'>().notNull().default('open'),
  answer: text('answer'),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const chatMessages = pgTable('chat_messages', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  author: text('author').$type<'applicant' | 'agent' | 'staff' | 'system'>().notNull(),
  channel: text('channel').$type<'web' | 'email' | 'discord'>().notNull().default('web'),
  text: text('text').notNull(),
  createdAt: createdAt(),
});

/** Catalogue of programmes the scout has found (seeded with real ones, grows as the scout searches). */
export const programmes = pgTable('programmes', {
  id: id(),
  title: text('title').notNull(),
  university: text('university').notNull(),
  city: text('city').notNull(),
  url: text('url').notNull().unique(),
  degree: text('degree').notNull(),
  language: text('language').notNull(),
  field: text('field').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

/** Openings posted by Educaro staff for employer clients. */
export const openings = pgTable('openings', {
  id: id(),
  employer: text('employer').notNull(),
  employerEmail: text('employer_email').notNull(),
  title: text('title').notNull(),
  city: text('city').notNull(),
  route: text('route').notNull(),
  germanLevel: text('german_level').notNull(),
  startDate: text('start_date').notNull(),
  needsRecognition: boolean('needs_recognition').notNull().default(false),
  description: text('description').notNull(),
  keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('open'),
  createdAt: createdAt(),
});

export const shortlist = pgTable('shortlist', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'programme' | 'opening'>().notNull(),
  refId: uuid('ref_id'),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull(),
  url: text('url').notNull(),
  status: text('status').$type<'checking' | 'ready' | 'gaps'>().notNull().default('checking'),
  requirements: jsonb('requirements').$type<Record<string, unknown>>(),
  matrix: jsonb('matrix').$type<Record<string, unknown>>(),
  gapCount: integer('gap_count').notNull().default(0),
  createdAt: createdAt(),
});

export const gaps = pgTable('gaps', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  title: text('title').notNull(),
  what: text('what').notNull(),
  where: text('where').notNull(),
  howLong: text('how_long').notNull(),
  cost: text('cost').notNull(),
  links: jsonb('links').$type<{ label: string; url: string }[]>().notNull().default([]),
  serviceId: text('service_id'),
  shortlistId: uuid('shortlist_id'),
  priority: integer('priority').notNull().default(50),
  status: text('status').$type<'open' | 'planned' | 'done'>().notNull().default('open'),
  seenAt: timestamp('seen_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('gaps_applicant_key_idx').on(t.applicantId, t.key)]);

export const approvals = pgTable('approvals', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'email' | 'discord' | 'event' | 'submit' | 'broadcast' | 'employer_profile'>().notNull(),
  title: text('title').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').$type<'pending' | 'approved' | 'rejected' | 'sent'>().notNull().default('pending'),
  needsApplicant: boolean('needs_applicant').notNull().default(true),
  needsStaff: boolean('needs_staff').notNull().default(false),
  applicantApprovedAt: timestamp('applicant_approved_at', { withTimezone: true }),
  staffApprovedAt: timestamp('staff_approved_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const emails = pgTable('emails', {
  id: id(),
  applicantId: uuid('applicant_id').references(() => applicants.id, { onDelete: 'cascade' }),
  approvalId: uuid('approval_id'),
  direction: text('direction').$type<'out' | 'in'>().notNull(),
  messageId: text('message_id').notNull().unique(),
  inReplyTo: text('in_reply_to'),
  threadKey: text('thread_key').notNull(),
  fromAddr: text('from_addr').notNull(),
  toAddr: text('to_addr').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  kind: text('kind'),
  originalTo: text('original_to'),
  safeRedirected: boolean('safe_redirected').notNull().default(false),
  classified: jsonb('classified').$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

export const calendarEvents = pgTable('calendar_events', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  kind: text('kind').$type<'deadline' | 'exam' | 'task' | 'event' | 'interview'>().notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').notNull().default(60),
  location: text('location'),
  description: text('description'),
  sent: boolean('sent').notNull().default(false),
  createdAt: createdAt(),
});

export const screens = pgTable('screens', {
  applicantId: uuid('applicant_id').primaryKey().references(() => applicants.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(0),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Latest output of each specialist per applicant. The composer reads from here. */
export const specialistOutputs = pgTable(
  'specialist_outputs',
  {
    id: id(),
    applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
    specialist: text('specialist').notNull(),
    runId: text('run_id'),
    output: jsonb('output').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('spec_out_applicant_spec_idx').on(t.applicantId, t.specialist)],
);

/** Every page the agent really opened. The source guard checks web facts against this log. */
export const sources = pgTable(
  'sources',
  {
    id: id(),
    runId: text('run_id').notNull(),
    applicantId: uuid('applicant_id'),
    url: text('url').notNull(),
    title: text('title'),
    text: text('text').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sources_run_url_idx').on(t.runId, t.url)],
);

/** Shared page cache so the same official page is not fetched twice within a day. */
export const pageCache = pgTable('page_cache', {
  url: text('url').primaryKey(),
  title: text('title'),
  text: text('text').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

export const traces = pgTable(
  'traces',
  {
    id: id(),
    applicantId: uuid('applicant_id'),
    runId: text('run_id'),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    costUsd: real('cost_usd').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('traces_applicant_idx').on(t.applicantId, t.createdAt)],
);

/** Every LLM response keyed by a hash of model + prompt. Replays cost nothing. */
export const llmCache = pgTable('llm_cache', {
  key: text('key').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  task: text('task').notNull(),
  response: jsonb('response').$type<unknown>().notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costUsd: real('cost_usd').notNull().default(0),
  createdAt: createdAt(),
});

export const docChunks = pgTable(
  'doc_chunks',
  {
    id: id(),
    applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id'),
    text: text('text').notNull(),
    embedding: vector('embedding', { dimensions: 384 }),
    createdAt: createdAt(),
  },
  (t) => [index('doc_chunks_applicant_idx').on(t.applicantId)],
);

export const matches = pgTable('matches', {
  id: id(),
  openingId: uuid('opening_id').notNull().references(() => openings.id, { onDelete: 'cascade' }),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  score: real('score').notNull(),
  reasons: jsonb('reasons').$type<string[]>().notNull().default([]),
  germanProfile: jsonb('german_profile').$type<Record<string, unknown>>(),
  consent: boolean('consent').notNull().default(false),
  status: text('status').$type<'ranked' | 'profile_ready' | 'sent' | 'interview'>().notNull().default('ranked'),
  createdAt: createdAt(),
});

export const broadcasts = pgTable('broadcasts', {
  id: id(),
  topic: text('topic').notNull(),
  status: text('status').$type<'draft' | 'approved' | 'sent'>().notNull().default('draft'),
  messages: jsonb('messages').$type<{ applicantId: string; name: string; text: string }[]>().notNull().default([]),
  createdAt: createdAt(),
});

export const interviewSessions = pgTable('interview_sessions', {
  id: id(),
  applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'visa' | 'employer' | 'university'>().notNull(),
  turns: jsonb('turns').$type<{ role: 'coach' | 'applicant'; text: string; score?: number; feedback?: string }[]>().notNull().default([]),
  status: text('status').$type<'active' | 'done'>().notNull().default('active'),
  createdAt: createdAt(),
});

/**
 * The cohort thread. One row per post, replies point at their parent.
 *
 * The same thread lives in Discord: a post made in the app is mirrored there, and a message typed
 * in the channel comes back here. `discordMessageId` is what keeps the two from echoing each other
 * — a post we already know about is never re-posted when it arrives from the other side.
 */
export const communityPosts = pgTable(
  'community_posts',
  {
    id: id(),
    channel: text('channel').notNull().default('educaro-cohort'),
    parentId: uuid('parent_id'),
    applicantId: uuid('applicant_id').references(() => applicants.id, { onDelete: 'set null' }),
    author: text('author').notNull(),
    authorKind: text('author_kind').$type<'applicant' | 'agent' | 'staff'>().notNull().default('applicant'),
    text: text('text').notNull(),
    discordMessageId: text('discord_message_id').unique(),
    viaDiscord: boolean('via_discord').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('community_channel_idx').on(t.channel, t.createdAt)],
);

/**
 * A private report about an employer, and the rating it feeds.
 *
 * Someone being treated badly in a country where they do not yet have the language, on a permit
 * they believe is tied to the employer, will not complain publicly and often will not complain at
 * all. A private channel is the only one they will use — and it is also the only way Educaro hears
 * about a placement going wrong before it is lost.
 *
 * `visibility` is the promise: 'private' never leaves Educaro, and only the aggregate moves the
 * employer's rating. The applicant is never shown to the employer.
 */
export const employerReports = pgTable('employer_reports', {
  id: id(),
  applicantId: uuid('applicant_id').references(() => applicants.id, { onDelete: 'set null' }),
  employer: text('employer').notNull(),
  openingId: uuid('opening_id'),
  category: text('category').$type<'pay' | 'hours' | 'housing' | 'documents' | 'respect' | 'safety' | 'other'>().notNull().default('other'),
  severity: text('severity').$type<'note' | 'concern' | 'serious'>().notNull().default('concern'),
  text: text('text').notNull(),
  visibility: text('visibility').$type<'private' | 'anonymised'>().notNull().default('private'),
  status: text('status').$type<'new' | 'acknowledged' | 'resolved'>().notNull().default('new'),
  createdAt: createdAt(),
});

/**
 * Flat-shares and travel groups: an actual group, not a suggestion.
 *
 * The screen used to compute a sentence — "a flat for 3 in Ehrenfeld works out around EUR 490 each"
 * — which is a good sentence and does nothing. Arriving alone in a country whose language you do
 * not yet have is the part that breaks people, and it is solvable with a list this product already
 * holds. What was missing was the ability to say yes to someone.
 *
 * Nobody is a member until they have agreed. A row exists from the moment somebody is invited, but
 * `status` is what makes it real, and until it is `joined` neither side sees the other's details.
 */
export const cohortGroups = pgTable('cohort_groups', {
  id: id(),
  kind: text('kind').$type<'flat_share' | 'travel'>().notNull().default('flat_share'),
  title: text('title').notNull(),
  city: text('city').notNull(),
  /** The month everyone is arriving, as a label: "March 2026". */
  month: text('month').notNull(),
  district: text('district'),
  seats: integer('seats').notNull().default(3),
  budgetEachEur: integer('budget_each_eur'),
  /** 'even' is the only split the bot will set on its own. Anything else is agreed by people. */
  rentSplit: text('rent_split').$type<'even' | 'by_room'>().notNull().default('even'),
  /** For a travel group: where they are flying from. */
  fromCity: text('from_city'),
  createdBy: uuid('created_by').references(() => applicants.id, { onDelete: 'set null' }),
  status: text('status').$type<'open' | 'full' | 'closed'>().notNull().default('open'),
  note: text('note'),
  createdAt: createdAt(),
});

export const cohortMembers = pgTable(
  'cohort_members',
  {
    id: id(),
    groupId: uuid('group_id').notNull().references(() => cohortGroups.id, { onDelete: 'cascade' }),
    applicantId: uuid('applicant_id').notNull().references(() => applicants.id, { onDelete: 'cascade' }),
    role: text('role').$type<'owner' | 'member'>().notNull().default('member'),
    /** Nobody is in a group until they said yes, whoever put the row there. */
    status: text('status').$type<'invited' | 'requested' | 'joined' | 'declined'>().notNull().default('requested'),
    /** Their agreed share, once the group has a budget and a size. */
    shareEur: integer('share_eur'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('cohort_members_group_applicant').on(t.groupId, t.applicantId)],
);

/**
 * Pages Educaro watches on everyone's behalf.
 *
 * A jury asked what an uploaded document is checked against, and the honest answer is: a rule on a
 * page somebody wrote, which changes without telling anyone. When RWTH drops its IELTS band from
 * 6.5 to 6.0, the people affected are precisely the ones who were told "not yet" — and they are the
 * least likely to re-read the page they were already rejected against. Same for a ministry changing
 * a visa threshold, and same for an employer easing a German requirement.
 *
 * So staff keep a list, the list is polled, and the parsed requirements are compared against the
 * last reading. `snapshot` is what we understood last time, not the page: storing the HTML would
 * make every navigation tweak look like a policy change.
 */
export const watchedSources = pgTable('watched_sources', {
  id: id(),
  kind: text('kind').$type<'university' | 'government' | 'employer'>().notNull().default('university'),
  label: text('label').notNull(),
  url: text('url').notNull().unique(),
  /** The programme or opening this page governs, when it governs exactly one. */
  programmeId: uuid('programme_id'),
  openingId: uuid('opening_id'),
  /** Who should hear about a change here, when it is not implied by a shortlist. */
  route: text('route'),
  active: boolean('active').notNull().default(true),
  intervalMinutes: integer('interval_minutes').notNull().default(360),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastChangedAt: timestamp('last_changed_at', { withTimezone: true }),
  /** Hash of the extracted text, to skip the diff when nothing moved at all. */
  lastHash: text('last_hash'),
  /** What we understood the requirements to be at the last read. */
  snapshot: jsonb('snapshot').$type<Record<string, unknown>[]>().notNull().default([]),
  lastError: text('last_error'),
  createdAt: createdAt(),
});

/** One detected movement on a watched page, and who was told about it. */
export const sourceChanges = pgTable('source_changes', {
  id: id(),
  sourceId: uuid('source_id').notNull().references(() => watchedSources.id, { onDelete: 'cascade' }),
  /** 'easier' if anything eased — that is the headline people are waiting for. */
  headline: text('headline').notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>[]>().notNull().default([]),
  /** Applicants we told, and why each of them was on the list. */
  notified: jsonb('notified').$type<Record<string, unknown>[]>().notNull().default([]),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  createdAt: createdAt(),
});

/** Safety checks the applicant ran on something they were sent. Kept so staff can see patterns. */
export const safetyChecks = pgTable('safety_checks', {
  id: id(),
  applicantId: uuid('applicant_id').references(() => applicants.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  subject: text('subject').notNull(),
  url: text('url'),
  verdict: text('verdict').notNull(),
  score: integer('score').notNull(),
  signals: jsonb('signals').$type<Record<string, unknown>[]>().notNull().default([]),
  contractFlags: jsonb('contract_flags').$type<Record<string, unknown>[]>().notNull().default([]),
  /** 'work' or 'rental' when a contract was read, so the clause rules can be scoped to it. */
  contractKind: text('contract_kind'),
  /** Clauses a fair contract of this kind has and this one did not. */
  missing: jsonb('missing').$type<Record<string, unknown>[]>().notNull().default([]),
  /** The opening of what they pasted. Staff see the same fake letter arrive in six inboxes. */
  excerpt: text('excerpt'),
  createdAt: createdAt(),
});
