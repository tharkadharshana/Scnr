# 15. Data contract: categories, designs, slots and events

Every saved object has a **category**. Inside a category every item stores its data in exactly the same shape (the category's contract). The look of the public page is a **design**, chosen by one id. Changing the look means changing that one id; the data does not move. Categories never share a contract: a restaurant is not a page, and a form is not a menu.

This is the spec for the data-contract project. It is built in phases (see [ROADMAP](../ROADMAP.md), Phase 14). Sections marked "planned" are not built yet.

## Rules

1. One contract per category, with a version number `v`. A contract is a TypeScript type, a `validate()` function and test fixtures in `src/lib/contracts/<category>.ts` (planned).
2. The active design is stored in the `qr_codes.design` column, next to `qr_codes.category` (planned, migration 018). The design id is never inside `content_data`.
3. Owners only customize what a design exposes through **slots** (images, short texts, an accent colour). HTML, CSS, fonts and layout are locked.
4. The existing restaurant designs in `src/lib/kitDesigns/*` are frozen. Nothing in this project may change their output, not by one byte. The golden harness (below) enforces it.
5. Analytics use one fixed event list and the same tags (`category`, `design`, `tpl`) for every category.
6. There are no real customers yet, so old shapes are deleted in the phase that replaces them. There is no backfill and no dual-read.

## Golden harness (built in P0)

`tests/golden/guest.ts` renders every guest-facing look with fixed test data and stores a SHA-256 of each result in `tests/golden/index.json`: all 14 restaurant designs in ten data shapes each (sample menu, owner menu with odd characters, orders on and off, custom slots, empty menu, Sinhala and Tamil, branding off, password set), the generic themed restaurant look, the legacy Kit page, all page templates, the three form presets, and the simple code types. CI runs `npx tsx tests/golden/guest.ts --check` and fails on any difference. If the HTML and CSS are byte-identical, the page looks pixel-identical. Only the owner may approve `--update`.

## Categories (planned)

| Category | `qr_type` | Designs |
|---|---|---|
| restaurant | `page` | the 14 existing designs, plus `original` (the legacy Kit look) and `blank` (the generic themed look) |
| page | `page` | `default` (today's renderer) plus skins |
| form | `form` | `default` (today's form look) plus skins |
| vcard, wifi, event | same name | landing designs, built last |
| text, email, url | same name | none (redirect or plain text) |

A restaurant keeps `qr_type = 'page'`, so plan limits and the Worker keep working. The category is set when the object is created and never changes.

## Slot catalog (approved)

| Category | Slots |
|---|---|
| restaurant | `accent` (colour), `hero` (image), `headline` (text, 40 characters). These are exactly the slots the 14 designs already have. |
| page | `accent` (colour), `avatar` (image), `cover` (image), `headline` (text, 40) |
| form | `accent` (colour), `logo` (image), `cover` (image) |

Validation is the same as `slotValues()` in `src/lib/designs.ts`: images must be `https://` and at most 480 characters, colours are `#rrggbb`, text has tags stripped and a length cap. A design lists which of the catalog slots it exposes and a default for each; the editor shows only those.

## Restaurant contract v1 (planned)

```
{ v: 1,
  header:  { name, tagline },
  description?,                       // the text under the header
  menu:    { currency, prices, sections: [{ id, name, items: [{ id, name, description?, price?, image? }] }] },
  buttons: [{ id, kind: 'review' | 'whatsapp' | 'call' | 'extra', label, url }],
  offer?:  { title, text },
  wifi?:   { ssid, password },
  brand?,                             // the colour the print sheet and the blank look use
  theme?,                             // only the blank look reads it, as today
  slots:   { accent?, hero?, headline? },
  orders?: { on },
  i18n?:   { si?, ta? } }             // keyed by id
```

The design HTML tokens are unchanged, including `{{item.ref}}` (`section.item` by position). Orders keep their `[section, item]` references and the name check that returns 409.

## Events (planned)

One catalog in `src/lib/events.ts`. Each category allows a subset. `scan` is the page view for every category.

| Category | Events |
|---|---|
| restaurant | `item_add`, `cart_open`, `order_placed` (server), `link_click`, `lang_switch`, `wifi_copy` |
| page | `link_click`, `vcf_save`, `lang_switch` |
| form | `form_start`, `form_submit` (server) |
| vcard | `vcf_save` |
| wifi | `wifi_copy` |
| event | `ics_save` |

Events marked "server" are written by the server and are exact. The others come from the page through one batched beacon and are best effort (ad blockers can drop them). No raw IP address or user agent is stored. Raw event rows are kept 90 days; counters are kept.

## Owner decisions

Slot catalog approved. About half of the designs per category are Pro-only (`premium` flag in `plans.ts` and the design manifest). Old test pages are deleted when migration 018 runs. Landing designs for vCard, Wifi and Event are built in the last phase.
