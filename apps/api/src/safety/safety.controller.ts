import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { assertAccess, CurrentUser, Roles } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { SafetyService, type CheckRequest } from './safety.service';

/** "Someone sent me this. Is it real?" — and the private channel for when something is wrong. */
@Controller()
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Post('applicants/:id/check')
  check(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: CheckRequest) {
    assertAccess(user, id);
    return this.safety.check(id, { kind: b?.kind ?? 'offer', name: b?.name, url: b?.url, email: b?.email, text: b?.text });
  }

  @Get('applicants/:id/checks')
  history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertAccess(user, id);
    return this.safety.history(id);
  }

  /** Private: it never leaves Educaro, and the employer is never told who sent it. */
  @Post('applicants/:id/report')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: { employer: string; text: string; category?: string; severity?: string }) {
    assertAccess(user, id);
    return this.safety.report(id, b);
  }

  @Roles('staff')
  @Get('staff/employers')
  ratings() {
    return this.safety.employerRatings();
  }

  @Roles('staff')
  @Get('staff/reports')
  reports(@Query('employer') employer?: string) {
    return this.safety.reportsFor(employer || undefined);
  }
}
