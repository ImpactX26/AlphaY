import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/db';
import { cefrIndex, parseCefr } from '../../knowledge/cefr';
import { convertIndianGrade } from '../../knowledge/grades';
import { findCity } from '../../knowledge/cities';
import { bestFact, factData } from '../state.service';
import { germanLevels } from '../checks';
import { employerKey } from '../../safety/safety.service';
import type { Kit, SpecialistResult } from './kit';

/** University scout: programmes that fit, from the catalogue (official pages), ranked in code. */
export async function scoutSpecialist(kit: Kit): Promise<SpecialistResult> {
  if (kit.state.applicant.route !== 'study') return { summary: 'Scout: not a study route', output: { programmes: [] } };
  const qual = bestFact(kit.state, 'education.highest')?.value ?? '';
  const g = factData(kit.state, 'education.grade');
  const conv = convertIndianGrade(String(g.raw ?? bestFact(kit.state, 'education.grade')?.value ?? ''), g.scaleMax, g.passMin);
  const field = /comput|cs\b|informat|software|it\b|data/i.test(qual) ? 'cs' : /mech|electr|civil|engineer/i.test(qual) ? 'engineering' : 'any';
  const all = await db.query.programmes.findMany();
  const shortlisted = new Set(kit.state.shortlist.map((s) => s.refId));
  const eng = kit.state.facts.filter((f) => f.key === 'language.english');
  const engProven = eng.some((f) => f.sourceKind === 'document');
  const apsDone = kit.state.files.some((f) => f.kind === 'aps_certificate' && f.status === 'done');
  const ranked = all
    .filter((p) => field === 'any' || p.field === field)
    .map((p) => {
      const d = p.data as any;
      const gaps: string[] = [];
      if (conv && d.minGrade && conv.german > d.minGrade) gaps.push(`Grade ${conv.german.toFixed(1)} vs ${d.minGrade} needed`);
      if (!engProven) gaps.push('English report');
      if (!apsDone) gaps.push('APS');
      const why = [d.why ?? `${p.language}-taught ${p.degree}`, conv ? `German grade ${conv.german.toFixed(1)}${d.minGrade ? ` (limit ${d.minGrade})` : ''}` : null].filter(Boolean).join('; ');
      return { id: p.id, title: `${p.title}`, subtitle: `${p.university} · ${p.city}`, url: p.url, kind: 'programme' as const, why, gaps: gaps.length, shortlisted: shortlisted.has(p.id), deadline: d.deadline ?? null };
    })
    .sort((a, b) => a.gaps - b.gaps || a.title.localeCompare(b.title))
    .slice(0, 6);
  return { summary: `Scout: ${ranked.length} programmes fit`, output: { programmes: ranked, germanGrade: conv } };
}

