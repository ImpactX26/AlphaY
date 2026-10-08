import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/auth.guard';
import { WatchService } from './watch.service';

/**
 * The admin panel's source list.
 *
 * Staff-only throughout: this is where somebody decides which pages the product treats as the law,
 * and an applicant changing that list would change what everyone else is measured against.
 */
@Roles('staff')
@Controller('staff/watch')
export class WatchController {
  constructor(private readonly watch: WatchService) {}

  @Get()
  list() {
    return this.watch.list();
  }

  @Post()
  add(@Body() b: { kind?: 'university' | 'government' | 'employer'; label: string; url: string; route?: string; intervalMinutes?: number }) {
    return this.watch.add({ kind: b?.kind, label: String(b?.label ?? ''), url: String(b?.url ?? ''), route: b?.route, intervalMinutes: b?.intervalMinutes });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.watch.remove(id);
  }

  @Post(':id/active')
  setActive(@Param('id') id: string, @Body() b: { active: boolean }) {
    return this.watch.setActive(id, b?.active !== false);
  }

  /** Read this page now and tell whoever it moved for. */
  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.watch.check(id, { notify: true });
  }

  @Post('check-all')
  checkAll() {
    return this.watch.checkAll();
  }

  /** Demo only: move a stand-in page to its next version so a change can be seen happening. */
  @Post(':id/simulate')
  simulate(@Param('id') id: string) {
    return this.watch.simulateUpdate(id);
  }
}
