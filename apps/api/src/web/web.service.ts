import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { extractReadable, htmlToText, mergeHits, parseDuckDuckGo, parseTavily, type SearchHit } from './scrape';
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
    const attempt = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        return await fetch(url, {
          redirect: 'follow',
          ...init,
          signal: ctrl.signal,
          headers: { 'User-Agent': /openstreetmap|overpass/.test(url) ? OSM_UA : UA, 'Accept-Language': 'en,de;q=0.8', ...(init.headers ?? {}) },
        });
      } finally {
        clearTimeout(t);
      }
    };
    try {
      return await attempt();
    } catch (e: any) {
      // A bare "fetch failed" is a transport error, not an answer from the server: a redirect that
      // dropped the connection, a DNS blip, a TLS reset. One retry turns most of them into a page,
      // and a university's own site failing once should not become "we could not read the page".
      if (/aborted/i.test(String(e?.message))) throw e;
      return await attempt();
    }
  }

  /** web_fetch: open a page, keep its visible text, log it as a source for this run. */
  async fetchPage(url: string, ctx: Ctx, opts: { fresh?: boolean } = {}): Promise<Page | null> {
    // Offline: anything we have already read is still readable, and anything else is refused at
    // once rather than after a timeout. Our own stand-in pages are served locally, so they work.
    if (config.offline && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) {
      const cached = await db.query.pageCache.findFirst({ where: eq(schema.pageCache.url, url) });
      if (!cached) {
        this.log.warn(`offline: ${url} is not cached, using the stand-in if there is one`);
        await this.trace.record('tool', 'web_fetch', { url, ok: false, offline: true }, ctx);
        return null;
      }
      await db.insert(schema.sources).values({ runId: ctx.runId, applicantId: ctx.applicantId ?? null, url, title: cached.title ?? '', text: cached.text });
      await this.trace.record('source', 'web_fetch', { url, title: cached.title, chars: cached.text.length, cached: true, offline: true }, ctx);
      return { url, title: cached.title ?? '', text: cached.text, cached: true };
    }
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
        ({ title, text } = htmlToText(html, url));
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


  /**
   * Tavily first when there is a key, DuckDuckGo otherwise, and DuckDuckGo again when Tavily comes
   * back empty.
   *
   * Tavily gives clean, ranked results but costs credits and can rate-limit; scraping DuckDuckGo's
   * HTML costs nothing but breaks whenever they touch their markup. Neither is reliable enough to
   * be the only one, and a specialist that finds nothing is a specialist that silently stops
   * working — so they back each other up and the trace records which one answered.
   */
  private async searchProviders(query: string): Promise<SearchHit[]> {
    if (config.offline) return [];
    const useTavily = config.tavilyKey && config.searchProvider !== 'duckduckgo';
    let tavily: SearchHit[] = [];
    if (useTavily) {
      try {
        const res = await this.get('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.tavilyKey}` },
          body: JSON.stringify({ query, max_results: 6, search_depth: 'basic' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        tavily = parseTavily(await res.json());
      } catch (e: any) {
        this.log.warn(`tavily failed, falling back to duckduckgo: ${e?.message ?? e}`);
      }
    }
    if (tavily.length >= 3) return mergeHits(tavily).slice(0, 8);

    let ddg: SearchHit[] = [];
    try {
      const res = await this.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ddg = parseDuckDuckGo(await res.text());
    } catch (e: any) {
      this.log.warn(`duckduckgo failed: ${e?.message ?? e}`);
    }
    return mergeHits(tavily, ddg).slice(0, 8);
  }

  /** The scraper's full output: text, headings and resolved links, for a page we already fetched. */
  async scrape(url: string, ctx: Ctx) {
    const page = await this.fetchPage(url, ctx, { fresh: true });
    if (!page) return null;
    try {
      const res = await this.get(url);
      return { url, ...extractReadable(await res.text(), url) };
    } catch {
      return { url, title: page.title, text: page.text, headings: [], links: [], lang: null };
    }
  }

  /** web_search. `personal` holds the applicant's name, phone, passport number: never sent out. */
  async search(query: string, ctx: Ctx, personal: string[] = []): Promise<{ title: string; url: string; snippet: string }[]> {
    // A refusal is not an empty result. Swallowing it made "this query carries personal data" look
    // identical to "the web had nothing", so a caller could never tell the guard had fired — least
    // of all an MCP client, which only ever sees the return value.
    await this.guards.assertCleanQuery(ctx, query, personal);
    const hits = await this.searchProviders(query);
    const results = hits.map((h) => ({ title: h.title, url: h.url, snippet: h.snippet }));
    await this.trace.record('tool', 'web_search', { query, results: results.length, providers: [...new Set(hits.map((h) => h.provider))] }, ctx);
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


function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export { htmlToText } from './scrape';
