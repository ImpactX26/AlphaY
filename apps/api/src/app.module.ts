import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { BusService } from './common/bus.service';
import { QueueService } from './queue/queue.service';
import { StorageService } from './storage/storage.service';
import { MediaService } from './media/media.service';
import { LlmService } from './llm/llm.service';
import { TraceService } from './trace/trace.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { WebService } from './web/web.service';

import { FactsService } from './profile/facts.service';
import { QuestionsService } from './profile/questions.service';
import { ChatService } from './profile/chat.service';
import { RetrievalService } from './profile/retrieval.service';

import { IngestService } from './ingest/ingest.service';

import { GuardsService } from './agent/guards.service';
import { StateService } from './agent/state.service';
import { SkillsService } from './agent/skills.service';
import { SupervisorService } from './agent/supervisor.service';
import { SpecialistsService } from './agent/specialists/specialists.service';
import { ComposerService } from './agent/composer.service';
import { ShortlistService } from './agent/shortlist.service';
import { AgentEventsService } from './agent/events.service';
import { ActionsService } from './agent/actions.service';
import { AgentLoopService } from './agent/loop.service';
import { InterviewService } from './agent/interview.service';
import { TimersService } from './agent/timers.service';

import { MailService } from './outbound/mail.service';
import { CalendarService } from './outbound/calendar.service';
import { WriterService } from './outbound/writer.service';
import { PackService } from './outbound/pack.service';
import { ApprovalsService } from './outbound/approvals.service';

import { ApplicantController } from './http/applicant.controller';
import { StaffController } from './http/staff.controller';
import { StaffService } from './http/staff.service';
import { SystemController } from './http/system.controller';
import { MockWebController } from './mockweb/mockweb.controller';
import { DiscordService } from './discord/discord.service';
import { CallController } from './http/call.controller';
import { McpController } from './mcp/mcp.controller';
import { McpService } from './mcp/mcp.service';
import { McpClientService } from './mcp/mcp-client.service';
import { CommunityController } from './community/community.controller';
import { CommunityService } from './community/community.service';
import { AnnouncementsService } from './community/announcements.service';
import { GroupsController } from './community/groups.controller';
import { GroupsService } from './community/groups.service';
import { WatchController } from './watch/watch.controller';
import { WatchService } from './watch/watch.service';
import { InsightController } from './community/insight.controller';
import { SafetyController } from './safety/safety.controller';
import { SafetyService } from './safety/safety.service';

/**
 * One module. Everything is a singleton and the services already know each other by constructor
 * injection, so wiring stays in one readable list rather than a tree of feature modules.
 */
@Module({
  controllers: [AuthController, ApplicantController, StaffController, SystemController, MockWebController, CallController, McpController, CommunityController, GroupsController, InsightController, SafetyController, WatchController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    BusService,
    QueueService,
    StorageService,
    MediaService,
    LlmService,
    TraceService,
    RealtimeGateway,
    WebService,

    FactsService,
    QuestionsService,
    ChatService,
    RetrievalService,

    IngestService,

    GuardsService,
    StateService,
    SkillsService,
    SupervisorService,
    SpecialistsService,
    ComposerService,
    ShortlistService,
    AgentEventsService,
    ActionsService,
    AgentLoopService,
    InterviewService,
    TimersService,

    MailService,
    CalendarService,
    WriterService,
    PackService,
    ApprovalsService,

    StaffService,
    McpService,
    McpClientService,
    CommunityService,
    AnnouncementsService,
    GroupsService,
    WatchService,
    SafetyService,
    DiscordService,
  ],
})
export class AppModule {}
