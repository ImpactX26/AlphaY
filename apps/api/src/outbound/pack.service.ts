import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { ROUTE_LABEL, type Route } from '@educaro/shared';
import { monthLabel, parseMonth } from '../knowledge/normalize';
import { ROUTES } from '../knowledge/routes';
import { servicesForRoute } from '../knowledge/services';
import { GuardsService } from '../agent/guards.service';
import { bestFact, type ApplicantState } from '../agent/state.service';
import type { TailorReport } from '../knowledge/keywords';
import { db, schema } from '../db/db';
import { StorageService } from '../storage/storage.service';
import type { CheckReport } from '../agent/checks';

/** Helvetica covers Latin-1 and €, but not ₹ or arrows. */
const clean = (s: string) => s.replace(/₹\s?/g, 'INR ').replace(/[→⇒]/g, '->').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x00-\xFF€–—•]/g, '');

interface CvData {
  name: string;
  contact: string[];
  experience: { when: string; title: string; place: string; tag: string }[];
  education: { when: string; title: string; place: string; tag: string }[];
  languages: { name: string; level: string; tag: string }[];
  skills: string;
}

/** Final pack and Lebenslauf, PDF and DOCX. CV content uses only Verified and You-said facts (guard 3). */
@Injectable()
export class PackService {
  constructor(
    private readonly guards: GuardsService,
    private readonly storage: StorageService,
  ) {}

  cvData(st: ApplicantState): CvData {
    const facts = this.guards.writerFacts(st.facts).filter((f) => !(f.data as any)?.sensitive);
    const tagOf = (t: string) => (t === 'verified' ? 'verified' : 'self-declared');
    const exp = new Map<string, CvData['experience'][number]>();
    for (const f of facts.filter((x) => x.key.startsWith('experience.') && x.key !== 'experience.total')) {
      const best = bestFact({ facts }, f.key)!;
      const d = (best.data ?? {}) as any;
      exp.set(f.key, {
        when: `${monthLabel(parseMonth(d.start))} – ${d.end && !/present/i.test(d.end) ? monthLabel(parseMonth(d.end)) : 'today'}`,
        title: d.role ?? 'Professional',
        place: d.employer ?? best.label.replace(/^Experience,\s*/, ''),
        tag: tagOf(best.tag),
      });
    }
    const edu: CvData['education'] = [];
    const hi = bestFact({ facts }, 'education.highest');
    if (hi) edu.push({ when: String((hi.data as any)?.year ?? ''), title: hi.value, place: String((hi.data as any)?.institution ?? ''), tag: tagOf(hi.tag) });
    for (const k of ['education.class12', 'education.class10']) {
      const f = bestFact({ facts }, k);
      if (f) edu.push({ when: '', title: `${f.label}: ${f.value}`, place: '', tag: tagOf(f.tag) });
    }
    const langs: CvData['languages'] = [{ name: 'Malayalam / Hindi / English', level: 'fluent', tag: 'self-declared' }];
    for (const k of ['language.german', 'language.english']) {
      const f = bestFact({ facts }, k);
      if (f) langs.push({ name: k.endsWith('german') ? 'German' : 'English', level: f.value, tag: tagOf(f.tag) });
    }
    return {
      name: st.applicant.name,
      contact: [st.applicant.homeCity ?? '', st.applicant.email ?? ''].filter(Boolean),
      experience: [...exp.values()],
      education: edu,
      languages: langs.slice(1).length ? langs.slice(1) : langs,
      skills: bestFact({ facts }, 'profile.skills')?.value ?? '',
    };
  }

