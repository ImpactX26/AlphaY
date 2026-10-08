import { Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { LlmService } from '../llm/llm.service';

export interface Passage {
  text: string;
  fileId: string | null;
  fileName: string;
  score: number;
}

/**
 * Finding the sentence in their own documents.
 *
 * The truth map holds the facts we extracted, which is the right shape for comparing claims and the
 * wrong shape for "what exactly did my experience letter say about my ward". That answer is a
 * sentence on a page they uploaded, and if the agent cannot quote it, it either guesses or says it
 * does not know — and both are bad in the one case where the answer is definitely on file.
 *
 * Retrieval is lexical, not embedded, and that is a deliberate choice rather than a shortcut. The
 * corpus is five short documents belonging to one person, full of rare exact tokens — a registration
 * number, a hospital name, "Anerkennung" — and on rare tokens BM25 beats a general-purpose
 * embedding, with no model, no key, no download and no cold start. The pgvector column stays in the
 * schema for when a corpus exists that needs it; nothing here pretends to need it yet.
 */
@Injectable()
export class RetrievalService {
  private readonly log = new Logger('Retrieval');

  constructor(private readonly llm: LlmService) {}

  /** Chunk on paragraph boundaries, then pack to roughly a screenful so a quote keeps its context. */
  async index(applicantId: string, fileId: string, fileName: string, text: string) {
    if (!text?.trim()) return 0;
    const chunks = chunk(text);
    await db.delete(schema.docChunks).where(eq(schema.docChunks.fileId, fileId));
    if (!chunks.length) return 0;
    await db.insert(schema.docChunks).values(chunks.map((c) => ({ applicantId, fileId, text: `${fileName}\n${c}` })));
    return chunks.length;
  }

  /**
   * BM25 over this applicant's chunks only.
   *
   * Scoped per applicant, always: a retrieval bug that leaks one person's documents into another
   * person's answer is the worst failure this product could have, so it is a WHERE clause rather
   * than a filter applied after scoring.
   */
  async search(applicantId: string, query: string, limit = 4): Promise<Passage[]> {
    const rows = await db.select().from(schema.docChunks).where(eq(schema.docChunks.applicantId, applicantId));
    if (!rows.length) return [];

    // Both, when both are available. They fail differently: BM25 misses a question that shares no
    // words with the page ("where did I work" against "Department of General Medicine"), and a
    // vector misses the exact token that is the entire answer (KNMC/2021/48217 means nothing to an
    // embedding). Union them and let the lexical score break ties, because on a registration number
    // the exact match is the one that is right.
    const semantic = await this.semantic(applicantId, query, limit).catch(() => []);

    const asked = tokenise(query);
    if (!asked.length) return [];
    // The words they typed, plus what the documents are likely to call the same things.
    const q = [...asked, ...asked.flatMap((t) => EXPAND.get(t) ?? [])];

    const docs = rows.map((r) => ({ row: r, tokens: tokenise(r.text) }));
    const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / docs.length;
    const df = new Map<string, number>();
    for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) ?? 0) + 1);

    const k1 = 1.5;
    const b = 0.75;
    const scored = docs.map(({ row, tokens }) => {
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      const typed = new Set(asked);
      for (const term of new Set(q)) {
        const f = tf.get(term) ?? 0;
        if (!f) continue;
        const n = df.get(term) ?? 0;
        // Standard BM25 idf: a term in every chunk tells you nothing, a rare one tells you a lot.
        const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        // A synonym is a guess about what they meant; a word they typed is not. Half weight keeps
        // the expansion from outvoting an exact match.
        const weight = typed.has(term) ? 1 : 0.5;
        score += weight * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * tokens.length) / avgLen)));
      }
      return { row, score };
    });

    const files = await db.select().from(schema.files).where(eq(schema.files.applicantId, applicantId));
    const nameOf = new Map(files.map((f) => [f.id, f.originalName]));

    const lexical = scored.filter((s) => s.score > 0.4);
    const seen = new Set(lexical.map((l) => l.row.id));
    for (const hit of semantic) {
      if (!seen.has(hit.row.id)) lexical.push({ row: hit.row, score: hit.score });
    }

    return lexical
      .sort((a, b2) => b2.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        text: s.row.text.split('\n').slice(1).join('\n').trim() || s.row.text,
        fileId: s.row.fileId,
        fileName: (s.row.fileId && nameOf.get(s.row.fileId)) || s.row.text.split('\n')[0],
        score: Math.round(s.score * 100) / 100,
      }));
  }


  /**
   * Cosine distance in Postgres, which is what the pgvector column was added for.
   * Returns nothing when there is no key: the lexical path already answers on its own.
   */
  private async semantic(applicantId: string, query: string, limit: number): Promise<{ row: typeof schema.docChunks.$inferSelect; score: number }[]> {
    const vec = (await this.llm.embed([query]))?.[0];
    if (!vec) return [];
    const literal = `[${vec.join(',')}]`;
    const rows = await db
      .select({ row: schema.docChunks, distance: sql<number>`${schema.docChunks.embedding} <=> ${literal}::vector` })
      .from(schema.docChunks)
      .where(sql`${schema.docChunks.applicantId} = ${applicantId} and ${schema.docChunks.embedding} is not null`)
      .orderBy(sql`${schema.docChunks.embedding} <=> ${literal}::vector`)
      .limit(limit);
    // Scored below the BM25 floor on purpose: a semantic neighbour is a fallback for when no exact
    // term matched, not a rival to a chunk that contains the words the person actually typed.
    return rows.filter((r) => r.distance < 0.6).map((r) => ({ row: r.row, score: 0.5 * (1 - r.distance) }));
  }

  async count(applicantId: string) {
    return (await db.select().from(schema.docChunks).where(eq(schema.docChunks.applicantId, applicantId))).length;
  }
}


