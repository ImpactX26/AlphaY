import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { CommunityPostDTO } from '@educaro/shared';
import { CurrentUser, Roles } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt';
import { CommunityService, DEFAULT_CHANNEL } from './community.service';
import { AnnouncementsService } from './announcements.service';

/** The cohort thread. Everyone signed in can read it and post to it. */
@Controller('community')
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly announcements_: AnnouncementsService,
  ) {}

  @Get()
  list(@Query('channel') channel?: string, @Query('limit') limit?: string): Promise<CommunityPostDTO[]> {
    return this.community.list(channel || DEFAULT_CHANNEL, Number(limit) || 50);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() b: { text: string; applicantId?: string }): Promise<CommunityPostDTO> {
    return this.community.post({
      text: String(b?.text ?? ''),
      applicantId: b?.applicantId ?? user.applicantId,
      author: user.role === 'staff' ? user.name : undefined,
      authorKind: user.role === 'staff' ? 'staff' : 'applicant',
    });
  }

  /** The feed: new programmes, live German job openings and deadlines closing soon. */
  @Get('announcements')
  announcements(@Query('limit') limit?: string) {
    return this.announcements_.list(Number(limit) || 40);
  }

  @Roles('staff')
  @Post('announcements/publish')
  publish(@Body() b: { limit?: number }) {
    return this.announcements_.publish(Number(b?.limit) || 12);
  }

  @Post(':postId/reply')
  reply(@CurrentUser() user: AuthUser, @Param('postId') postId: string, @Body() b: { text: string }): Promise<CommunityPostDTO> {
    return this.community.reply(postId, {
      text: String(b?.text ?? ''),
      applicantId: user.applicantId,
      author: user.role === 'staff' ? user.name : undefined,
      authorKind: user.role === 'staff' ? 'staff' : 'applicant',
    });
  }
}
