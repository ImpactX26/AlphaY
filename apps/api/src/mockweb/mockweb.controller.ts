import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { config } from '../config';
import { MOCK_PAGES, PAGE_BY_SLUG, renderPage } from './pages';

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

  @Public()
  @Get(':slug')
  @Header('content-type', 'text/html; charset=utf-8')
  page(@Param('slug') slug: string): string {
    const p = PAGE_BY_SLUG.get(slug);
    if (!p) throw new NotFoundException();
    return renderPage(p, config.apiUrl);
  }
}
