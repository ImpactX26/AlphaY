import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** Skills are short instruction packs (rules, sources to trust, pitfalls), loaded per applicant's route. */
@Injectable()
export class SkillsService {
  private cache = new Map<string, string>();
  private readonly dir = path.resolve(__dirname, '..', 'skills');

  async load(name: string): Promise<string> {
    if (this.cache.has(name)) return this.cache.get(name)!;
    try {
      const text = await fs.readFile(path.join(this.dir, `${name}.md`), 'utf8');
      this.cache.set(name, text);
      return text;
    } catch {
      return '';
    }
  }

  async list(): Promise<string[]> {
    try {
      return (await fs.readdir(this.dir)).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
    } catch {
      return [];
    }
  }
}
