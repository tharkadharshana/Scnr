# 14 — Performance and UI overhaul (November 2026)

This is the end-to-end record of one work stream: the Create QR wizard, the Dashboard and Analytics redesign, skeleton loading, a benchmark of the app and the live site, and the fixes that came out of it. It was shipped as four pull requests. Read it to learn what changed, why, what was measured, what was rejected on purpose, and what is left for the owner.

## 1. What shipped

| PR | Branch | What it did |
|---|---|---|
| #59 | `feat/qr-create-wizard` | Create QR wizard, Dashboard cards and charts, skeleton loading, sidebar order |
| #60 | `perf/api-roundtrips` | Fewer database round trips, slim lists, per-view stat columns, migration 015 |
| #61 | `perf/frontend-weight` | SVG charts replace recharts, shell-only service worker cache, lighter images |
| #62 | `chore/prod-hardening` | Security headers on every response, production checklist |
| (this doc) | `docs/performance-report` | This document and the benchmark script `tests/bench.ts` |

### 1.1 PR #59: wizard, Dashboard, skeletons

- **Create QR is a five step wizard** (Type, Content, Style, Options, Review) in the same card shell as the Restaurant Kit: step bar with done ticks, Back and Continue in a footer under a divider.
  - Step 1 is a tile picker for the QR type. Selecting a tile only highlights it; Continue moves on. Restaurant Menu opens `/kit` and Social Bio opens `/pages/new`. The remaining types (GS1, socials, phone, SMS, location, event, app store, Wi-Fi, text, email) are in a "More types" menu.
  - Editing an existing code skips the type step.
  - Create, Reset and Delete appear only on the last step. A validation error found at Create (bad link, WhatsApp number, PDF, GTIN, event) shows a message and returns to the Content step.
  - The scroll-spy step bar and the collapse chevrons were deleted (a wizard shows one card at a time).
- **Dashboard:** codes are cards (status pill, type, scan count, QR thumbnail, short link with copy, destination, tags, QR Code, Stats, edit, delete). Select mode, folders, tags, the "Link broken" pill and the form Responses button still work. The device donut is replaced by a Scanner Platforms bar card next to a Live Scan Stream.
- **Scan chart:** "Scan Traffic Over Time" with total and unique series and a 7 / 30 / 90 day switch plus a Custom range.
- **Sidebar order:** Dashboard, Create QR (orange plus), Analytics, then the rest.
- **Skeleton loading everywhere** (`src/components/Skeleton.tsx`): every page that waits for data shows shimmering boxes instead of a white screen or "Loading…". A plain skeleton in `index.html` covers the first paint for signed-in users (it sits beside `#root`; the prerender step requires `#root` to stay empty).
- **Progressive loading:** the Dashboard, Analytics and Account analytics no longer wait for every request. Each block (stats, chart, codes, countries, devices, recent scans) shows its own skeleton and fills in when its own data arrives. Stale responses are ignored (a slow answer for an old range or code cannot overwrite a newer one), and a failed list shows a retry message instead of the empty state.
- **Fixes found on the way:** the phone bottom bar floated mid-screen while a page loaded (short loading boxes, now fixed); the sidebar order; dark theme colours for the selected type tile; tag chips are real buttons.

### 1.2 PR #60: API speed

See section 3 for the numbers.

- `GET /api/user/plan` runs its independent reads together, reads only the columns it needs, passes the profile into `getLicense` and looks up domains once.
- `GET /api/qr` accepts `?lite=1` (stats reduced to the two scan totals), `?limit` and `?offset` (paged newest first, then slug) and returns `X-Total-Count`. The default response is unchanged for API users. New `GET /api/qr/folders` feeds the Create QR folder dropdown (`folders` became a reserved back-half).
- Each analytics view reads only the `qr_stats` columns it uses (`viewCols` in `server/index.ts`); per-code views use a light ownership check; answers carry `Cache-Control: private, max-age=15` with `Vary: Authorization, X-Workspace`.
- The global rate limit default went from 300 to 600 per 15 minutes (a Dashboard load makes about 10 calls).
- Migration `015` adds an index on `scan_events (slug, scanned_at desc)` for the Recent scans and GPS views.
- QA section 35h covers all of it (551 checks pass).

