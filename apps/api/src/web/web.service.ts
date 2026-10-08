import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db/db';
import { GuardsService } from '../agent/guards.service';
import { TraceService } from '../trace/trace.service';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 EducaroAgent/0.1';
// OpenStreetMap services reject browser-like or library default agents (HTTP 406): identify the app.
const OSM_UA = 'EducaroAgentPrototype/1.0 (ImpactX26 hackathon prototype)';
const DAY = 86_400_000;

export interface Ctx {
  runId: string;
  applicantId?: string | null;
}

export interface Page {
  url: string;
  title: string;
  text: string;
  cached: boolean;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  distanceM?: number;
}

/**
 * The only way the agent reaches the outside web. Every opened page is logged as a source for the
 * current run, which is what the "no source, no save" guard checks against.
 * Personal data never goes into a query (guard 6).
 */
@Injectable()
export class WebService {
  private readonly log = new Logger('Web');

  constructor(
    private readonly trace: TraceService,
    private readonly guards: GuardsService,
  ) {}

  /** Shared across instances: one Overpass outage should not be re-discovered by every call. */
  private static overpassColdUntil = 0;

  private async get(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': /openstreetmap|overpass/.test(url) ? OSM_UA : UA, 'Accept-Language': 'en,de;q=0.8', ...(init.headers ?? {}) } });
    } finally {
      clearTimeout(t);
    }
  }

  /** web_fetch: open a page, keep its visible text, log it as a source for this run. */
  async fetchPage(url: string, ctx: Ctx, opts: { fresh?: boolean } = {}): Promise<Page | null> {
    let title = '';
    let text = '';
    let cached = false;
    const hit = opts.fresh ? null : await db.query.pageCache.findFirst({ where: eq(schema.pageCache.url, url) });
    if (hit && Date.now() - hit.fetchedAt.getTime() < DAY) {
      title = hit.title ?? '';
      text = hit.text;
      cached = true;
    } else {
      try {
        const res = await this.get(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        ({ title, text } = htmlToText(html));
        await db
          .insert(schema.pageCache)
          .values({ url, title, text })
          .onConflictDoUpdate({ target: schema.pageCache.url, set: { title, text, fetchedAt: new Date() } });
      } catch (e: any) {
        this.log.warn(`fetch ${url} failed: ${e?.message ?? e}`);
        if (hit) {
          title = hit.title ?? '';
          text = hit.text;
          cached = true;
        } else {
          await this.trace.record('tool', 'web_fetch', { url, ok: false, error: String(e?.message ?? e) }, ctx);
          return null;
        }
      }
    }
    await db.insert(schema.sources).values({ runId: ctx.runId, applicantId: ctx.applicantId ?? null, url, title, text });
    await this.trace.record('source', 'web_fetch', { url, title, chars: text.length, cached }, ctx);
    return { url, title, text, cached };
  }

  /** web_search. `personal` holds the applicant's name, phone, passport number: never sent out. */
  async search(query: string, ctx: Ctx, personal: string[] = []): Promise<{ title: string; url: string; snippet: string }[]> {
    try {
      await this.guards.assertCleanQuery(ctx, query, personal);
    } catch {
      return [];
    }
    let results: { title: string; url: string; snippet: string }[] = [];
    try {
      if (config.searchProvider === 'tavily' && config.tavilyKey) {
        const res = await this.get('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: config.tavilyKey, query, max_results: 6 }),
        });
        const j: any = await res.json();
        results = (j.results ?? []).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 300) ?? '' }));
      } else {
        const res = await this.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
        const $ = cheerio.load(await res.text());
        $('.result').each((_, el) => {
          const a = $(el).find('a.result__a');
          let href = a.attr('href') ?? '';
          const m = href.match(/uddg=([^&]+)/);
          if (m) href = decodeURIComponent(m[1]);
          if (href.startsWith('http')) results.push({ title: a.text().trim(), url: href, snippet: $(el).find('.result__snippet').text().trim() });
        });
        results = results.slice(0, 8);
      }
    } catch (e: any) {
      this.log.warn(`search failed: ${e?.message ?? e}`);
    }
    await this.trace.record('tool', 'web_search', { query, results: results.length }, ctx);
    return results;
  }

  /** places_nearby: OpenStreetMap Overpass. Free, no key. */
  async placesNearby(lat: number, lon: number, filters: string[], radiusM: number, ctx: Ctx): Promise<Place[]> {
    const body = `[out:json][timeout:20];(${filters.map((f) => `nwr${f}(around:${radiusM},${lat},${lon});`).join('')});out center 40;`;
    const cacheKey = `overpass:${Buffer.from(body).toString('base64').slice(0, 180)}`;
    const hit = await db.query.pageCache.findFirst({ where: eq(schema.pageCache.url, cacheKey) });
    let elements: any[] = [];
    if (hit && Date.now() - hit.fetchedAt.getTime() < 7 * DAY) elements = JSON.parse(hit.text);
    // Overpass is free and often busy, and the life specialist asks it five times in a row. On a
    // bad network that was two endpoints x 25s x five calls, so a single agent run sat there for
    // over a minute before giving the same empty answer it could have given at once. One failure
    // means the next few minutes are not worth waiting for either.
    else if (Date.now() > WebService.overpassColdUntil) {
      for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
        try {
          const res = await this.get(endpoint, { method: 'POST', body: `data=${encodeURIComponent(body)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 8_000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          elements = ((await res.json()) as any).elements ?? [];
          await db
            .insert(schema.pageCache)
            .values({ url: cacheKey, title: 'overpass', text: JSON.stringify(elements) })
            .onConflictDoUpdate({ target: schema.pageCache.url, set: { text: JSON.stringify(elements), fetchedAt: new Date() } });
          WebService.overpassColdUntil = 0;
          break;
        } catch (e: any) {
          this.log.warn(`overpass ${endpoint} failed: ${e?.message ?? e}`);
          WebService.overpassColdUntil = Date.now() + 3 * 60_000;
        }
      }
    }
    const places: Place[] = elements
      .map((el) => {
        const plat = el.lat ?? el.center?.lat;
        const plon = el.lon ?? el.center?.lon;
        const t = el.tags ?? {};
        if (!plat || !plon || !t.name) return null;
        const address = [t['addr:street'] && `${t['addr:street']} ${t['addr:housenumber'] ?? ''}`.trim(), t['addr:postcode'], t['addr:city']].filter(Boolean).join(', ');
        return { name: t.name, lat: plat, lon: plon, address: address || undefined, distanceM: Math.round(haversine(lat, lon, plat, plon)) };
      })
      .filter(Boolean) as Place[];
    places.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    await this.trace.record('tool', 'places_nearby', { lat, lon, filters, found: places.length, source: 'OpenStreetMap Overpass' }, ctx);
    return places;
  }

  /** job_search: Bundesagentur für Arbeit job search (community-documented API, v6; v4 now returns 403). */
  async jobSearch(was: string, wo: string, ctx: Ctx, umkreis = 25, angebotsart = 1): Promise<{ title: string; employer: string; city: string; url: string; refnr: string }[]> {
    const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=${encodeURIComponent(was)}&wo=${encodeURIComponent(wo)}&umkreis=${umkreis}&angebotsart=${angebotsart}&size=10&page=1`;
    let jobs: { title: string; employer: string; city: string; url: string; refnr: string }[] = [];
    try {
      const res = await this.get(url, { headers: { 'X-API-Key': 'jobboerse-jobsuche' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: any = await res.json();
      const list: any[] = j.ergebnisliste ?? j.stellenangebote ?? [];
      jobs = list.map((s: any) => {
        const refnr = s.referenznummer ?? s.refnr ?? '';
        return {
          title: s.stellenangebotsTitel ?? s.titel ?? s.hauptberuf ?? 'Job',
          employer: s.firma ?? s.arbeitgeber ?? '',
          city: s.stellenlokationen?.[0]?.adresse?.ort ?? s.arbeitsort?.ort ?? wo,
          refnr,
          url: s.externeURL ?? s.externeUrl ?? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(refnr)}`,
        };
      });
    } catch (e: any) {
      this.log.warn(`job search failed: ${e?.message ?? e}`);
    }
    await this.trace.record('tool', 'job_search', { was, wo, found: jobs.length, source: 'Bundesagentur für Arbeit' }, ctx);
    return jobs;
  }

  /** Geocode an address in Germany (Nominatim, free, one request per call). */
  async geocode(q: string, ctx: Ctx): Promise<{ lat: number; lon: number } | null> {
    try {
      const res = await this.get(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`);
      const j: any[] = (await res.json()) as any[];
      await this.trace.record('tool', 'geocode', { q, found: j.length }, ctx);
      return j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon) } : null;
    } catch {
      return null;
    }
  }
}

export function htmlToText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  $('script, style, noscript, svg, iframe, nav, footer, header [role="navigation"], form, button').remove();
  const blocks: string[] = [];
  $('h1, h2, h3, h4, p, li, td, th, dt, dd, blockquote, figcaption, span, div').each((_, el) => {
    const $el = $(el);
    if ($el.children('p, li, div, h1, h2, h3, h4, table, ul, ol').length) return;
    const t = $el.text().replace(/\s+/g, ' ').trim();
    if (t) blocks.push(t);
  });
  const seen = new Set<string>();
  const text = blocks.filter((b) => (seen.has(b) ? false : (seen.add(b), true))).join('\n').slice(0, 80_000);
  return { title, text };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
