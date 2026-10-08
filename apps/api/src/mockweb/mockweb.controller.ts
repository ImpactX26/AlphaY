import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { config } from '../config';
import { MOCK_PAGES, PAGE_BY_SLUG, renderPage } from './pages';
import { advance, renderWatched, setVersion, versionOf, WATCHED_BY_SLUG, WATCHED_PAGES } from './watched';

/** The demo web, served from the API itself. See pages.ts for why these exist. */
@Controller('mock')
export class MockWebController {
  @Public()
  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  index(): string {
    const links = MOCK_PAGES.map((p) => `<li><a href="${config.apiUrl}/api/mock/${p.slug}">${p.site} — ${p.title}</a></li>`).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Demo web</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem}</style></head>
<body><h1>Demo web</h1><p>Stand-in source pages the agent opens and quotes during the demo.</p><ul>${links}</ul></body></html>`;
  }

  /** The pages the watcher polls. Listed separately: these are the ones that move. */
  @Public()
  @Get('watched')
  @Header('content-type', 'text/html; charset=utf-8')
  watchedIndex(): string {
    const rows = WATCHED_PAGES.map(
      (p) =>
        `<li><a href="${config.apiUrl}/api/mock/watched/${p.slug}">${p.site} — ${p.title}</a> <small>(${p.kind}, serving version ${versionOf(p.slug) + 1} of ${p.versions.length})</small></li>`,
    ).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Watched demo pages</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem}small{color:#666}</style></head>
<body><h1>Watched demo pages</h1><p>Stand-in institution pages that Educaro polls. Each carries two versions so a change can be seen happening.</p><ul>${rows}</ul></body></html>`;
  }

  @Public()
  @Get('watched/:slug')
  @Header('content-type', 'text/html; charset=utf-8')
  watched(@Param('slug') slug: string): string {
    const p = WATCHED_BY_SLUG.get(slug);
    if (!p) throw new NotFoundException();
    return renderWatched(p, config.apiUrl);
  }

  @Public()
  @Get(':slug')
  @Header('content-type', 'text/html; charset=utf-8')
  page(@Param('slug') slug: string): string {
    const p = PAGE_BY_SLUG.get(slug);
    if (!p) throw new NotFoundException();
    return renderPage(p, config.apiUrl);
  }
}
