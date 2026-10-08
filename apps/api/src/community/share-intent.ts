/**
 * Reading "I'd like to stay with Rohan and split the rent evenly" as an instruction.
 *
 * This is said in a cohort channel, in English that is somebody's second or third language, in the
 * middle of a conversation. It is not a command and it will never be typed as one, so the bot has
 * to recognise the intention in an ordinary sentence or the feature does not exist for the people
 * it is for.
 *
 * Rules first, a model only when the rules are unsure. Two reasons, and neither is cost: a rule is
 * the same every time a jury runs the demo, and — more importantly — this parse decides whether to
 * message a named third party about living arrangements. A model that is creative about who was
 * meant sends a stranger an invitation nobody made. The rules are narrow and the fallback is to do
 * nothing and ask.
 */

export interface ShareIntent {
  kind: 'flat_share' | 'travel';
  /** Whoever they named: a Discord mention, an @name, or a bare first name. */
  who: string | null;
  /** They said "evenly" explicitly. We never assume any other split. */
  evenSplit: boolean;
  /** How sure the rules are. Below `confident`, ask rather than act. */
  confident: boolean;
}

const FLAT = /\b(flat[\s-]?share|flatshare|share (?:a |the )?(?:flat|room|apartment|place|house)|live (?:with|together)|stay (?:with|together)|move in (?:with|together)|wg|room ?mate|flat ?mate|split (?:the )?rent)\b/i;
const TRAVEL = /\b(fly (?:with|together)|same flight|travel (?:with|together)|travelling together|book (?:the )?(?:flight|tickets?) together|go together)\b/i;
const EVEN = /\b(even|evenly|equal|equally|50[\s/-]?50|fifty[\s-]?fifty|same amount|split it even)\b/i;

/**
 * Who they named.
 *
 * Ordered by how certain each form is. A Discord mention is unambiguous and is taken first; a bare
 * name after "with" is the common case and is taken last, because "with" is also how people say
 * "with my sister" and a first name is the only thing we can resolve anyway.
 */
function nameIn(text: string): string | null {
  const mention = text.match(/<@!?\d+>/)?.[0];
  if (mention) return mention;

  const at = text.match(/(?:^|\s)@([A-Za-z][\w.\-]{1,30})/)?.[1];
  if (at) return at;

  // "with Rohan", "with Rohan Mehta", "with Rohan and split…" — stop at a connective, so the name
  // does not swallow the rest of the sentence.
  const after = text.match(/\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)?.[1];
  if (after && !/^(me|us|you|them|him|her|someone|anyone|my)$/i.test(after)) return after;

  // Same, case-insensitively, for people who do not capitalise names.
  const loose = text.match(/\bwith\s+([a-z][a-z'-]{1,20})\b/i)?.[1];
  if (loose && !/^(me|us|you|them|him|her|someone|anyone|my|the|a|an|another|other|others|people|somebody)$/i.test(loose)) return loose;

  return null;
}

/**
 * Does this sentence ask to share with somebody?
 *
 * Returns null for everything else, including questions *about* flat-shares ("how does the flat
 * share work?"), which are a question for the agent and not an instruction to message anyone.
 */
export function parseShareIntent(text: string): ShareIntent | null {
  const t = (text ?? '').trim();
  if (!t || t.length > 600) return null;

  const flat = FLAT.test(t);
  const travel = TRAVEL.test(t);
  if (!flat && !travel) return null;

  // "How do flat-shares work?" is a question, not a request to put two people in one.
  if (/^\s*(how|what|when|where|which|why|does|do|is|are|can anyone|anyone know)\b/i.test(t) && !/\bi('?d| would| want| wanna)\b/i.test(t)) return null;

  const who = nameIn(t);
  // "@ananya want to flatshare?" is a proposal addressed to one person, even though it never
  // says "I". A named target is what makes that safe to act on; without one, nothing fires.
  const wants = /\b(i('?d| would)? ?(like|love|want|prefer)|i'?m (looking|keen|up) for|can i|could i|let'?s|looking for|(?:anyone |you )?wants? to|keen to|up for)\b/i.test(t);

  return {
    kind: travel && !flat ? 'travel' : 'flat_share',
    who,
    evenSplit: EVEN.test(t),
    // A named person plus a stated wish is enough to act on. Everything else gets a question back.
    confident: Boolean(who) && wants,
  };
}
