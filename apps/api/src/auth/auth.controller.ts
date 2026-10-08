import { BadRequestException, Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { AuthResponse, DemoPersona, MeDTO } from '@educaro/shared';
import { config } from '../config';
import { db, schema } from '../db/db';
import { AgentEventsService } from '../agent/events.service';
import { CurrentUser, Public } from './auth.guard';
import { signToken, type AuthUser } from './jwt';

type UserRow = typeof schema.users.$inferSelect;

/** Persona emails use the team mailbox with plus-addressing when it is configured, so notifications really arrive. */
export function personaEmail(tag: string): string {
  if (config.smtpUser) {
    const [l, d] = config.smtpUser.split('@');
    return `${l}+${tag}@${d}`;
  }
  return `${tag}@demo.educaro.local`;
}

export const DEMO_EMAILS: Record<Exclude<DemoPersona, 'fresh'>, string> = {
  ananya: 'ananya@demo.educaro.local',
  rohan: 'rohan@demo.educaro.local',
  staff: 'staff@demo.educaro.local',
};

async function authResponse(u: UserRow): Promise<AuthResponse> {
  const applicant = u.role === 'applicant' ? await db.query.applicants.findFirst({ where: eq(schema.applicants.userId, u.id) }) : null;
  const me: AuthUser = { userId: u.id, role: u.role, name: u.name, email: u.email, applicantId: applicant?.id ?? null };
  return { token: signToken(me), user: me };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly events: AgentEventsService) {}

  @Public()
  @Post('register')
  async register(@Body() b: { email: string; password: string; name: string }): Promise<AuthResponse> {
    if (!b?.email || !b?.password || b.password.length < 6 || !b?.name) throw new BadRequestException('Name, email and a password of 6+ characters are required');
    const exists = await db.query.users.findFirst({ where: eq(schema.users.email, b.email.toLowerCase()) });
    if (exists) throw new BadRequestException('An account with this email already exists');
    const [u] = await db.insert(schema.users).values({ email: b.email.toLowerCase(), passwordHash: await bcrypt.hash(b.password, 8), role: 'applicant', name: b.name }).returning();
    const [a] = await db.insert(schema.applicants).values({ userId: u.id, name: b.name, email: b.email.toLowerCase() }).returning();
    await this.events.wake(a.id, { type: 'route_set', detail: { created: true } }, 100);
    return authResponse(u);
  }

  @Public()
  @Post('login')
  async login(@Body() b: { email: string; password: string }): Promise<AuthResponse> {
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, String(b?.email ?? '').toLowerCase()) });
    if (!u || !(await bcrypt.compare(String(b?.password ?? ''), u.passwordHash))) throw new UnauthorizedException('Wrong email or password');
    return authResponse(u);
  }

  /** One-click demo logins. `fresh` creates a brand-new, empty Ananya for the live upload. */
  @Public()
  @Post('demo')
  async demo(@Body() b: { persona: DemoPersona }): Promise<AuthResponse> {
    if (b?.persona === 'fresh') {
      const stamp = Date.now().toString(36);
      const [u] = await db
        .insert(schema.users)
        .values({ email: `ananya.${stamp}@demo.educaro.local`, passwordHash: await bcrypt.hash(stamp, 4), role: 'applicant', name: 'Ananya Nair' })
        .returning();
      await db.insert(schema.applicants).values({ userId: u.id, name: 'Ananya Nair', email: personaEmail(`ananya-${stamp}`) });
      return authResponse(u);
    }
    const email = DEMO_EMAILS[b?.persona as Exclude<DemoPersona, 'fresh'>];
    if (!email) throw new BadRequestException('Unknown persona');
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!u) throw new BadRequestException('Demo data not seeded yet: run npm run seed');
    return authResponse(u);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): MeDTO {
    return user;
  }
}
