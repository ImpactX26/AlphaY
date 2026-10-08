import * as cheerio from 'cheerio';

/**
 * Turning a page into something worth quoting.
 *
 * The agent may only save a Web fact when the quote is verbatim on the page it opened, so this is
 * not a "roughly readable" job: whatever we keep has to be exactly what was printed, and whatever
 * we drop can never be cited. Two things follow.
 *
 * Requirements live in tables. "IELTS | 6.5 overall" as two stripped cells reads as two unrelated
 * fragments, and the one sentence worth quoting never exists. Rows are flattened into "label: value"
 * so the fact survives the extraction.
 *
 * Navigation looks like content to a naive text dump — a university menu is a hundred short links,
 * and it drowns the eight sentences that matter. The densest container wins instead, with the
 * boilerplate dropped first.
 */

export interface Extracted {
  title: string;
  text: string;
  headings: string[];
  links: { text: string; url: string }[];
  lang: string | null;
}

const DROP = 'script, style, noscript, svg, iframe, form, button, input, select, textarea, [aria-hidden="true"], [hidden]';
const CHROME = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], .cookie, #cookie, .cookies, .consent, .breadcrumb, .breadcrumbs, .skip-link, .sr-only, .visually-hidden';
const MAIN = ['main', 'article', '[role="main"]', '#content', '#main', '.content', '.main-content', '.page-content', '.entry-content'];

/** Text density, ignoring link text: a menu scores badly however long it is. */
function score($: cheerio.CheerioAPI, el: cheerio.Cheerio<any>): number {
  const text = el.text().replace(/\s+/g, ' ').trim();
  if (text.length < 200) return 0;
  const linkText = el.find('a').text().replace(/\s+/g, ' ').trim().length;
  const linkRatio = linkText / Math.max(1, text.length);
  const paragraphs = el.find('p, li, td').length;
  return text.length * (1 - Math.min(0.95, linkRatio)) + paragraphs * 40;
}

function pickMain($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  for (const sel of MAIN) {
    const el = $(sel).first();
    if (el.length && score($, el) > 400) return el;
  }
  let best = $('body');
  let bestScore = score($, best);
  $('body div, body section').each((_, node) => {
    const el = $(node);
    const s = score($, el);
    if (s > bestScore) {
      bestScore = s;
      best = el;
    }
  });
  return best;
}

/** "IELTS | 6.5 overall" is two fragments; "IELTS: 6.5 overall" is a sentence you can quote. */
function flattenTables($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): string[] {
  const out: string[] = [];
  root.find('table').each((_, table) => {
    const $t = $(table);
    const headers = $t
      .find('thead th, tr:first-child th')
      .map((_i, th) => $(th).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);
    $t.find('tr').each((_i, tr) => {
      const cells = $(tr)
        .find('td, th')
        .map((_j, td) => $(td).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter(Boolean);
      if (cells.length < 2) return;
      if (headers.length && cells.every((c, k) => c === headers[k])) return;
      out.push(headers.length === cells.length ? cells.map((c, k) => `${headers[k]}: ${c}`).join(' · ') : `${cells[0]}: ${cells.slice(1).join(' · ')}`);
    });
    $t.remove();
  });
  // Definition lists carry requirements the same way tables do.
  root.find('dl').each((_, dl) => {
    const $d = $(dl);
    $d.find('dt').each((_i, dt) => {
      const term = $(dt).text().replace(/\s+/g, ' ').trim();
      const def = $(dt).nextAll('dd').first().text().replace(/\s+/g, ' ').trim();
      if (term && def) out.push(`${term}: ${def}`);
    });
    $d.remove();
  });
  return out;
}

export function extractReadable(html: string, baseUrl?: string): Extracted {
  const $ = cheerio.load(html);
  const title = ($('meta[property="og:title"]').attr('content') || $('title').first().text() || $('h1').first().text() || '').replace(/\s+/g, ' ').trim();
  const lang = ($('html').attr('lang') || '').slice(0, 5) || null;

  $(DROP).remove();
  const root = pickMain($);
  // Chrome is removed only inside the chosen container, so a page that *is* its nav still yields text.
  root.find(CHROME).remove();

  const tableLines = flattenTables($, root);
  const headings: string[] = [];
  const blocks: string[] = [];

  root.find('h1, h2, h3, h4, h5, p, li, dt, dd, blockquote, figcaption, pre').each((_, el) => {
    const $el = $(el);
    // Only leaves, or the same sentence is emitted once per ancestor.
    if ($el.find('p, li, h1, h2, h3, h4, table, ul, ol').length) return;
    const t = $el.text().replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2) return;
    if (/^(h[1-5])$/i.test(el.tagName ?? '')) headings.push(t);
    blocks.push(t);
  });

  const links: Extracted['links'] = [];
  root.find('a[href]').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    const href = $(el).attr('href') ?? '';
    if (!t || !href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      links.push({ text: t, url: baseUrl ? new URL(href, baseUrl).toString() : href });
    } catch {
      /* a malformed href is not worth failing a page over */
    }
  });

  const seen = new Set<string>();
  const text = [...blocks, ...tableLines]
    .filter((b) => (seen.has(b) ? false : (seen.add(b), true)))
    .join('\n')
    .slice(0, 80_000);

  return { title, text, headings: headings.slice(0, 60), links: links.slice(0, 200), lang };
}

/** Kept as the old name so existing callers are untouched. */
export function htmlToText(html: string, baseUrl?: string): { title: string; text: string } {
  const { title, text } = extractReadable(html, baseUrl);
  return { title, text };
}

// ---------------------------------------------------------------- search

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  provider: 'tavily' | 'duckduckgo';
}

export function parseDuckDuckGo(html: string): SearchHit[] {
  const $ = cheerio.load(html);
  const out: SearchHit[] = [];
  $('.result, .web-result').each((_, el) => {
    const a = $(el).find('a.result__a').first();
    let href = a.attr('href') ?? '';
    // DuckDuckGo wraps every result in a redirect; the real URL is in uddg=.
    const m = /[?&]uddg=([^&]+)/.exec(href);
    if (m) href = decodeURIComponent(m[1]);
    if (!href.startsWith('http')) return;
    const title = a.text().replace(/\s+/g, ' ').trim();
    if (!title) return;
    out.push({ title, url: href, snippet: $(el).find('.result__snippet').text().replace(/\s+/g, ' ').trim(), provider: 'duckduckgo' });
  });
  return out;
}

export function parseTavily(body: any): SearchHit[] {
  return (body?.results ?? [])
    .filter((r: any) => r?.url)
    .map((r: any) => ({ title: String(r.title ?? r.url), url: String(r.url), snippet: String(r.content ?? '').replace(/\s+/g, ' ').slice(0, 300), provider: 'tavily' as const }));
}

/** Same page from two providers is one result; the richer snippet wins. */
export function mergeHits(...lists: SearchHit[][]): SearchHit[] {
  const byUrl = new Map<string, SearchHit>();
  for (const hit of lists.flat()) {
    const key = hit.url.replace(/[#?].*$/, '').replace(/\/$/, '');
    const existing = byUrl.get(key);
    if (!existing || hit.snippet.length > existing.snippet.length) byUrl.set(key, hit);
  }
  return [...byUrl.values()];
}
