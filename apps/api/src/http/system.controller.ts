import { Controller, Get } from '@nestjs/common';
import type { SystemStatusDTO } from '@educaro/shared';
import { config } from '../config';
import { LlmService } from '../llm/llm.service';
import { Public } from './auth.guard';

/**
 * The web app calls this before sign-in to tell "API is up" from "API is down",
 * and the staff command centre reads the LLM budget meter from it.
 */
@Controller('system')
export class SystemController {
  constructor(private readonly llm: LlmService) {}

  @Public()
  @Get('status')
  status(): SystemStatusDTO {
    return {
      llm: this.llm.status(),
      discord: !!config.discordToken,
      mailpitUrl: config.mailpitUrl,
    };
  }
}
