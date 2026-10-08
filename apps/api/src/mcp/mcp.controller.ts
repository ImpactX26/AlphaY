import { All, Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/auth.guard';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcp: McpService) {}

  /** What this server offers, in plain JSON, for anyone wiring a client up. */
  @Public()
  @Get('tools')
  tools() {
    return { server: 'educaro', transport: 'streamable-http', endpoint: '/api/mcp', tools: this.mcp.list() };
  }

  @Public()
  @All()
  handle(@Req() req: Request, @Res() res: Response) {
    return this.mcp.handle(req, res);
  }
}
