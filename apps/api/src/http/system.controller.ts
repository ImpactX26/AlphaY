import { Controller, Get } from '@nestjs/common';
import type { SystemStatusDTO } from '@educaro/shared';
import { Public } from '../auth/auth.guard';
import { StaffService } from './staff.service';

@Controller('system')
export class SystemController {
  constructor(private readonly staff: StaffService) {}

  /** No auth: the web app shows this in the footer so you can see which keys are live. */
  @Public()
  @Get('status')
  status(): SystemStatusDTO {
    return this.staff.systemStatus();
  }
}
