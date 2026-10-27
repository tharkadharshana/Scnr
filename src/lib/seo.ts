// One source of truth for what search engines and AI crawlers see: per-page title, description, canonical,
// structured data (JSON-LD), the sitemap, robots.txt and llms.txt.
// The browser uses applyMeta() when a page mounts; scripts/prerender.mjs uses headTags() to write the same tags
// into static HTML at build time, so crawlers that do not run JavaScript still get the full page.
import { FREE_QR_TOOLS } from './tools.js';
import { CHANGELOG } from './changelog.js';
import { PRICES, PAID_PLANS, PLANS, formatPrice } from './plans.js';
import { SHORT_DOMAIN } from './qrContent.js';
import { SITE } from './site.js';

/** Canonical origin. Same env var as the short domain, so a domain move changes one value. */
export const SITE_URL = SHORT_DOMAIN;
export const OG_IMAGE = `${SITE_URL}/assets/og-scnr.png`; // 1200x630

export interface PageMeta {
  path: string;
  /** Page title without the brand suffix, 50 characters or fewer is best. */
  title: string;
  /** 70 to 160 characters. */
  description: string;
  /** Last real content change (YYYY-MM-DD), used in the sitemap. */
  lastmod: string;
  /** Structured data for this page. */
  ld?: object[];
}

const BUILD_DATE = '2026-10-13';
const LEGAL_DATE = '2026-10-13';

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is a dynamic QR code?',
    a: 'A dynamic QR code points to a short link you control, not straight to your page. You can change where the link goes at any time, so the code you already printed keeps working. It also lets Scnr count each scan.',
  },
  {
    q: 'Can I change where a QR code points after I print it?',
    a: 'Yes. Open the code in Scnr and paste a new link. Anyone who scans the old printed menu, poster or table tent is sent to the new place. You do not reprint anything.',
  },
  {
    q: 'Is Scnr free?',
    a: `Yes. The Free plan costs nothing, with no card: ${PLANS.free.qr_codes} QR codes in total (${PLANS.free.dynamic_qr_codes} dynamic), ${PLANS.free.monthly_scans.toLocaleString('en-US')} scans a month and ${PLANS.free.analytics_days} days of analytics. Paid plans start at ${formatPrice('pro', 'LKR', 'monthly')} a month (${formatPrice('pro', 'USD', 'monthly')} in US dollars), with a 14-day trial.`,
  },
  {
    q: 'Can I pay in Sri Lankan rupees?',
    a: 'Yes. Prices are shown in LKR and USD. Rupee payments go through PayHere. Customers outside Sri Lanka pay in US dollars by international card.',
  },
  {
    q: 'How do I get more Google reviews with a QR code?',
    a: 'Make a direct link to the review box for your business with the free Google review link tool, then print it as a QR code on receipts or table tents. In Scnr you can change that link later without reprinting.',
  },
  {
    q: 'What can I see about each scan?',
    a: 'Scans over time, device type and country for every code, plus cities, languages and referring sites. Optional GPS tracking asks the scanner once and rounds locations to about 100 metres.',
  },
];

const tool = (slug: string) => FREE_QR_TOOLS.find(t => t.slug === slug)!;

export const PAGES: PageMeta[] = [
  {
    path: '/',
    title: 'Scnr: Dynamic QR Codes with Scan Analytics for Sri Lanka',
    description: 'Make QR codes for menus, Google reviews and offers. Change where they point without reprinting, and see every scan. Free plan, prices in LKR and USD.',
    lastmod: CHANGELOG[0]?.date ?? BUILD_DATE,
  },
  {
    path: '/tools',
    title: 'Free QR Code Tools',
    description: 'Free QR code scanner, QR code generator, UTM link builder, Google review link maker and WhatsApp link maker. No sign-in needed.',
    lastmod: BUILD_DATE,
  },
  ...FREE_QR_TOOLS.map(t => ({ path: `/tools/${t.slug}`, title: t.title, description: t.description, lastmod: BUILD_DATE })),
  {
    path: '/whats-new',
    title: "What's new",
    description: 'New features and improvements in Scnr, newest first.',
    lastmod: CHANGELOG[0]?.date ?? BUILD_DATE,
  },
  { path: '/legal/privacy-policy', title: 'Privacy Policy', description: 'How Scnr collects, uses and protects personal data for account holders and for people who scan a code.', lastmod: LEGAL_DATE },
  { path: '/legal/terms-and-conditions', title: 'Terms and Conditions', description: 'The terms that apply when you use Scnr to create, manage and scan QR codes.', lastmod: LEGAL_DATE },
  { path: '/legal/refund-policy', title: 'Refund Policy', description: 'When and how Scnr refunds a paid plan, and how to ask for one.', lastmod: LEGAL_DATE },
];

