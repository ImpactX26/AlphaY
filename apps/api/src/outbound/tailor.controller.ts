import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { assertAccess, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { TailorService } from './tailor.service';

/** A CV written for one target, and the email that carries it. Nothing sends without an approval. */
@Controller()
export class TailorController {
  constructor(private readonly tailor: TailorService) {}

  /** How well this applicant matches what the target's page actually asks for. */
  @Get('applicants/:id/tailor')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('shortlistId') shortlistId: string) {
    assertAccess(user, id);
    return this.tailor.report(id, shortlistId);
  }

  /**
   * Build the tailored CV and put the email in front of a human.
   *
   * Returns an approval, never a sent message: this one carries an attachment with their name on it
   * to an address they will be judged by, so the human tap matters more here than anywhere.
   */
  @Post('applicants/:id/tailor')
  draft(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: { shortlistId: string; to?: string; subject?: string; note?: string }) {
    assertAccess(user, id);
    return this.tailor.draft(id, { shortlistId: String(b?.shortlistId ?? ''), to: b?.to, subject: b?.subject, note: b?.note });
  }
}
