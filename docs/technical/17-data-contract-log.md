# 17. Data contract project: change log, PR by PR

This is the detailed record of the data-contract project (ROADMAP Phase 14). The spec is in [15-data-contract.md](15-data-contract.md) and the designer guide in [16-design-authoring.md](16-design-authoring.md). Every pull request is listed with what changed, why, how it was tested, the proof that the restaurant designs did not change, and what the owner had to do.

## The rule that governed every PR

The existing restaurant designs must not change by one byte (so not by one pixel). Three guards enforced it in every PR:

1. **Golden harness** `tests/golden/guest.ts`. It renders every guest-facing look with fixed test data and stores a SHA-256 of each result in `tests/golden/index.json`. `npx tsx tests/golden/guest.ts --check` fails on any difference and runs in CI. A hash may only be added, never changed (each PR below states how many were added and that no earlier hash changed).
2. **No design file edits.** `git diff --stat main -- src/lib/kitDesigns` shows only the new `manifest.ts` since P2, and nothing before that.
3. **Equality assertions inside the harness**, so a new look is proven equal to the old one it replaces (listed per PR).

## Summary table

| PR | Phase | Branch | Migration | Worker redeploy | Golden hashes after | Local QA after |
|---|---|---|---|---|---|---|
| #92 | P0 spec and harness | `docs/data-contract-spec` | none | no | 202 | n/a (docs and tests only) |
| #93 | P1 category registry | `feat/category-registry` | **018** | recommended | 202 | CI green |
| #94 | P2 restaurant contract | `feat/restaurant-contract` | none | recommended | 207 | 621 of 621 |
| #95 | P3 page designs | `feat/page-designs` | none | recommended | 227 | 629 of 629 |
| #96 | P4 form designs | `feat/form-designs` | none | recommended | 239 | 636 of 636 |
| #97 | P5 event tags | `feat/event-dims` | **019** | not needed | 239 | 642 of 642 |

Every PR was merged with a merge commit (not squashed), from its own branch, after CI (`qa`) was green.

---

## PR #92, P0: spec, golden harness, schema fix (merge 6ec505f)

**Purpose:** write the spec, put the pixel guard in place before touching any code, and fix a latent setup bug.

**Changes**
- `tests/golden/guest.ts` (new) and `tests/golden/index.json` (new, 202 hashes). Cases: all 14 restaurant designs in ten data shapes each (sample menu, owner menu with odd characters and a token look-alike, orders on, prices off, empty menu, Sinhala, Tamil, branding off, password set, extra blocks), the generic themed restaurant look (three themes, English, orders, Sinhala, Tamil, vCard save), the legacy flat Kit page, all 20 page templates, the three form presets (normal, error, done, Sinhala), and wifi, text, vCard, event, email and URL outputs. Every case renders twice and the two results must match. The event output's `DTSTAMP` (render time) is normalized before hashing.
- `.github/workflows/api-qa.yml`: new step "Golden guest output" before the route checks.
- `db/schema.sql`: migration 016's `form_submissions.status` change moved below the `form_submissions` table it alters. Before, a fresh project setup failed at that line. `db/full-setup.sql` rebuilt.
- Docs: `15-data-contract.md` and `16-design-authoring.md` (new); `02-architecture.md` (17 tables, Worker endpoints); `04` (orders-summary limit 20, not 50); `08-analytics.md` (city and peak-hours rows removed, they exist); README, ROADMAP (Phase 14), CHANGELOG.

**Tests and evidence:** golden `--check` 202 of 202; `build-db-dump.mjs --check`; server import check; CI `qa` green.
**Owner steps:** none.

---

## PR #93, P1: category and design columns (merge 8d03c7b)

**Purpose:** every object gets a stored category and a design id, and the app stops guessing what an object is.

**Migration 018** (`db/migrations/018_category_design.sql`, mirrored into `db/schema.sql`, `db/full-setup.sql` rebuilt)
- `qr_codes.category` (not null, check in restaurant, page, form, vcard, wifi, event, text, email, url) and `qr_codes.design`. Index `(user_uid, category)`.
- Backfill: a page with a menu block (or an old Kit blob) becomes `restaurant`, any other page `page`, other types keep their name. The design stored inside a restaurant's `content_data` is copied to the column.
- A commented-out `delete from qr_codes where qr_type = 'page'` for the owner (not run by default).

**Code**
- `src/lib/categories.ts` (new): `CATEGORIES`, `CATEGORY_QR_TYPE` (a restaurant is a `page` row, so plan caps and the Worker keep working), `CATEGORY_DESIGNS` (ids only, so the browser never loads design bodies), `categoryFor`, `categoryOf`, `isRestaurant`, `designError`, `editorPath`. Self-check included.
- `server/index.ts`: create accepts `category` and `design` (400 `INVALID_CATEGORY` or `INVALID_DESIGN`); update accepts `design` (`null` clears it), refuses a category change, and accepts `if_updated_at` (409 `STALE` if the row changed since the editor loaded it); `GET /api/qr` accepts `?category=`; the edge config (`/internal/slug/:slug`) carries `category` and `design`.
- `src/lib/guestPage.ts`: the design column wins over `content_data.design` (the fallback stays while editors still write the old copy). Not a visible change.
- Frontend: `isRestaurant` and `pageEditPath` (in `Pages.tsx`) and the search routing (`suggest.ts`) read the stored category; the Kit wizard sends `category: 'restaurant'`; the Orders toggle sends `if_updated_at`.
- `kitTemplates.ts` self-check asserts `categories.ts` lists exactly the registered designs.

