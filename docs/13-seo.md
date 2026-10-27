# SEO and search visibility

How Scnr is found on Google, Bing and AI search, what the build generates, and what only the owner can do.

## What is built

- **Real HTML for every public page.** `npm run build` runs `vite build`, then [scripts/prerender.mjs](../scripts/prerender.mjs). The script renders these pages to static HTML with their own title, description, canonical link, Open Graph tags and JSON-LD: `/`, `/tools`, the five `/tools/*` pages, `/whats-new` and the three legal pages. Crawlers that do not run JavaScript (most AI crawlers) read the full page. When the browser loads, React replaces the static copy.
- **One source of truth:** [src/lib/seo.ts](../src/lib/seo.ts). Page titles and descriptions, the FAQ, structured data, the sitemap, `robots.txt` and `llms.txt` all come from it. [src/lib/tools.ts](../src/lib/tools.ts) holds the text of the free tools. The origin comes from `VITE_SHORT_DOMAIN`, so a domain move changes one value.
- **Generated files.** `dist/sitemap.xml`, `dist/robots.txt` and `dist/llms.txt` are written at build time. Do not add them back to `public/`.
- **Build gate.** The build fails if a public page has no single `<h1>`, no canonical link, almost no body text or broken JSON-LD. `scripts/check-bundle.mjs` also checks that every sitemap URL has its own prerendered file and a distinct title, and that `public/assets/og-scnr.png` exists.
- **`/` is the home page for logged-out visitors.** It used to redirect to `/login`, so crawlers never saw a home page. `/login` still shows the same page and declares `/` as its canonical URL.
- **Private pages are blocked in robots.txt** (dashboard, create, edit, admin, billing and so on). `/api/` has a trailing slash on purpose, because `/api-docs` is an app page.
- **Structured data.** Home: `Organization`, `WebSite`, `SoftwareApplication` (plans in LKR and USD, generated from `PRICES`) and `FAQPage`. The FAQ text is visible on the page, as Google requires. Tool pages: `WebApplication` and `BreadcrumbList`.
- **Social preview image:** `public/assets/og-scnr.png`, 1200 by 630.

When you add a public page, add it to the `PAGES` list in `seo.ts` and to the routes in [src/prerender.tsx](../src/prerender.tsx). Run `npx tsx src/lib/seo.ts` to check titles (unique, 70 characters or fewer) and descriptions (50 to 160 characters).

## What Google says about AI search

Google's guidance for AI Overviews and AI Mode is that generative AI search is still SEO. Read it again before large changes. The points that shaped this work:

- Pages must be indexed and eligible for a snippet. That is the technical base above.
- Unique, first-hand, non-commodity content matters more than any markup. A page that restates what everyone says does not help.
- Google Search does **not** use `llms.txt`, "chunking" or special AI markup. We still generate `llms.txt` because it costs nothing and other AI tools may read it. It does not help or hurt Google ranking. Do not spend more time on it.
- Structured data is not required for AI features, but it helps rich results, so it stays.
- Do not create many near-duplicate pages for every search phrase. That breaks Google's scaled content abuse policy. Write a page only when it has something real to say.
- Do not buy or fake "mentions". Real reviews, customer posts and press are fine.

## What only the owner can do

1. **Google Search Console.** Add `scnr.tharkak.com` as a Domain property (a DNS TXT record in Cloudflare). Submit `https://scnr.tharkak.com/sitemap.xml`. Use URL Inspection and **Request indexing** for `/`, `/tools` and each tool page. Later, use the **Generative AI performance** report to see AI Overviews and AI Mode visibility.
2. **Bing Webmaster Tools.** Import the site from Search Console and submit the sitemap. ChatGPT search and Copilot lean on Bing's index.
3. **Google Business Profile** for the business, if you have one. It is how local businesses appear in AI answers.
4. **Real social links.** When Scnr has company pages (LinkedIn, Facebook, Instagram), add them to the `Organization` data as `sameAs`.
5. **Check a deployed page.** After the first deploy, open `https://scnr.tharkak.com/tools` (no trailing slash) and confirm it returns the page with status 200. Run a page through Google's Rich Results Test and the Search Console URL Inspection live test.

## Content that is worth writing (not built yet)

Pages only count if they are better than what already ranks. Ideas that fit what Scnr really knows:

- A short case study with a real Sri Lankan customer: what they printed, how many scans, what they changed after printing.
- A walk-through of a real venue setup, with photos of the real table tent and the real scan numbers.
- Plain guides where Scnr has first-hand data, such as how many diners scan a table tent in the first month.

Skip generic lists ("10 QR code tips"). They are commodity content.

## Known limits

- The service worker caches the app shell. A returning visitor may see the old home page once after a deploy, then the new one.
- Signed-in visitors have the static copy hidden before first paint. The inline script in `index.html` looks for the Supabase session key (`sb-…-auth-token`). If that key name changes, signed-in users will see a brief flash of the public page.
- Unknown URLs for logged-out visitors redirect to `/`. Vercel's SPA fallback cannot return a real 404 here, because short links share the same domain.