/**
 * The words this domain uses for the same thing.
 *
 * A letter says "Department of General Medicine"; the person asks "which ward was I on". They share
 * no token, so BM25 returns nothing and the agent says it has no record of something that is
 * written on a page it holds — the worst answer available, because it is confidently wrong about
 * its own evidence.
 *
 * Embeddings solve this and need a paid key, which is a thin reason for the product to fail without
 * one. The vocabulary here is small, closed and known: a few dozen pairs cover nearly every way an
 * applicant rephrases what their own documents call something. Expansion is additive, so an exact
 * term still wins — "KNMC/2021/48217" is untouched by any of this.
 */
const SYNONYMS: string[][] = [
  ['ward', 'department', 'dept', 'unit', 'floor', 'station'],
  ['hospital', 'clinic', 'klinikum', 'institute', 'medical', 'centre', 'center'],
  ['job', 'work', 'employment', 'employed', 'post', 'position', 'role', 'designation'],
  ['salary', 'pay', 'wage', 'remuneration', 'stipend', 'compensation'],
  ['boss', 'manager', 'supervisor', 'superintendent', 'head'],
  ['degree', 'diploma', 'qualification', 'certificate', 'gnm', 'bsc', 'btech'],
  ['college', 'university', 'school', 'institution'],
  ['marks', 'grade', 'score', 'cgpa', 'sgpa', 'percentage', 'result'],
  ['registration', 'licence', 'license', 'council', 'register', 'enrolment'],
  ['experience', 'service', 'tenure', 'worked', 'working'],
  ['language', 'german', 'deutsch', 'english', 'cefr'],
  ['passport', 'travel document'],
  ['birth', 'born', 'dob', 'age'],
  ['address', 'residence', 'living', 'home'],
  ['course', 'training', 'programme', 'program', 'study', 'studies'],
];

const EXPAND = new Map<string, string[]>();
for (const group of SYNONYMS) for (const word of group) EXPAND.set(word, group.filter((w) => w !== word));

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that', 'with', 'as', 'at', 'by',
  'from', 'has', 'have', 'had', 'i', 'my', 'me', 'you', 'your', 'we', 'do', 'does', 'did', 'what', 'when', 'where', 'which', 'who', 'how', 'can', 'will',
]);

function tokenise(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Paragraphs, packed to about 700 characters: long enough to carry context, short enough to quote. */
function chunk(text: string, target = 700): string[] {
  const paras = text
    .replace(/\r/g, '')
    .split(/\n{2,}|\n(?=[A-Z][a-z]+ [A-Z])/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 30);

  const out: string[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + ' ' + p).length > target && buf) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? `${buf} ${p}` : p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.slice(0, 60);
}
