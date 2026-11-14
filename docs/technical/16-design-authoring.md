# 16. Design authoring: how to add a design

A design is the look of one category's public page. It never owns data. It reads the category's contract ([15-data-contract.md](15-data-contract.md)) and draws it.

## What a design may do

- Draw any of the contract fields. Fields it does not draw are simply not shown, and the editor says so (the design's `uses` list in the manifest).
- Expose some of the category's slots (accent colour, images, a short text). Nothing else is owner-editable.
- Be completely different in layout, fonts and CSS from every other design in the category.

## What a design must not do

- Store or require data of its own. All data is in the contract.
- Change the contract. A new input is a contract change (version bump), made once for the whole category.
- Load third-party CSS or more than two web fonts, or exceed the size budget (new designs only; the existing restaurant designs are frozen).

## Checklist for a new restaurant design

1. Add the design file in `src/lib/kitDesigns/` (HTML with tokens, CSS, sample menu, slots). Use the same slot keys as the others (`accent`, `hero`, `headline`).
2. Scope every CSS rule under one root class so nothing leaks into the shell or other blocks.
3. Add the three order hooks (`data-scnr="add"` per item with `data-ref="{{item.ref}}"`, `data-scnr="cart-bar"`, `data-scnr="order"`), or the design cannot take orders.
4. Add the design to `src/lib/kitDesigns/index.ts` and to the manifest (name, group, which fields it shows, whether it supports orders, whether it is Pro-only).
5. Run the contract test with the empty, minimal and maximum fixtures, and slot values at their extremes (long text, bad colour, missing image).
6. Add the design to the golden harness (`tests/golden/guest.ts` picks up every design in the registry automatically) and run `--update` once, with the owner's approval, because a new design is a deliberate addition.

Existing designs are frozen. To change one, the owner has to ask for it by name.

## Page and form designs

These are CSS skins over fixed markup with stable class names. A skin cannot change the structure, only how it looks. If a design needs a different structure, it needs its own HTML template like a restaurant design, which is a larger change.
