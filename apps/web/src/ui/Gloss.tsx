import { GLOSSARY, lookupTerm } from '@educaro/shared';
import { useId, useState, type ReactNode } from 'react';

/**
 * German words, explained where they are used.
 *
 * The scope decision for this build is English only, and that is still right: an applicant who has
 * not arrived does not want a German interface. But the product deliberately keeps the German word
 * for a German thing, because the word on the letter from the Ausländerbehörde is
 * "Ausländerbehörde" — and a product that has only ever said "foreigners authority" has not
 * prepared anybody for the envelope.
 *
 * So the gloss goes where the word is, rather than in a glossary page nobody opens. A dotted
 * underline, the meaning on hover, and the longer explanation on tap. It reads as ordinary prose
 * until somebody needs it.
 *
 * Deliberately not a translation layer: translating the whole screen into German would serve
 * nobody here, and machine-translating our own careful sentences into a language the reader does
 * not have yet would lose the one thing that makes them worth reading.
 */

/** Built once. Longest first, so "Akademische Prüfstelle" wins over "APS" in the same sentence. */
const PATTERN = (() => {
  const forms = GLOSSARY.flatMap((e) => [e.term, ...(e.also ?? [])])
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // A trailing `s` or `n` catches the German plural without a stemmer; the boundaries keep
  // "Anmeldung" from matching inside "Anmeldungsbestätigung" wrongly — that has its own entry.
  return new RegExp(`\\b(${forms.join('|')})(?:s|n|en)?\\b`, 'gi');
})();

/**
 * Wrap German terms in `text` with an explanation.
 *
 * Returns plain text when nothing matches, so the overwhelming majority of sentences cost one
 * regex test and no extra DOM.
 */
export function Gloss({ children }: { children: string | null | undefined }) {
  const text = children ?? '';
  if (!text) return null;

  PATTERN.lastIndex = 0;
  if (!PATTERN.test(text)) return <>{text}</>;

  PATTERN.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = PATTERN.exec(text)) !== null) {
    const entry = lookupTerm(m[1]);
    if (!entry) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<Term key={`${m.index}-${i++}`} word={m[0]} short={entry.short} long={entry.long} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Term({ word, short, long }: { word: string; short: string; long?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => long && setOpen((v) => !v)}
        aria-expanded={long ? open : undefined}
        aria-describedby={id}
        className="cursor-help border-b border-dotted border-muted/70 bg-transparent p-0 text-inherit"
        title={`${word}: ${short}`}
      >
        {word}
      </button>
      {/* The short meaning is always available to a screen reader, whether or not anything is open. */}
      <span id={id} className="sr-only">
        {short}
      </span>
      {open && long ? (
        <span
          role="note"
          className="absolute left-0 top-[calc(100%+6px)] z-30 block w-[min(20rem,70vw)] rounded-md border border-line bg-surface px-3 py-2 text-[12.5px] font-normal leading-snug shadow-[var(--lift)]"
        >
          <span className="block font-semibold">{word}</span>
          <span className="block text-muted">{long}</span>
        </span>
      ) : null}
    </span>
  );
}
