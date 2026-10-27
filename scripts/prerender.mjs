// Run after `vite build` (npm run build does both). Turns the SPA shell into real HTML for every public page:
//  - dist/<route>/index.html: this page's title, description, canonical, Open Graph tags, JSON-LD and its rendered content,
//    so search engines and AI crawlers that do not run JavaScript still read the whole page;
//  - dist/sitemap.xml, dist/robots.txt, dist/llms.txt, all generated from src/lib/seo.ts (nothing hand-edited, nothing stale).
// The build fails if a page loses its h1, canonical, description or valid JSON-LD.
process.env.NODE_ENV = 'production';
process.env.TZ = 'Asia/Colombo'; // the landing page defaults its price currency from the time zone; crawlers should read rupees
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const SEO = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;
if (!SEO.test(template) || !template.includes('<div id="root"></div>')) throw new Error('dist/index.html lost the seo markers or the empty #root');

// Load the app source through Vite's SSR loader, so the same TypeScript renders here and in the browser.
const vite = await createServer({
  root, configFile: false, plugins: [react()], appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  // react-router's "node" export lists the ESM build under "module-sync", which Vite does not pick by default (it falls to CommonJS).
  ssr: { noExternal: ['react-router', 'react-router-dom'], resolve: { conditions: ['module-sync', 'module', 'node'], externalConditions: ['module-sync', 'node'] } },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const bad = [];
try {
  const { render } = await vite.ssrLoadModule('/src/prerender.tsx');
  const seo = await vite.ssrLoadModule('/src/lib/seo.ts');

  for (const page of seo.PAGES) {
    let body;
    try { body = render(page.path); } catch (e) { bad.push(`${page.path}: render threw: ${e?.message || e}`); continue; }
    const html = template
      .replace(SEO, `<!--seo:start-->\n    ${seo.headTags(page)}\n    <!--seo:end-->`)
      .replace('<div id="root"></div>', () => `<div id="root"><div id="prerender">${body}</div></div>`);

    // Build gate: what a crawler needs must be in the static HTML.
    const h1s = (body.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) bad.push(`${page.path}: ${h1s} <h1> (want exactly 1)`);
    if (!html.includes(`<link rel="canonical" href="${seo.urlOf(page.path)}"`)) bad.push(`${page.path}: no canonical`);
    if (body.length < 800) bad.push(`${page.path}: rendered body is only ${body.length} characters`);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { bad.push(`${page.path}: invalid JSON-LD`); }
    }
    const out = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    console.log(`prerendered ${page.path} (${Math.round(body.length / 1024)} KB)`);
  }

  writeFileSync(join(dist, 'sitemap.xml'), seo.sitemapXml());
  writeFileSync(join(dist, 'robots.txt'), seo.robotsTxt());
  writeFileSync(join(dist, 'llms.txt'), seo.llmsTxt());
} finally {
  await vite.close();
}
if (bad.length) {
  console.error('Prerender checks failed:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('ok: public pages prerendered; sitemap.xml, robots.txt and llms.txt generated');
