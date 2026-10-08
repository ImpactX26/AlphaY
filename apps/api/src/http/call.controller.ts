import { Controller, Get, Header, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db/db';
import { Public } from '../auth/auth.guard';
import { ActionsService } from '../agent/actions.service';
import { StaffService } from './staff.service';

/**
 * Booking a consultant call, and the call itself.
 *
 * "Book a call" used to be a link to educaro.de, which is the one moment in the whole flow where
 * the product hands the applicant back to a website and loses them. One tap now books a real slot,
 * writes it to their calendar, mails the .ics, and drops them into a working video room with the
 * consultant's brief beside it — the same brief the staff side sees, so nobody repeats themselves.
 */
@Controller()
export class CallController {
  constructor(
    private readonly actions: ActionsService,
    private readonly staff: StaffService,
  ) {}

  /**
   * One tap: book the slot, then land in the room. Linked from the services block.
   *
   * Open by link rather than by bearer token, because this is followed from a plan, from an email
   * and from a calendar invite, where no header is attached. The applicant's id is the capability.
   * A real deployment would hand out a signed single-use link instead; that is a known shortcut.
   */
  @Public()
  @Get('applicants/:id/book-call')
  async book(@Param('id') id: string, @Query('token') token: string, @Res() res: Response) {
    const existing = await db.query.calendarEvents.findMany({ where: eq(schema.calendarEvents.applicantId, id) });
    const already = existing.find((e) => e.title.includes('Educaro consultant') && +e.startsAt > Date.now() - 3_600_000);
    const ev = already ?? (await this.actions.bookConsultant(id, 'Booked by the applicant from their plan.'));
    res.redirect(`${config.apiUrl}/api/call/${ev.id}?token=${encodeURIComponent(token ?? '')}`);
  }

  @Public()
  @Get('call/:eventId')
  @Header('content-type', 'text/html; charset=utf-8')
  async room(@Param('eventId') eventId: string): Promise<string> {
    const ev = await db.query.calendarEvents.findFirst({ where: eq(schema.calendarEvents.id, eventId) });
    if (!ev) throw new NotFoundException();
    const brief = await this.staff.brief(ev.applicantId);
    const room = `educaro-${ev.id.replace(/-/g, '').slice(0, 16)}`;
    const when = ev.startsAt.toUTCString().slice(0, 22);
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">Nothing outstanding.</p>');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Call with your Educaro consultant</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; background: #f1f5f9; }
  header { background: #0f172a; color: #fff; padding: .9rem 1.25rem; display: flex; align-items: center; gap: .9rem; flex-wrap: wrap; }
  header h1 { font-size: 1rem; margin: 0; font-weight: 650; }
  header .when { font-size: .82rem; color: #94a3b8; margin-left: auto; }
  main { display: grid; grid-template-columns: minmax(0,1fr) 23rem; gap: 1rem; padding: 1rem; align-items: start; }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
  .stage { background: #000; border-radius: 12px; overflow: hidden; aspect-ratio: 16/10; }
  .stage iframe { width: 100%; height: 100%; border: 0; display: block; }
  aside { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.1rem; }
  aside h2 { font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin: 1.1rem 0 .4rem; }
  aside h2:first-of-type { margin-top: 0; }
  ul { margin: .2rem 0; padding-left: 1.1rem; }
  li { margin: .25rem 0; }
  .who { font-weight: 650; }
  .muted { color: #94a3b8; }
  footer { padding: 0 1rem 1.5rem; color: #64748b; font-size: .82rem; }
</style>
</head>
<body>
  <header>
    <h1>Call with your Educaro consultant</h1>
    <span class="when">${esc(when)} UTC · 30 minutes</span>
  </header>
  <main>
    <div class="stage">
      <iframe
        src="https://meet.jit.si/${room}#config.prejoinPageEnabled=false&amp;userInfo.displayName=${encodeURIComponent(brief.who.split(' · ')[0])}"
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        title="Video call"></iframe>
    </div>
    <aside>
      <h2>Who you are talking about</h2>
      <p class="who">${esc(brief.who)}</p>
      <p>${esc(brief.route)}</p>
      <h2>Open steps</h2>
      ${list(brief.openGaps)}
      <h2>What the agent already did</h2>
      ${list(brief.agentTried)}
      <h2>Worth asking</h2>
      ${list(brief.questionsToAsk)}
    </aside>
  </main>
  <footer>
    The consultant opens this same page, so they arrive knowing your file — you do not have to tell
    your story again. The room is private to this booking.
  </footer>
</body>
</html>`;
  }
}
