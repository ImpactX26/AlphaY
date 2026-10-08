import { Controller, Get, Param } from '@nestjs/common';
import type { CohortDTO } from '@educaro/shared';
import { assertAccess, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { cohortFor } from '../agent/cohort';

/** "People like you": anonymised peers on the same route, and how long each step took them. */
@Controller('applicants')
export class InsightController {
  @Get(':id/cohort')
  cohort(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<CohortDTO> {
    assertAccess(user, id);
    return cohortFor(id);
  }
}
