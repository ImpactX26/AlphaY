import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import * as fs from 'node:fs';
import { db, schema } from '../db/db';
import type { AuthUser } from '../auth/jwt';
import { assertCanSee, CurrentUser } from './auth.guard';

/**
 * The bytes behind a file link. An <img>, <video> or PDF link cannot send an Authorization
 * header, so the guard also accepts `?token=` for these routes.
 */
@Controller('files')
export class FilesController {
  @Get(':fileId/raw')
  async raw(@CurrentUser() user: AuthUser, @Param('fileId') fileId: string, @Res() res: Response): Promise<void> {
    const [row] = await db.select().from(schema.files).where(eq(schema.files.id, fileId)).limit(1);
    if (!row) throw new NotFoundException('No such file.');
    assertCanSee(user, row.applicantId);
    if (!fs.existsSync(row.storagePath)) throw new NotFoundException('That file is no longer on disk.');

    res.setHeader('Content-Type', row.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.originalName)}"`);
    fs.createReadStream(row.storagePath).pipe(res);
  }
}
