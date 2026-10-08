import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';

/**
 * Files on disk, under `config.storageDir`.
 *
 * Rows store the **relative** path (`<applicantId>/<uuid>-<name>`), never an absolute one, so the
 * database stays portable between machines; `abs()` resolves it when something needs to read bytes.
 */
@Injectable()
export class StorageService {
  /** `a/b.pdf` -> `<storageDir>/a/b.pdf`, and an absolute path is returned untouched. */
  abs(relPath: string): string {
    return path.isAbsolute(relPath) ? relPath : path.join(config.storageDir, relPath);
  }

  /** Writes an upload and returns its relative path. The uuid keeps same-named uploads apart. */
  async save(applicantId: string, originalName: string, bytes: Buffer | Uint8Array): Promise<string> {
    return this.write(applicantId, `${randomUUID()}-${safeName(originalName)}`, bytes);
  }

  /**
   * Writes something the system produced itself (a seeded script, a generated PDF) under a
   * predictable name, so re-running a seed overwrites instead of piling up copies.
   */
  async writeGenerated(applicantId: string, name: string, content: string | Buffer | Uint8Array): Promise<string> {
    const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    return this.write(applicantId, safeName(name), bytes);
  }

  /** The bytes behind a relative path, for mail attachments and re-reads. */
  async read(relPath: string): Promise<Buffer> {
    return fs.readFile(this.abs(relPath));
  }

  private async write(applicantId: string, fileName: string, bytes: Buffer | Uint8Array): Promise<string> {
    const dir = safeName(applicantId);
    await fs.mkdir(path.join(config.storageDir, dir), { recursive: true });
    const rel = path.posix.join(dir, fileName);
    await fs.writeFile(this.abs(rel), bytes);
    return rel;
  }
}

/** Keeps a caller's name from escaping the directory or upsetting the filesystem. */
function safeName(name: string): string {
  return path.basename(name).replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file';
}