### 1.3 PR #61: frontend weight

- recharts (383 KB, 115 KB gzip) was replaced by `src/components/charts.tsx`: a line and area chart, a bar chart and a ring chart in plain SVG with hover readouts and screen reader labels. The pure helpers (`niceScale`, `curvePath`) have a self-check (`npx tsx src/components/charts.tsx`).
- The service worker precaches only the app shell and the small prerendered public pages. Other chunks are cached the first time a page needs them (cache first; file names carry a content hash). Before, a new visitor downloaded about 3 MB in the background. A tab that asks for a chunk removed by a newer deploy reloads once (at most every 10 s).
- `public/kit/hero-food.webp`: 310 KB to 99 KB (640 x 640).
- Landing loads the `qrcode` library only when a preview is drawn.
- Visitors without a session no longer see a full-screen loader over the prerendered page. Logged-out lazy pages keep showing the prerendered markup until the real page is ready.
- The Dashboard builds the first 24 cards and adds a "Show more" button. "Select all shown" selects the visible cards only.

### 1.4 PR #62: hardening

- `vercel.json` adds `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` and `Permissions-Policy` (`camera=(self)` because the QR scanner tool needs it) to every response.
- A "Production checklist" in [10-operations.md](10-operations.md) lists the owner steps.

## 2. How the benchmark and the scan were done

- **Bundle analysis:** `vite build` with source maps, then the size of each package inside each chunk from the maps. Before: main JS 219 KB gzip, recharts chunk 115 KB, motion 45 KB, CSS 28 KB.
- **API benchmark:** `tests/bench.ts` (new). It creates a disposable user with 120 codes and 1,800 scan events against the real Supabase project, times each endpoint 12 times and deletes the user. Run it with the QA environment: `QA_API_URL=http://localhost:3100 npx tsx tests/bench.ts`. The numbers include the network trip from the machine running it to Supabase, so compare runs from the same machine.
- **Live site scan (read-only):** headers, caching, redirects, timing of public pages, console errors and failed requests in a headless browser. The signed-in app cannot be scanned without a login.

## 3. Results

Same machine, same database, 120 codes and 1,800 scans. The "before" run used the code from before PR #60, the "after" run is the current code.

| Call | Before p50 | After p50 | Payload before | Payload after |
|---|---|---|---|---|
| `/api/user/plan` | 953 ms | 293 ms | 1.2 KB | 1.2 KB |
| `/api/qr` (Dashboard list) | 459 ms | 272 ms (`lite`) | 522 KB | 96 KB (`lite`); 19 KB with `limit=24` |
| account summary / devices / countries | 440 to 470 ms | 262 to 285 ms | small | small |
| account timeseries | 572 to 580 ms | 358 to 361 ms | 2 to 5 KB | 2 to 5 KB |
| per-code summary / hours | 382 to 392 ms | 341 to 351 ms | small | small |

Caveat: the two seeds stored the per-day numbers in slightly different shapes, so the list payload comparison is indicative, not exact. The plan call dropped by about 69 percent and the analytics calls by roughly 25 to 40 percent.

Frontend, from the production build:

- The recharts chunk (383 KB) is gone; chart pages load a few KB of chart code instead.
- Service worker precache on production went from 60 entries (about 3 MB) to the app shell (two JS and CSS files plus `index.html`).
- Hero image 310 KB to 99 KB.
- On production after the merge: landing page loads with 7 requests and 179 KB, no console warnings (before: one warning), and `/pricing` has its content at DOM ready (before the page said "Loading..." for the first moments).

## 4. Live site findings and their status