export const pageFor = (path: string) => PAGES.find(p => p.path === path);
/** Full <title>: the home page title already carries the brand. */
export const fullTitle = (m: PageMeta) => (m.path === '/' ? m.title : `${m.title} | ${SITE.name}`);
export const urlOf = (path: string) => (path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`);

// ---------- structured data ----------

const organization = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#org`,
  name: SITE.name,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/assets/icons/icon-512.png`,
  email: SITE.email,
  areaServed: 'LK',
});

const website = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#site`,
  name: SITE.name,
  url: `${SITE_URL}/`,
  inLanguage: 'en',
  publisher: { '@id': `${SITE_URL}/#org` },
});

const softwareApplication = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE.name,
  url: `${SITE_URL}/`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Dynamic QR codes with scan analytics, landing pages and forms for businesses in Sri Lanka.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'LKR' },
    ...PAID_PLANS.flatMap(p => (['LKR', 'USD'] as const).map(c => ({
      '@type': 'Offer', name: p[0].toUpperCase() + p.slice(1), price: String(PRICES[p][c].monthly), priceCurrency: c,
    }))),
  ],
});

const faqPage = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const breadcrumb = (items: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: urlOf(path) })),
});

const webApp = (m: PageMeta) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: m.title,
  url: urlOf(m.path),
  description: m.description,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': `${SITE_URL}/#org` },
});

/** JSON-LD blocks for a route. */
export function structuredData(path: string): object[] {
  const m = pageFor(path);
  if (!m) return [];
  if (path === '/') return [organization(), website(), softwareApplication(), faqPage()];
  if (path === '/tools') return [breadcrumb([['Home', '/'], ['Free tools', '/tools']])];
  if (path.startsWith('/tools/')) return [webApp(m), breadcrumb([['Home', '/'], ['Free tools', '/tools'], [m.title, path]])];
  return [breadcrumb([['Home', '/'], [m.title, path]])];
}

// ---------- head tags ----------

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** JSON for an inline <script>: "<" is escaped so user-visible text can never close the tag. */
const jsonForScript = (o: object) => JSON.stringify(o).replace(/</g, '\\u003c');

/** The SEO block of <head> as a string. Written between the seo markers in index.html at build time. */
export function headTags(m: PageMeta): string {
  const t = esc(fullTitle(m)), d = esc(m.description), u = esc(urlOf(m.path));
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />`,
    `<link rel="canonical" href="${u}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:locale" content="en_LK" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    ...structuredData(m.path).map(o => `<script type="application/ld+json">${jsonForScript(o)}</script>`),
  ].join('\n    ');
}