**Tests:** QA 35j (stored category, validation, immutable category, `?category=`, design switch, `if_updated_at`, edge config, and a direct database change of `design` showing at the edge). Bundle check: the browser entry stayed at 723 KB. Worker dry-run bundle measured at 434 KiB (78 KiB gzip), far under the limit.
**Evidence:** golden 202 of 202.
**Owner steps:** ran migration 018. Worker redeploy recommended (the Worker bundle includes the renderer).
**Fix during review:** the first QA run failed one check that compared the first 60 characters of two designs' CSS, which are the same Tailwind base; the check now compares the end of the CSS.

---

## PR #94, P2: restaurant contract, manifest, original look (merge 3bc81c3)

**Purpose:** every restaurant is stored in one fixed shape, whatever design shows it, and the first Kit look becomes a selectable design.

**Code**
- `src/lib/contracts/restaurant.ts` (new): `normalizeRestaurant`. First block is the header; at most one each of header, menu, offer and Wi-Fi; allowed kinds header, text, offer, menu, button, wifi, socials, contact, image, video, divider (no `products`); 1 to 40 blocks; only the slot keys `accent`, `hero`, `headline`; `orders` exactly `{on}`; unknown top-level keys dropped; `v: 1` stamped. Idempotent (normalizing twice changes nothing).
- `server/index.ts`: create and edit run restaurants through the contract (400 `INVALID_RESTAURANT`). The older flat Kit shape (no `blocks`) still saves as it is, to keep the legacy Kit editor working until the final cleanup.
- `src/lib/guestPage.ts`: the legacy flat Kit rendering moved, unchanged, into a function `legacyKit`; a new `originalInput` builds its input from a restaurant's blocks, so design `original` renders the first Kit look from the same data. The flat shape renders through the same function, so old pages are untouched.
- `src/lib/kitDesigns/manifest.ts` (new): per design name, which fields it shows, whether it takes orders, and a `premium` flag (all false for now). `plate-1` is recorded as not taking orders (it has no cart buttons) instead of being "fixed". The `kitTemplates.ts` self-check compares the manifest with each design's HTML.
- `src/pages/Kit.tsx`: saving keeps `design` and `slots` for a design the gallery does not list (for example `original`).
- `categories.ts`: `original` added to the restaurant designs.

**Tests:** QA 35k (stored in contract form, bad shapes refused, saving keeps the version, pages not held to the restaurant contract, design `original` renders and switching back restores the menu); the restaurant contract self-check.
**Evidence:** golden grew from 202 to 207 (5 `kit-original/*` cases added, none changed). The harness asserts the `original` design renders **exactly the same bytes** as the old flat page for the same data (English, Sinhala, Tamil, minimal). `git diff main -- src/lib/kitDesigns` shows only `manifest.ts`.
**Owner steps:** none (no migration). Worker redeploy recommended for the `original` look at the edge.

---

## PR #95, P3: page contract and designs (merge 9586dcb)

**Purpose:** link-in-bio pages get a fixed shape and switchable looks; the owner may only change the accent colour.

**Code**
- `src/lib/pageDesigns.ts` (new): 21 designs (`default`, the plain look pages always had, plus the 20 looks of the built-in templates), `designTheme`, `designForTheme` (maps an older free-form theme to the matching design, or to `default` with its accent). Standalone and small.
- `src/lib/contracts/page.ts` (new): `normalizePage`. Blocks 1 to 40 without `menu` (400 "A menu belongs to a Restaurant Kit"); `design` plus `slots.accent` only; the free `theme`, `orders` and unknown keys are dropped; `v: 1`.
- `src/lib/guestPage.ts`: a page with a design renders with that design's theme (accent slot on top); a page without one still reads `theme`.
- `src/lib/pageTemplates.ts`: self-check asserts each template's theme equals its page design.
- `server/index.ts`: pages are normalized on create and edit (400 `INVALID_PAGE`) and the design column is set from the result. A design-only update now also keeps the copy inside `content_data` in step, so an editor that saves it back does not undo the switch.
- `src/pages/PageEditor.tsx`: a Design picker replaces background, text colour, button style and font for pages; accent stays; the menu block is no longer offered for pages. Restaurants and admin templates keep their existing controls.

