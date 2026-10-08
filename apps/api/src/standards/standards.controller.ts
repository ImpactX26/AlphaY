import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { StandardRule } from '../knowledge/standards';
import { assertAccess, CurrentUser, Roles } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { StandardsService } from './standards.service';

/**
 * The admin panel's document standards.
 *
 * Reading them is staff-only, because the list is what the product treats as the bar and an
 * applicant editing it would change what everyone else is measured against. Re-checking your own
 * documents is not: that is just asking the question again.
 */
@Controller()
export class StandardsController {
  constructor(private readonly standards: StandardsService) {}

  @Roles('staff')
  @Get('staff/standards')
  list() {
    return this.standards.list();
  }

  @Roles('staff')
  @Patch('staff/standards/:id')
  update(@Param('id') id: string, @Body() b: { authority?: string; active?: boolean; rules?: StandardRule[] }) {
    return this.standards.update(id, b ?? {});
  }

  /** Every document on the caseload that will not be accepted as it stands. */
  @Roles('staff')
  @Get('staff/standards/failing')
  failing() {
    return this.standards.failing();
  }

  @Post('applicants/:id/recheck-documents')
  recheck(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertAccess(user, id);
    return this.standards.recheck(id);
  }
}