/** Browser side: update the live <head> when a public page mounts (client-side navigation). */
export function applyMeta(path: string): void {
  const m = pageFor(path);
  if (!m || typeof document === 'undefined') return;
  document.title = fullTitle(m);
  const set = (selector: string, make: () => HTMLElement, attr: string, value: string) => {
    let el = document.head.querySelector<HTMLElement>(selector);
    if (!el) { el = make(); document.head.appendChild(el); }
    el.setAttribute(attr, value);
  };
  const named = (name: string, v: string) => set(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', v);
  const prop = (property: string, v: string) => set(`meta[property="${property}"]`, () => { const e = document.createElement('meta'); e.setAttribute('property', property); return e; }, 'content', v);
  named('description', m.description);
  named('robots', 'index,follow,max-image-preview:large,max-snippet:-1');
  set('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', urlOf(path));
  prop('og:url', urlOf(path)); prop('og:title', fullTitle(m)); prop('og:description', m.description);
  named('twitter:title', fullTitle(m)); named('twitter:description', m.description);
  // JSON-LD is swapped, not stacked (this also removes the prerendered blocks), so no page keeps another page's data.
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach(n => n.remove());
  for (const o of structuredData(path)) {
    const s = document.createElement('script');
    s.type = 'application/ld+json'; s.textContent = jsonForScript(o);
    document.head.appendChild(s);
  }
}

// ---------- generated files ----------

export function sitemapXml(): string {
  const rows = PAGES.map(p => `  <url>\n    <loc>${esc(urlOf(p.path))}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

// Paths that need a login. They are not content, so crawlers skip them. "/api/" has a trailing slash on purpose:
// "/api-docs" is an app page, not an endpoint. /login is left crawlable because it declares "/" as canonical.
export const PRIVATE_PATHS = ['/api/', '/internal/', '/admin/', '/create', '/edit/', '/kit', '/pages', '/forms', '/bulk', '/analytics', '/billing', '/settings'];

export function robotsTxt(): string {
  // One "*" group covers every crawler. Per-bot groups would each need their own Disallow lines
  // (a rule written under GPTBot does not apply to anyone else), which is how /admin/ was once left open.
  // Search and AI crawlers (Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended) are allowed.
  return `User-agent: *\nAllow: /\n${PRIVATE_PATHS.map(p => `Disallow: ${p}`).join('\n')}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

export function llmsTxt(): string {
  const plan = (p: (typeof PAID_PLANS)[number]) => `${p[0].toUpperCase() + p.slice(1)} ${formatPrice(p, 'LKR', 'monthly')} (${formatPrice(p, 'USD', 'monthly')}) a month`;
  const link = (path: string, text: string) => `- [${text}](${urlOf(path)})`;
  return `# ${SITE.name}

> ${SITE.name} makes dynamic QR codes with real-time scan analytics. Print a code once, then change where it points any time without reprinting. Built for restaurants and small businesses in Sri Lanka, with plans priced in LKR and USD.

## Facts

- Product: dynamic QR codes, mobile landing pages, forms, short links, scan analytics, API and webhooks.
- Free plan: ${PLANS.free.qr_codes} QR codes in total (${PLANS.free.dynamic_qr_codes} dynamic), ${PLANS.free.monthly_scans.toLocaleString('en-US')} scans a month, no card. Paid plans: ${PAID_PLANS.map(plan).join('; ')}. Paid plans have a 14-day trial; yearly billing gives 2 months free.
- Payments: LKR through PayHere, USD by international card.
- Operator: ${SITE.legalName}, ${SITE.location}. Contact: ${SITE.email}.

## Pages

${link('/', 'Home: product overview, features and pricing')}
${link('/tools', 'Free tools: index, no sign-in needed')}
${FREE_QR_TOOLS.map(t => link(`/tools/${t.slug}`, `${t.title}: ${t.description}`)).join('\n')}
${link('/whats-new', "What's new: release notes for customers")}
${link('/legal/privacy-policy', 'Privacy Policy')}
${link('/legal/terms-and-conditions', 'Terms and Conditions')}
${link('/legal/refund-policy', 'Refund Policy')}

## Frequently asked questions

${FAQ.map(f => `### ${f.q}\n\n${f.a}`).join('\n\n')}
`;
}

/** Self-check: npx tsx src/lib/seo.ts */
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('seo.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const seen = new Set<string>();
  for (const p of PAGES) {
    assert(p.path.startsWith('/') && !seen.has(p.path), `unique path ${p.path}`); seen.add(p.path);
    assert(p.description.length >= 50 && p.description.length <= 160, `${p.path} description length ${p.description.length}`);
    assert(fullTitle(p).length <= 70, `${p.path} title length ${fullTitle(p).length}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(p.lastmod), `${p.path} lastmod`);
    for (const o of structuredData(p.path)) JSON.parse(jsonForScript(o));
  }
  assert(new Set(PAGES.map(fullTitle)).size === PAGES.length, 'titles are unique');
  assert(new Set(PAGES.map(p => p.description)).size === PAGES.length, 'descriptions are unique');
  assert(tool('qr-scanner').title && FREE_QR_TOOLS.length === 5, 'tool table');
  assert(fullTitle(PAGES[0]) === PAGES[0].title && fullTitle(PAGES[1]).endsWith('| Scnr'), 'title suffix');
  assert(urlOf('/') === `${SITE_URL}/` && urlOf('/tools') === `${SITE_URL}/tools`, 'urlOf');
  assert(jsonForScript({ a: '</script>' }).indexOf('</') === -1, 'ld cannot close the script tag');
  assert(headTags(PAGES[0]).includes('rel="canonical" href="' + SITE_URL + '/"'), 'canonical');
  assert(structuredData('/').some((o: any) => o['@type'] === 'FAQPage'), 'home has FAQPage');
  assert(esc('a"<b>&') === 'a&quot;&lt;b&gt;&amp;', 'esc');
  const sm = sitemapXml();
  assert(sm.split('<loc>').length - 1 === PAGES.length && !sm.includes('/pricing') && !sm.includes('/login'), 'sitemap lists public pages only');
  const robots = robotsTxt();
  assert(robots.startsWith('User-agent: *') && robots.includes('Disallow: /api/\n') && !robots.includes('Disallow: /api-docs') && robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'robots');
  assert(!/Disallow: \/login/.test(robots) && !/Disallow: \/$/m.test(robots), 'robots keeps public pages crawlable');
  const llms = llmsTxt();
  assert(/^# \S/.test(llms) && /\]\(https?:\/\//.test(llms) && llms.includes('Free plan'), 'llms.txt shape');
  console.log('seo self-check ok');
}