**Tests:** QA 35l (template theme becomes its design, unknown theme becomes `default` plus accent, menu in a page refused, switching keeps blocks, free theme dropped, edge renders the column, accent slot colours the page). Two existing QA checks that created pages in the flat legacy shape were kept working by the flat-shape tolerance above.
**Evidence:** golden 207 to 227 (20 `pagedesign/*` cases added). The harness asserts each page design renders **exactly the same bytes** as its template's own theme did. All earlier hashes unchanged.
**Deviation from the approved plan:** page slots are `accent` only (the plan also listed avatar, cover and headline; those need rendering features that no design uses yet).
**Owner steps:** none. Worker redeploy recommended.
**Process note:** one local QA run used a stale server left from an earlier run on port 3100 and wrongly showed failures; the local QA script now stops the server by port. The CI run was unaffected.

---

## PR #96, P4: form contract and designs (merge 1bca2ac)

**Purpose:** forms get a fixed shape and three looks.

**Code**
- `src/lib/formDesigns.ts` (new): `default` (Classic, the old look, no extra CSS), `soft` (tinted page, fields on a raised card), `dark` (Midnight). A design is an accent colour plus a little CSS over the one form markup. `formStyle` resolves the accent slot.
- `src/lib/contracts/form.ts` (new): `normalizeForm` reuses `formDefError`, drops unknown keys, stamps `v: 1`, stores `design` and `slots.accent`.
- `src/lib/guestPage.ts`: the form branch applies the design; with no design the output is unchanged.
- `server/index.ts`: create and edit normalize forms (400 `INVALID_FORM`); design column set; design-only updates keep the `content_data` copy in step.
- `src/pages/FormEditor.tsx`: Design picker and Accent colour in Settings.
- `categories.ts`: form designs registered.

**Tests:** QA 35m (contract form, default design, restaurant design refused, switch keeps fields and accent, empty field list refused and unchanged, edge renders the column, accent slot). The Soft and Midnight skins were screenshotted and checked by eye.
**Evidence:** golden 227 to 239 (12 `formdesign/*` cases). The harness asserts the `default` design equals the plain form byte for byte, for all three presets.
**Deviation from the approved plan:** form slots are `accent` only (logo and cover deferred).
**Owner steps:** none. Worker redeploy recommended.

---

## PR #97, P5: tags on every scan (migration 019)

**Purpose:** analytics can tell which category, design and template a scan saw.

**Migration 019** (`db/migrations/019_event_dims.sql`, mirrored into `db/schema.sql`)
- `scan_events.category`, `design`, `tpl`; `qr_codes.tpl` (the template a code was made from); `qr_stats.by_design` (scans per design id, `none` when there is no design).
- A 16-argument `record_scan` that calls the existing 13-argument one (which stays, so an older API keeps working), then stamps the event and counts the design. Failed PIN attempts are logged but not counted, as before. Execute rights only for `service_role`.

**Code**
- `server/index.ts`: `/internal/scan` and the local-dev capture pass `category`, `design` and `tpl` from the code's row, which the route already loads, so **no Worker change is needed**. Create accepts `tpl` (letters, digits, `-`, `_`, up to 40; a malformed value is ignored) and it never changes afterwards.
- `Kit.tsx` and `PageEditor.tsx` send the template id when creating.

**Tests:** QA 35n (template stored and immutable, a scan row carries category, design at that moment and template, a design switch is counted under the new design, a URL code is tagged `url` and counted as no design, the 13-argument `record_scan` still works).
**Evidence:** golden 239 unchanged (no rendering change).
**Deviation from the approved plan:** `orders.design` was dropped; orders will be attributed through the server-side `order_placed` guest event in P6. Item ids in orders were also dropped, because changing `data-ref` would change every design's HTML.
**Owner steps:** ran migration 019. The database was checked afterwards (all three new columns exist).

---

## Deviations from the approved plan (all in the safer direction)

| Approved plan | What was built | Why |
|---|---|---|
| Restaurant contract as `header`/`menu`/`buttons` objects | A fixed layout of the existing block list (header first, single menu, offer, Wi-Fi) | The designs, orders, tracked links and translations all read blocks; a different shape would have forced design or order changes and risked pixels |
| Add `logo` and `about` slots to restaurants | Only `accent`, `hero`, `headline` | A new slot means editing a design file |
| Fix `plate-1`, `boba-2`, `showcase-5`, rename scope classes, shared Tailwind CSS | Nothing changed; recorded in the manifest | Owner rule: not one pixel |
| Item ids in order lines | Orders unchanged (`[section, item]` plus name check) | `data-ref` would change in every design |
| Page slots avatar, cover, headline; form slots logo, cover | `accent` only | No design uses them yet |
| Delete `KitLegacy.tsx` in P2 | Still present, scheduled for the final cleanup | The legacy flat shape keeps saving until then |
| `blank` as a named restaurant design | A restaurant with no design renders the themed page (design `null`) | Already works, no new code |
| `orders.design` column | Dropped; P6 events carry the design | Avoids rewriting `place_order` |

## Still to come

P6 guest events (migration 020), P7 analytics by design, P10 the small categories and their landing designs, a final cleanup (remove the legacy Kit editor, its flat shape and the old tests that rely on it), and a final verification with a blast-radius check. Each gets its own section here when it merges.
