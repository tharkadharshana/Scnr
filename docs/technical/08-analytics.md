# 08 — Analytics

## What is captured per scan

| Field | Source | Stored in |
|---|---|---|
| Timestamp | server `now()` (UTC) | `scan_events.scanned_at`, `qr_stats.days[YYYY-MM-DD]`, `monthly_scans[YYYY-MM]` |
| Country (ISO-2) | Cloudflare `request.cf.country` | `scan_events.country`, `qr_stats.countries` |
| Device / OS / Browser | regex on the User-Agent ([server/index.ts:2396](../../server/index.ts#L2396)) | `scan_events`, `qr_stats.devices/os/browsers` |
| Referer | `Referer` header | `scan_events.referer` only |
| Daily unique flag | KV `uniq:{slug}:{visitorHash}` set until end of day | `scan_events.is_unique`, `qr_stats.unique_scans` |
| ASN, colo, TLS, EU flag, Accept-Language, IP, full UA | Worker payload | **discarded** |

Bots are not recorded. The Worker skips them before any counter moves, and the server drops them again; both use `src/lib/scanFilter.ts` (user agent regex, prefetch headers, a short cloud ASN list). Note that it also drops link previews from WhatsApp and Telegram, which is intended.

Static QR codes produce **no analytics**. They never reach the platform.

## Definitions (what the numbers on screen mean)

| Metric | Exact meaning |
|---|---|
| **Total scans** | Successful, non-bot scans that passed every gate. Wrong-PIN attempts are excluded. |
| **Unique visitors** | The sum, over days, of distinct (IP + UA + UTC date) fingerprints per QR. One person scanning on 3 days counts 3 times. On the account view, the per-QR uniques are added together, so one person scanning 2 codes counts twice. |
| **Unique scans per day** (chart) | Real, from `days_unique`, for days recorded after migration 003. Older days are estimated as `round(day_total × unique_scans / total_scans)`. |
| **Busiest hours** | `qr_stats.hours`: scans per UTC hour, all time. The weekly digest converts it to the owner's time zone. |
| **Mobile %** | `devices.mobile / total_scans`. iPads count as mobile. |
| **First / last scan** | The smallest and largest key in `qr_stats.days`. Only the day, no time. |
| **Days active** (`/api/user/plan`) | Days since the earliest day key across all codes |
| **Monthly scans used** | `profiles.monthly_scans[current month]`. Falls back to the sum of `qr_stats.monthly_scans`. The same account-wide counter drives the Worker's quota gate (`quota_exceeded`). |

## Aggregation model

Each scan calls `record_scan()`, which increments one pre-aggregated `qr_stats` row atomically. The dashboard never queries `scan_events`, except for "recent" and the CSV export.

- **Fast, consistent reads.** One row per code, with no lost increments.
- **Breakdowns are all time.** Countries, devices, browsers, OS and hours are lifetime totals, so the date range filters only the time series. The UI labels them "all time".
- **Retention.** Raw events are deleted after 400 days by the daily cron; aggregates stay.

## Endpoints

See [doc 04](04-backend-api-reference.md#analytics). One set of views serves both a single code and the account (`loadScope()` plus a `views` map in server/index.ts), with a single `in` query for the stats rows.

## Placeholder or broken analytics features

| Feature | Why it shows nothing |
|---|---|
| ~~Referrers and "advanced" panels~~ | Removed in Phase 1 (they were always empty). The referer of each scan is still shown in recent scans. |
| ~~Fake "vs last month" deltas and "Live" labels~~ | Removed in Phase 1 |

## Tags on every scan (migration 019)

Each scan row in `scan_events` also records `category`, `design` and `tpl` (the template the code was made from), read from the code's row at scan time. A scan after a design switch is therefore counted under the new design, and the old scans keep the old one. `qr_stats.by_design` is a counter map of scans per design id (`none` when the page has no design, for example a URL code). Failed PIN attempts are logged but not counted, as before. The Worker is unchanged: the server tags the scan from the row it already loads. The 13-argument `record_scan` stays for an older API.

## Guest events (migration 020)

Beyond the scan (the page view), the server records what visitors do: `order_placed` (restaurant), `form_submit` (form) and `link_click` (restaurant and page, keyed by the tracked link). Each event carries the code's category, design and template, so a design's scan-to-order or scan-to-submit rate can be worked out per category. Only events the category allows are kept (`src/lib/events.ts`). These are written by the server where the action happens, so they are exact and cannot be dropped by an ad blocker. Events that happen only inside the page (adding to the cart, switching language, copying the Wi-Fi password, saving a contact) are named in the catalog but not recorded yet: they need a small script in the page, which changes the page HTML and needs the owner's approval first. Raw events are kept 90 days; the counters in `qr_stats.events` are kept.

## Analytics by category and design

Views added on `/api/analytics/:slug/<view>` and `/api/analytics/account/:uid/<view>` (optional `?slugs=`):

| View | Rows |
|---|---|
| `by_category` | `{ category, codes, scans, unique }` from the code's stored category. |
| `by_design` | `{ category, design, scans }` from the `qr_stats.by_design` counters. A scan after a design switch counts under the new design; earlier scans stay under the old one. |
| `events` | `{ event, count, pct }` from the `qr_stats.events` counters. |
| `funnel` | `{ category, design, codes, scans, actions, rate, low_sample }`: scans, then `order_placed` plus `form_submit`, grouped by each code's **current** design. Under 30 scans `low_sample` is true and the rate says little. |

Compare designs inside one category only: a restaurant and a form do not convert the same thing. The funnel groups by the current design, so a code that switched design counts its whole history under the new one (`guest_events` holds the per-design detail if that ever matters). The Analytics page shows these as "Design performance" and "What visitors did". The scan CSV ends with `category,design,tpl`. The weekly digest adds the week's orders and form submissions.

## Weekly digest

`buildDigest()` ([src/lib/digest.ts](../../src/lib/digest.ts), with a self-check) takes the last 7 days of scans and produces the total, the busiest hour in the owner's time zone, the top code and a short tip. The Monday cron emails it through Resend. Owners opt out in Settings.

## Phase 10: cities, languages, referrers and the GPS map

- **Top cities** come from Cloudflare's `request.cf.city` at the edge; **languages** from the scanner's `Accept-Language` (primary subtag); **referrers** from the `Referer` header's domain. All three are all-time maps in `qr_stats`, summed like countries, so they are not limited by the history window.
- **Scan map.** Only codes with GPS tracking turned on collect fixes, and only when the scanner allows it. Points are rounded to about 100 m. The map shows the newest 1,000.
- **Engagements** (Phase 7) and **form answers** (Phase 9) are not scans and never change these numbers.