| Finding | Status |
|---|---|
| HTML had no security headers | Fixed in #62 (after deploy, check with `curl -I https://scnr.tharkak.com/`) |
| "Slow 404" (1.3 to 2.6 s for unknown paths) | Not a bug: the Worker treats one-segment paths as short-link lookups. A Worker negative cache would make repeat misses instant (owner deploy) |
| `www.scnr.tharkak.com` does not resolve | Owner step (DNS) |
| No `security.txt` | Owner choice (it publishes a contact address) |
| Global rate limit may be shared across visitors behind the proxies | Open: verify with the `ratelimit-remaining` header from two networks (checklist). The limit was raised to 600 as a cushion. A visitor key from `cf-connecting-ip` was rejected because any client can send that header |
| Public lazy pages showed "Loading..." | Fixed in #61 |
| One cold start of 1.9 s | Normal serverless behaviour; no action |
| Function region `iad1`, users in Sri Lanka | Matches the database (Supabase US East). The cost is about 250 ms per API call, so fewer calls per page is the only lever |

## 5. Decisions and things deliberately not done

- **Local JWT verification of access tokens:** rejected. It would skip the server's check that a token was revoked (QA section 16 tests that), for a saving of about 150 to 300 ms on a cold instance.
- **Sharing the plan or the code list between pages in memory:** rejected. Create QR and the Dashboard depend on fresh counts (remaining codes, dynamic allowance); a stale cache could let a user pick an option the server then refuses.
- **Browser caching of `/api/qr`:** not added for the same reason (a new code must show at once). Analytics answers are cached for 15 s only.
- **Content-Security-Policy:** not added. The pages use inline scripts and styles, so a useful policy needs nonces first.
- **Replacing `@supabase/supabase-js`:** it ships realtime and storage modules (about 230 KB unminified) that are mostly unused, but a leaner client is risky. Backlog.
- **`create index concurrently`:** migration 015 uses a plain `create index`. The `scan_events` table is small today; on a large table run it during a quiet hour.
- **Line endings:** `src/pages/Dashboard.tsx` is stored with CRLF. Editing it with a script that normalises line endings turns a three line change into a whole-file diff. Commit it with `git -c core.autocrlf=false add` or keep CRLF.

## 6. Owner steps (nothing here blocks the app)

1. Run `db/migrations/015_scan_events_slug_time.sql` in the Supabase SQL editor.
2. Verify the rate-limit key (see the checklist in [10-operations.md](10-operations.md)).
3. Add DNS for `www` if you want it.
4. Optionally publish `security.txt`, and deploy a Worker negative cache for unknown slugs.
5. Click through the signed-in pages once (Dashboard, Analytics, Create QR wizard on phone and desktop). The automated checks cover the API and the build, and the charts were checked in a headless browser, but a signed-in visual pass was not possible without a login.

## 7. Backlog (ideas with a measured basis)

- Account overview endpoint returning devices, countries, recent scans and the 30 day series in one response (the Dashboard would make 3 calls instead of 6).
- Store the first scan day on `qr_stats` so `/api/user/plan` stops reading every code's `days` map.
- A leaner Supabase client.
- Page the Dashboard list from the server (`limit` and `offset` already exist) once accounts have hundreds of codes.

## 8. How to verify the work later

- `npm run lint`, `node scripts/check-server-imports.mjs`, `node scripts/build-db-dump.mjs --check`, the self-checks (`npx tsx src/lib/guestPage.ts`, `csv.ts`, `digest.ts`, `src/components/charts.tsx`, `src/lib/qrContent.ts`).
- The full QA run (`tests/qa.ts`, 551 checks) with the environment in [10-operations.md](10-operations.md); CI runs it on every PR.
- `tests/bench.ts` for before and after timing of API changes.
- `npm run build` prints the chunk sizes; `scripts/check-bundle.mjs` fails the build if the entry chunk grows past its limit.
