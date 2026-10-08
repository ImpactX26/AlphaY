import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LlmService } from './llm/llm.service';
import { MediaService } from './media/media.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { TraceService } from './trace/trace.service';
import { ApplicantsController } from './http/applicants.controller';
import { AuthController } from './http/auth.controller';
import { AuthGuard } from './http/auth.guard';
import { FilesController } from './http/files.controller';
import { PlanController } from './http/plan.controller';
import { StaffController } from './http/staff.controller';
import { SystemController } from './http/system.controller';

/**
 * Owned by Claude B (see CLAUDE.md "Split inside apps/api").
 *
 * Claude A: to wire a new module of yours in, add it to `imports` — that one line is the only
 * change you need here. Everything else in this file is the HTTP shell.
 */
@Module({
  imports: [],
  controllers: [AuthController, SystemController, ApplicantsController, PlanController, FilesController, StaffController],
  providers: [
    // Claude A's services, shared across the controllers.
    LlmService,
    MediaService,
    TraceService,
    RealtimeGateway,
    // Auth is on by default; routes opt out with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
