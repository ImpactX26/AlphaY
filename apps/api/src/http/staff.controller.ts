import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type {
  ApplicantDTO,
  ApprovalDTO,
  BatchPlanDTO,
  BriefDTO,
  BroadcastDTO,
  CopilotResultDTO,
  MailTrackerDetailDTO,
  MailTrackerItemDTO,
  MatchDTO,
  OpeningDTO,
  OpeningInput,
  PipelineCardDTO,
  StaffQueueItemDTO,
  StatsDTO,
  TraceDTO,
} from '@educaro/shared';
import { Roles } from '../auth/auth.guard';
import { MailService } from '../outbound/mail.service';
import { toApprovalDTO } from '../outbound/approvals.service';
import { toApplicantDTO } from './applicant.controller';
import { StaffService } from './staff.service';
import { DiscordService } from '../discord/discord.service';

@Roles('staff')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly mail: MailService,
    private readonly discord: DiscordService,
  ) {}

  @Get('pipeline')
  pipeline(): Promise<PipelineCardDTO[]> {
    return this.staff.pipeline();
  }

  @Post('applicants/:id/stage')
  stage(@Param('id') id: string, @Body() b: { stage: PipelineCardDTO['stage']; reason?: string }): Promise<PipelineCardDTO> {
    return this.staff.setStage(id, b.stage, b.reason ?? '');
  }

  @Post('applicants/:id/approve-submission')
  async approveSubmission(@Param('id') id: string): Promise<ApplicantDTO> {
    return toApplicantDTO(await this.staff.approveSubmission(id));
  }

  @Post('applicants/:id/settings')
  async settings(@Param('id') id: string, @Body() b: { staffSecondKey: boolean }): Promise<ApplicantDTO> {
    return toApplicantDTO(await this.staff.settings(id, Boolean(b?.staffSecondKey)));
  }

  @Get('applicants/:id/brief')
  brief(@Param('id') id: string): Promise<BriefDTO> {
    return this.staff.brief(id);
  }

  @Post('applicants/:id/consultant')
  consultant(@Param('id') id: string, @Body() b: { when?: string }): Promise<BriefDTO> {
    return this.staff.bookConsultant(id, b?.when);
  }

  @Get('queue')
  queue(): Promise<StaffQueueItemDTO[]> {
    return this.staff.queue();
  }

  @Post('copilot')
  copilot(@Body() b: { query: string }): Promise<CopilotResultDTO> {
    return this.staff.copilot(String(b?.query ?? ''));
  }

  @Get('openings')
  openings(): Promise<OpeningDTO[]> {
    return this.staff.openings();
  }

  @Post('openings')
  createOpening(@Body() b: OpeningInput): Promise<OpeningDTO> {
    return this.staff.createOpening(b);
  }

  @Post('openings/:openingId/match')
  match(@Param('openingId') id: string): Promise<MatchDTO[]> {
    return this.staff.match(id);
  }

  @Get('openings/:openingId/matches')
  matches(@Param('openingId') id: string): Promise<MatchDTO[]> {
    return this.staff.matches(id);
  }

  @Post('matches/:matchId/profile')
  profile(@Param('matchId') id: string): Promise<MatchDTO> {
    return this.staff.profile(id);
  }

  @Post('matches/:matchId/send')
  async send(@Param('matchId') id: string): Promise<ApprovalDTO> {
    return toApprovalDTO(await this.staff.sendMatch(id));
  }

  @Get('batch-planner')
  batchPlanner(): Promise<BatchPlanDTO> {
    return this.staff.batchPlanner();
  }

  @Get('broadcasts')
  broadcasts(): Promise<BroadcastDTO[]> {
    return this.staff.broadcasts();
  }

  @Post('broadcasts')
  createBroadcast(@Body() b: { topic: string }): Promise<BroadcastDTO> {
    return this.staff.createBroadcast(String(b?.topic ?? 'Update on your plan'));
  }

  @Post('broadcasts/:id/approve')
  approveBroadcast(@Param('id') id: string): Promise<BroadcastDTO> {
    return this.staff.approveBroadcast(id);
  }

  @Get('trace')
  trace(@Query('applicantId') applicantId?: string, @Query('limit') limit?: string): Promise<TraceDTO[]> {
    return this.staff.traceLog(applicantId || undefined, Number(limit) || 200) as Promise<TraceDTO[]>;
  }

  @Get('mail-tracker')
  mailTracker(@Query('applicantId') applicantId?: string, @Query('limit') limit?: string): Promise<MailTrackerItemDTO[]> {
    return this.staff.mailTracker(applicantId || undefined, Number(limit) || 100);
  }

  @Get('mail-tracker/:mailpitId')
  mailTrackerDetail(@Param('mailpitId') id: string): Promise<MailTrackerDetailDTO> {
    return this.staff.mailTrackerDetail(id);
  }

  @Get('stats')
  stats(): Promise<StatsDTO> {
    return this.staff.stats();
  }

  /** Posts the cohort links into the Discord channel, and optionally an announcement with them. */
  @Post('discord/links')
  async discordLinks(@Body() b: { announce?: string }) {
    const posted = await this.discord.postCohortLinks();
    if (b?.announce) await this.discord.announce(b.announce);
    return { ok: true as const, posted, connected: this.discord.ready };
  }

  /** Demo helper: pretend the employer or university answered. */
  @Post('simulate-reply')
  async simulateReply(@Body() b: { applicantId: string; kind: 'interview' | 'missing_paper' | 'rejection' }) {
    await this.mail.simulateReply(b.applicantId, b.kind ?? 'interview');
    return { ok: true as const };
  }
}
