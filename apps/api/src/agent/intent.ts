/**
 * What is this message actually asking for?
 *
 * The supervisor plans one whole move per event: route, questions, specialists, outside actions and
 * a reply, in a single large prompt. That is the right shape for "I uploaded four documents" and
 * the wrong shape for "ok" — and when the model is rate limited or slow, every message collapses to
 * the same rule-based sentence, which is what a jury saw: five different questions, one identical
 * answer.
 *
 * Classifying first costs nothing and fixes both ends. An acknowledgement gets an acknowledgement
 * and never reaches a model. A real question gets a focused prompt about that question instead of
 * the whole planning apparatus — fewer tokens, so it survives a tight rate limit, and a better
 * answer because the model is asked one thing.
 *
 * Rules, not a model: a classifier that needs the thing it is protecting cannot protect it.
 */

export type Intent =
  | 'acknowledgement' // "ok", "thanks", "got it"
  | 'greeting'
  | 'plan_question' // about their own file: what next, how long, am I on track
  | 'process_question' // about Germany: exams, visas, recognition, costs
  | 'action_request' // do something: book a call, draft it, send it
  | 'upload_intent' // they are telling us a document is coming
  | 'personal_statement' // they are telling us a fact about themselves
  | 'weather_question' // what is it like there — a real question for someone leaving Kerala
  | 'off_topic'
  | 'unclear';

export interface IntentResult {
  intent: Intent;
  /** A reply we can give in code. Null means it is worth a model call. */
  cannedReply: string | null;
  /** Hint for the focused prompt when a model is worth it. */
  focus: 'plan' | 'process' | 'weather' | 'none';
}

const ACK = /^(ok(ay)?|k|thanks?|thank you|thx|ty|got it|understood|sure|yes|yeah|yep|no|nope|fine|alright|cool|great|nice|perfect|done|will do|noted)[\s.!,]*$/i;
const GREET = /^(hi|hey|hello|good (morning|afternoon|evening)|namaste|vanakkam)\b[\s.!,]*$/i;

const PLAN = /\b(my|me|i|mine)\b.*\b(next|step|plan|status|ready|readiness|track|missing|left|remaining|progress|timeline|when (can|will) i)\b|\bwhat('?s| is) next\b|\bam i (on track|ready)\b|\bhow long (will|does) (it|this|my)\b|\bwhat do i need\b/i;
const PROCESS =
  /\b(aps|ielts|toefl|goethe|telc|ösd|osd|testdaf|b1|b2|a1|a2|c1|anerkennung|recognition|kenntnisprüfung|visa|blocked account|sperrkonto|uni-assist|apostille|chancenkarte|opportunity card|ausbildung|anmeldung|bürgeramt|krankenkasse|insurance|tax|rent|salary|exam|certificate|deadline|semester|tuition|fee|apply|application)\b/i;
const ACTION = /\b(book|schedule|arrange|draft|write|send|apply|submit|upload|download|print|call me|connect|link)\b/i;
const UPLOAD = /\b(i (will|'ll)? ?(upload|send|attach|share)|here (is|are) my|attaching|uploaded|sending you)\b/i;
const STATEMENT = /\b(i (am|have|did|was|work|studied|finished|passed|hold|got|live|speak)|my (name|sister|brother|husband|wife|father|mother|degree|diploma|experience|german|english) )\b/i;

/** Things that are plainly not what this product is for. Short list on purpose: a false positive here is rude. */
const WEATHER = /\b(weather|forecast|temperature|how cold|how warm|climate|winter|summer|snow|rain|daylight|dark at)\b/i;
const OFF_TOPIC =
  /\b(football|cricket|movie|film|song|music|joke|recipe|bitcoin|crypto|stock price|lottery|who are you really|are you (a )?(robot|human|ai|bot)|what model are you)\b/i;

export function classifyIntent(text: string): IntentResult {
  const t = (text ?? '').trim();
  if (!t) return { intent: 'unclear', cannedReply: 'I did not catch that — could you say it again?', focus: 'none' };

  if (GREET.test(t)) {
    return { intent: 'greeting', cannedReply: null, focus: 'plan' };
  }
  if (ACK.test(t)) {
    // An acknowledgement wants an acknowledgement. Repeating the whole next step at someone who
    // just said "ok" is what makes an assistant feel like a phone menu.
    return { intent: 'acknowledgement', cannedReply: 'Good. I will keep going and tell you the moment something needs you.', focus: 'none' };
  }
  // Weather sounds like small talk and is not: someone who has never seen below 20 °C is moving
  // somewhere that spends three months near freezing, and the first winter sends people home.
  if (WEATHER.test(t)) return { intent: 'weather_question', cannedReply: null, focus: 'weather' };
  if (OFF_TOPIC.test(t) && !PROCESS.test(t)) {
    return {
      intent: 'off_topic',
      cannedReply: 'That one is outside what I can help with — I only know your move to Germany. Ask me about your documents, your German, the costs or what happens next.',
      focus: 'none',
    };
  }
  if (UPLOAD.test(t)) {
    return { intent: 'upload_intent', cannedReply: 'Drop it in and I will read it. If it proves something you have told me, I will mark that Verified.', focus: 'none' };
  }
  if (ACTION.test(t)) return { intent: 'action_request', cannedReply: null, focus: 'plan' };
  if (PLAN.test(t)) return { intent: 'plan_question', cannedReply: null, focus: 'plan' };
  if (PROCESS.test(t)) return { intent: 'process_question', cannedReply: null, focus: 'process' };
  if (STATEMENT.test(t)) return { intent: 'personal_statement', cannedReply: null, focus: 'plan' };

  // A question mark, or more than a few words, is worth a real answer even if nothing matched.
  if (/\?/.test(t) || t.split(/\s+/).length > 4) return { intent: 'plan_question', cannedReply: null, focus: 'plan' };
  return { intent: 'unclear', cannedReply: null, focus: 'plan' };
}

/** The focused system prompt for a single question, instead of the whole planning prompt. */
export const REPLY_SYSTEM = `You are Educaro's agent, answering ONE question from an Indian applicant moving to Germany.

Answer in English, always, whatever they write in and wherever they are — they are still learning German.
Keep the German word for a German thing (Anmeldung, Anerkennung, Bürgeramt, Sperrkonto) and say what it means.
Use ONLY the facts given about this person. If their file does not answer it, say what you do know and what
you would need. Never invent a requirement, a fee or a date. Never promise an outcome.
Two to four sentences, warm and specific. No greeting line, no sign-off, no bullet points.`;