  /**
   * The Lebenslauf, optionally written for one particular target.
   *
   * Tailoring is selection and ordering, never addition. A profile line names the overlap between
   * what their page asks for and what this applicant can evidence, and the skills section leads
   * with the matched terms — but a keyword they cannot back with a document or a statement never
   * appears, whatever the target wants. The person who has to defend this CV is sitting an
   * interview in their third language.
   */
  async lebenslaufPdf(st: ApplicantState, tailor?: { target: string; report: TailorReport }): Promise<Buffer> {
    const cv = this.cvData(st);
    const matched = tailor?.report.matches.filter((m) => m.have) ?? [];
    return pdf((doc) => {
      doc.font('Helvetica-Bold').fontSize(22).text('Lebenslauf');
      doc.moveDown(0.3).font('Helvetica').fontSize(13).text(clean(cv.name));
      doc.fontSize(9).fillColor('#586174').text(clean(cv.contact.join(' · ')));
      doc.fillColor('#000');
      if (tailor && matched.length) {
        section(doc, 'Profil');
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            clean(
              `Application for ${tailor.target}. Evidenced against their stated requirements: ${matched
                .slice(0, 8)
                .map((m) => m.term)
                .join(', ')}.`,
            ),
          );
      }
      section(doc, 'Berufserfahrung');
      for (const e of cv.experience) row(doc, e.when, `${e.title}, ${e.place}`, e.tag);
      section(doc, 'Ausbildung');
      for (const e of cv.education) row(doc, e.when, `${e.title}${e.place ? `, ${e.place}` : ''}`, e.tag);
      section(doc, 'Sprachkenntnisse');
      for (const l of cv.languages) row(doc, l.name, l.level, l.tag);
      if (cv.skills || matched.length) {
        section(doc, 'Kenntnisse');
        // Matched terms lead, each marked with how it is backed, so a reader can ask about any of
        // them and get an answer. The applicant's own list follows, unchanged.
        if (matched.length) {
          for (const m of matched.slice(0, 10)) row(doc, m.term, m.evidence ?? 'on file', m.tag === 'verified' ? 'verified' : 'self-declared');
        }
        if (cv.skills) doc.font('Helvetica').fontSize(10).text(clean(cv.skills));
      }
      doc
        .moveDown(1.5)
        .fontSize(8)
        .fillColor('#586174')
        .text(
          tailor
            ? `Built by the Educaro agent from verified documents and the applicant’s own statements only, and written for ${clean(tailor.target)}. Nothing on this page is claimed without a source.`
            : 'Built by the Educaro agent from verified documents and the applicant’s own statements only.',
        );
    });
  }

  /** Keep a generated document as a file on the applicant, so mail can attach it by id. */
  async store(applicantId: string, name: string, bytes: Buffer): Promise<{ id: string; path: string }> {
    const path = await this.storage.writeGenerated(applicantId, name, bytes);
    const [row] = await db
      .insert(schema.files)
      .values({
        applicantId,
        originalName: name,
        mime: 'application/pdf',
        size: bytes.length,
        storagePath: path,
        kind: 'generated',
        kindLabel: 'Tailored Lebenslauf',
        status: 'done',
      })
      .returning();
    return { id: row.id, path };
  }

  async lebenslaufDocx(st: ApplicantState): Promise<Buffer> {
    const cv = this.cvData(st);
    const p = (t: string, opts: { bold?: boolean; size?: number } = {}) => new Paragraph({ children: [new TextRun({ text: t, bold: opts.bold, size: opts.size })] });
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: 'Lebenslauf', heading: HeadingLevel.TITLE }),
            p(cv.name, { bold: true, size: 28 }),
            p(cv.contact.join(' · ')),
            new Paragraph({ text: 'Berufserfahrung', heading: HeadingLevel.HEADING_1 }),
            ...cv.experience.map((e) => p(`${e.when}   ${e.title}, ${e.place}  (${e.tag})`)),
            new Paragraph({ text: 'Ausbildung', heading: HeadingLevel.HEADING_1 }),
            ...cv.education.map((e) => p(`${e.when}   ${e.title}${e.place ? `, ${e.place}` : ''}  (${e.tag})`)),
            new Paragraph({ text: 'Sprachkenntnisse', heading: HeadingLevel.HEADING_1 }),
            ...cv.languages.map((l) => p(`${l.name}: ${l.level}  (${l.tag})`)),
            ...(cv.skills ? [new Paragraph({ text: 'Kenntnisse', heading: HeadingLevel.HEADING_1 }), p(cv.skills)] : []),
          ],
        },
      ],
    });
    return Packer.toBuffer(doc);
  }

  async finalPackPdf(st: ApplicantState, report: CheckReport): Promise<Buffer> {
    const a = st.applicant;
    const route = a.route as Route | null;
    const cvBuf = await this.lebenslaufPdf(st);
    void cvBuf;
    return pdf((doc) => {
      doc.font('Helvetica-Bold').fontSize(20).text('Educaro final pack');
      doc.font('Helvetica').fontSize(12).text(clean(`${a.name} · ${route ? ROUTE_LABEL[route] : 'Route not chosen'}`));
      doc.fontSize(9).fillColor('#586174').text(`Generated ${new Date().toISOString().slice(0, 10)} · Readiness ${report.readiness.overall}% (${report.readiness.outcome.replace(/_/g, ' ')})`);
      doc.fillColor('#000');
      section(doc, 'Profile summary');
      for (const m of report.readiness.meters) row(doc, m.label, `${m.value}%`, '');
      section(doc, 'Truth map');
      for (const r of st.truth.rows) row(doc, r.label, [r.document && `Document: ${r.document}`, r.cv && `CV: ${r.cv}`, r.video && `Video: ${r.video}`].filter(Boolean).join(' | ') || '-', r.status.replace('_', ' '));
      if (route) {
        section(doc, 'Checklist');
        const kinds = new Set(st.files.filter((f) => f.status === 'done').map((f) => f.kind));
        for (const p of ROUTES[route].papers) row(doc, p.label, p.kinds.some((k) => kinds.has(k)) ? 'on file' : 'missing', '');
      }
      section(doc, 'Gap plans');
      if (!report.gaps.length) doc.font('Helvetica').fontSize(10).text('Nothing open.');
      for (const g of report.gaps) {
        doc.font('Helvetica-Bold').fontSize(10).text(clean(g.title));
        doc.font('Helvetica').fontSize(9).text(clean(`${g.what} Where: ${g.where}. How long: ${g.howLong}. Cost: ${g.cost}.`));
        doc.moveDown(0.3);
      }
      for (const s of st.shortlist) {
        const m = s.matrix as any;
        if (!m) continue;
        section(doc, `Requirement matrix: ${s.title}`);
        for (const r of m.rows ?? []) row(doc, r.requirement, `${r.needs} / has: ${r.has}`, r.status);
      }
      const money = st.outputs.money?.output;
      if (money) {
        section(doc, `Budget: ${money.city}`);
        for (const l of money.lines ?? []) row(doc, l.label, `€${l.amount}`, '');
        row(doc, 'Total per month', `€${money.total}`, '');
      }
      if (route) {
        section(doc, 'Educaro services for you');
        for (const s of servicesForRoute(route)) row(doc, s.name, s.url, '');
      }
      section(doc, 'Sources');
      const urls = [...new Set(st.facts.filter((f) => f.sourceUrl).map((f) => `${f.label}: ${f.sourceUrl}`))];
      for (const u of urls) doc.font('Helvetica').fontSize(8).text(clean(u));
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(18).text('Lebenslauf');
      const cv = this.cvData(st);
      doc.font('Helvetica').fontSize(12).text(clean(cv.name));
      for (const e of cv.experience) row(doc, e.when, `${e.title}, ${e.place}`, e.tag);
      for (const e of cv.education) row(doc, e.when, e.title, e.tag);
      for (const l of cv.languages) row(doc, l.name, l.level, l.tag);
    });
  }

  async finalPackDocx(st: ApplicantState, report: CheckReport): Promise<Buffer> {
    const a = st.applicant;
    const route = a.route as Route | null;
    const cell = (t: string) => new TableCell({ children: [new Paragraph(t)], width: { size: 33, type: WidthType.PERCENTAGE } });
    const table = (rows: string[][]) => new Table({ rows: rows.map((r) => new TableRow({ children: r.map(cell) })), width: { size: 100, type: WidthType.PERCENTAGE } });
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: 'Educaro final pack', heading: HeadingLevel.TITLE }),
            new Paragraph(`${a.name} · ${route ? ROUTE_LABEL[route] : 'Route not chosen'} · Readiness ${report.readiness.overall}%`),
            new Paragraph({ text: 'Truth map', heading: HeadingLevel.HEADING_1 }),
            table([['Fact', 'Evidence', 'Result'], ...st.truth.rows.map((r) => [r.label, r.document ?? r.cv ?? r.video ?? '', r.status])]),
            new Paragraph({ text: 'Gap plans', heading: HeadingLevel.HEADING_1 }),
            ...report.gaps.map((g) => new Paragraph(`${g.title}: ${g.what} (${g.howLong}, ${g.cost})`)),
            ...st.shortlist.flatMap((s) =>
              (s.matrix as any)
                ? [new Paragraph({ text: `Requirement matrix: ${s.title}`, heading: HeadingLevel.HEADING_1 }), table([['Requirement', 'Needs', 'Has', 'Status'], ...((s.matrix as any).rows ?? []).map((r: any) => [r.requirement, r.needs, r.has, r.status])])]
                : [],
            ),
            new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_1 }),
            ...[...new Set(st.facts.filter((f) => f.sourceUrl).map((f) => `${f.label}: ${f.sourceUrl}`))].map((u) => new Paragraph(u)),
          ],
        },
      ],
    });
    return Packer.toBuffer(doc);
  }
}

function pdf(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor('#151a24').text(clean(title));
  doc.moveTo(doc.x, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#d3d9e2').stroke();
  doc.moveDown(0.4);
}

function row(doc: PDFKit.PDFDocument, left: string, right: string, tag: string) {
  const y = doc.y;
  doc.font('Helvetica').fontSize(9).fillColor('#586174').text(clean(left || ''), 50, y, { width: 130 });
  const yl = doc.y;
  doc.fillColor('#151a24').text(clean(right || ''), 190, y, { width: tag ? 270 : 355 });
  const yr = doc.y;
  if (tag) doc.fillColor('#586174').fontSize(8).text(clean(tag), 470, y, { width: 75 });
  doc.fillColor('#000');
  doc.y = Math.max(yl, yr, doc.y) + 3;
  doc.x = 50;
}
