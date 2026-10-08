import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { assertAccess, CurrentUser, Roles } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { GroupsService } from './groups.service';

/**
 * Flat-shares and travel groups.
 *
 * Every write is scoped to the signed-in applicant rather than taking an id from the body: the one
 * thing that must not be possible here is putting somebody in a group they did not agree to, and
 * the simplest way to guarantee that is never to accept "who" from the caller for a decision.
 */
@Controller()
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get('applicants/:id/groups')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertAccess(user, id);
    return this.groups.forApplicant(id);
  }

  @Post('applicants/:id/groups')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() b: { kind?: 'flat_share' | 'travel'; city?: string; month?: string; district?: string; seats?: number; budgetEachEur?: number; fromCity?: string; note?: string; invite?: string[] },
  ) {
    assertAccess(user, id);
    return this.groups.create(id, b ?? {});
  }

  /** "I'd like to share with X" in one call: reuse or start a group, then ask them. */
  @Post('applicants/:id/groups/propose')
  propose(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() b: { who: string; kind?: 'flat_share' | 'travel' }) {
    assertAccess(user, id);
    return this.groups.proposeShare(id, String(b?.who ?? ''), { kind: b?.kind });
  }

  @Post('applicants/:id/groups/:groupId/invite')
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('groupId') groupId: string, @Body() b: { who: string }) {
    assertAccess(user, id);
    return this.groups.invite(id, groupId, String(b?.who ?? ''));
  }

  @Post('applicants/:id/groups/:groupId/request')
  request(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('groupId') groupId: string) {
    assertAccess(user, id);
    return this.groups.request(id, groupId);
  }

  /** The only thing that makes somebody a member. */
  @Post('applicants/:id/groups/:groupId/respond')
  respond(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('groupId') groupId: string, @Body() b: { accept: boolean }) {
    assertAccess(user, id);
    return this.groups.respond(id, groupId, b?.accept !== false);
  }

  @Delete('applicants/:id/groups/:groupId')
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('groupId') groupId: string) {
    assertAccess(user, id);
    return this.groups.leave(id, groupId);
  }

  /** Staff: who is still arriving alone. */
  @Roles('staff')
  @Get('staff/groups')
  all() {
    return this.groups.all();
  }
}