/** Jobs and Ausbildung: Educaro partner openings first, then the public job board. */
export async function jobsSpecialist(kit: Kit): Promise<SpecialistResult> {
  const route = kit.state.applicant.route;
  if (!route || route === 'study') return { summary: 'Jobs: not needed for this route', output: { openings: [], public: [] } };
  const family = (bestFact(kit.state, 'family.germany')?.data ?? {}) as any;
  const prefer = findCity(kit.state.applicant.targetCity) ?? findCity(family.city) ?? findCity(bestFact(kit.state, 'goal.city')?.value);
  const { proven, claimed } = germanLevels(kit.state);
  const rows = await db.query.openings.findMany({ where: and(eq(schema.openings.status, 'open'), inArray(schema.openings.route, [route, route === 'chancenkarte' ? 'skilled_job' : route])) });

  // What the people already working there told us privately.
  //
  // The private-report channel only means something if what comes back out of it changes a
  // decision, and the decision it should change is this one: recommending somebody to an employer
  // three people have reported for the same thing is the product failing at the exact point it
  // promised to help. The aggregate is used, never anybody's words, and below three reports there
  // is no signal at all — one person's bad week must not cost an employer their matches.
  const reports = await db.select().from(schema.employerReports);
  const byEmployer = new Map<string, { total: number; serious: number; themes: Set<string> }>();
  for (const r of reports) {
    const k = employerKey(r.employer);
    const e = byEmployer.get(k) ?? { total: 0, serious: 0, themes: new Set<string>() };
    e.total += 1;
    if (r.severity === 'serious') e.serious += 1;
    e.themes.add(r.category);
    byEmployer.set(k, e);
  }

  const openings = rows
    .map((o) => {
      const rep = byEmployer.get(employerKey(o.employer));
      const rated = rep && rep.total >= 3;
      const rating = rated ? Math.max(1, Math.min(5, 4 - rep!.serious * 1.5 - (rep!.total - rep!.serious) * 0.5)) : null;
      const near = prefer && findCity(o.city)?.name === prefer.name;
      const need = parseCefr(o.germanLevel);
      const have = proven ?? claimed;
      const langGap = need ? Math.max(0, cefrIndex(need) - cefrIndex(have)) : 0;
      return {
        id: o.id,
        title: o.title,
        subtitle: `${o.employer} · ${o.city}`,
        url: '',
        kind: 'opening' as const,
        why: [
          near ? `Near ${family.relation ? `your ${family.relation} in ` : ''}${prefer!.name}` : null,
          need ? `Needs German ${need}${langGap ? ` (${langGap} level${langGap > 1 ? 's' : ''} to go)` : ''}` : null,
          `Start ${o.startDate}`,
          rated && rating! < 3 ? `${rep!.total} people have reported this employer to us about ${[...rep!.themes].join(' and ')}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        near,
        /** Null below three reports: one person's bad week is not a rating. */
        employerRating: rating === null ? null : Math.round(rating * 10) / 10,
        reports: rep?.total ?? 0,
        shortlisted: kit.state.shortlist.some((s) => s.refId === o.id),
      };
    })
    // A poorly rated employer drops below the others rather than disappearing: staff may still have
    // a reason to use it, and silently hiding a vacancy would be its own kind of dishonesty.
    .sort((a, b) => Number((b.employerRating ?? 4) >= 3) - Number((a.employerRating ?? 4) >= 3) || Number(b.near) - Number(a.near));
  const was = route === 'nursing' ? 'Pflegefachkraft' : route === 'ausbildung' ? 'Ausbildung' : bestFact(kit.state, 'education.highest')?.value.split(/[ ,]/)[0] ?? 'Fachkraft';
  const pub = await kit.web.jobSearch(was, prefer?.name ?? 'Köln', { runId: kit.runId, applicantId: kit.applicantId });
  return {
    summary: `Jobs: ${openings.length} Educaro openings, ${pub.length} public listings${prefer ? ` near ${prefer.name}` : ''}`,
    output: { openings, public: pub.slice(0, 5), preferCity: prefer?.name ?? null },
  };
}

/** Fact-checker: re-opens every cited link and rejects claims the page no longer supports. */
export async function factcheckSpecialist(kit: Kit): Promise<SpecialistResult> {
  const webFacts = kit.state.facts.filter((f) => f.tag === 'web' && f.sourceUrl && f.quote);
  const changed: { key: string; url: string; quote: string }[] = [];
  let ok = 0;
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  for (const f of webFacts) {
    const page = await kit.web.fetchPage(f.sourceUrl!, { runId: kit.runId, applicantId: kit.applicantId }, { fresh: true });
    if (page && squash(page.text).includes(squash(f.quote!))) ok++;
    else {
      changed.push({ key: f.key, url: f.sourceUrl!, quote: f.quote! });
      await db.update(schema.facts).set({ tag: 'ai', value: `${f.value} (the source changed: needs a re-check)` }).where(eq(schema.facts.id, f.id));
    }
  }
  return { summary: `Fact-check: ${ok} of ${webFacts.length} sources still support their claims`, output: { checked: webFacts.length, ok, changed } };
}
