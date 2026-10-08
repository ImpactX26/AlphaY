import { BadRequestException, Body, Controller, Get, InternalServerErrorException, Post, UnauthorizedException } from '@nestjs/common';
import type { AuthResponse, DemoPersona, MeDTO } from '@educaro/shared';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { type AuthUser, signToken } from '../auth/jwt';
import { db, schema } from '../db/db';
import { CurrentUser, Public } from './auth.guard';

/** The four one-click demo logins from the spec. */
const PERSONAS: Record<DemoPersona, { email: string; name: string; role: 'applicant' | 'staff' }> = {
  ananya: { email: 'ananya@educaro.local', name: 'Ananya Nair', role: 'applicant' },
  rohan: { email: 'rohan@educaro.local', name: 'Rohan Mehta', role: 'applicant' },
  staff: { email: 'staff@educaro.local', name: 'Educaro staff', role: 'staff' },
  fresh: { email: 'fresh@educaro.local', name: 'New applicant', role: 'applicant' },
};

const me = (u: AuthUser): MeDTO => ({ userId: u.userId, role: u.role, name: u.name, email: u.email, applicantId: u.applicantId });

@Controller()
export class AuthController {
  @Public()
  @Post('auth/register')
  async register(@Body() body: { email?: string; password?: string; name?: string }): Promise<AuthResponse> {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password || !body.name?.trim()) throw new BadRequestException('Name, email and password are all needed.');
    if (body.password.length < 8) throw new BadRequestException('Use at least 8 characters for the password.');

    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing) throw new BadRequestException('That email already has an account. Sign in instead.');

    // Register is always an applicant: staff accounts are seeded, never self-served.
    const [user] = await db
      .insert(schema.users)
      .values({ email, name: body.name.trim(), role: 'applicant', passwordHash: await bcrypt.hash(body.password, 10) })
      .returning();
    const [applicant] = await db.insert(schema.applicants).values({ userId: user.id, name: user.name, email }).returning();

    const authed: AuthUser = { userId: user.id, role: 'applicant', applicantId: applicant.id, name: user.name, email };
    return { token: signToken(authed), user: me(authed) };
  }

  @Public()
  @Post('auth/login')
  async login(@Body() body: { email?: string; password?: string }): Promise<AuthResponse> {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) throw new BadRequestException('Email and password are both needed.');

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    // One message for both cases, so the response never reveals which emails exist.
    const wrong = new UnauthorizedException('That email and password do not match.');
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw wrong;

    const authed = await this.authUserFor(user);
    return { token: signToken(authed), user: me(authed) };
  }

  /**
   * One-click demo login. The personas are seeded by A's `npm run seed`; if a row is not there
   * yet the account is created empty, so the demo buttons never dead-end on a fresh database.
   */
  @Public()
  @Post('auth/demo')
  async demo(@Body() body: { persona?: string }): Promise<AuthResponse> {
    const key = body.persona as DemoPersona | undefined;
    const spec = key ? PERSONAS[key] : undefined;
    if (!spec) throw new BadRequestException('Unknown demo persona.');

    let [user] = await db.select().from(schema.users).where(eq(schema.users.email, spec.email)).limit(1);
    if (!user) {
      [user] = await db
        .insert(schema.users)
        .values({ email: spec.email, name: spec.name, role: spec.role, passwordHash: await bcrypt.hash(`demo-${key}`, 10) })
        .returning();
    }
    // A signed token with undefined claims would fail later, somewhere far less obvious.
    if (!user?.id) throw new InternalServerErrorException('Could not open the demo account. Is the database migrated (npm run db:push)?');

    const authed = await this.authUserFor(user, spec.role === 'applicant');
    return { token: signToken(authed), user: me(authed) };
  }

  @Get('auth/me')
  meRoute(@CurrentUser() user: AuthUser): MeDTO {
    return me(user);
  }

  /** Finds the applicant row behind a user, creating one only for applicant demo logins. */
  private async authUserFor(
    user: { id: string; role: 'applicant' | 'staff' | 'employer'; name: string; email: string },
    createIfMissing = false,
  ): Promise<AuthUser> {
    let applicantId: string | null = null;
    if (user.role === 'applicant') {
      const [row] = await db.select({ id: schema.applicants.id }).from(schema.applicants).where(eq(schema.applicants.userId, user.id)).limit(1);
      applicantId = row?.id ?? null;
      if (!applicantId && createIfMissing) {
        const [made] = await db.insert(schema.applicants).values({ userId: user.id, name: user.name, email: user.email }).returning();
        applicantId = made.id;
      }
    }
    return { userId: user.id, role: user.role, applicantId, name: user.name, email: user.email };
  }
}
