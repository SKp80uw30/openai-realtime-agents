# Orb layout — why the orb vanished, and the rules that keep it on screen

Written after a P1 on 2026-09-12: the orb disappeared from the showcase screen while
every other element still rendered. Two independent faults were found. Both are fixed;
this document exists so neither class of fault is reintroduced.

Read this before changing anything in the action dock (`MicButton`, `CapabilityChecklist`)
or the orb's sizing in `OrbShowcase.tsx`.

---

## Fault 1 — the orb's size budget was a guess about the dock

### What broke

`OrbShowcase.tsx` sized the orb as:

```
w-[min(62vw, 46dvh, 320px)]
```

The `46dvh` term was there to stop a short screen from squeezing the dock off the bottom.
It encodes an assumption: *"the header and the dock together leave the orb roughly half the
viewport."* That assumption was true when it was written and is nowhere stated in code.

The screen is a three-band grid:

```
grid-rows-[auto_1fr_auto]   header / orb / dock
```

The dock then grew by ~145px — a reserved hint band so tooltips stop covering the mic, a
two-row capability grid, and a taller mic pill. Nothing about `46dvh` changed, because
nothing connects the two. The `1fr` middle row silently absorbed the entire loss.

Because `main` centres its content (`justify-center`) and is `min-h-0`, an orb too tall for
its row does not shrink — it **overflows in both directions**: off the top of the viewport,
and downward underneath the dock, which paints over it. The page root is `overflow-hidden`,
so there is no scrollbar and no error. The orb is simply gone.

### Measured, before the fix

| viewport | dock | orb row | orb top | result |
|---|---|---|---|---|
| 430×932 | 332 | 570 | 30 | fine |
| 1440×700 | 344 | 308 | 7 | orb 50px taller than its row, bleeding under the dock |
| 1280×540 | 360 | 132 | **−42** | top clipped, bottom hidden behind the dock |
| 756×469 | 360 | 61 | **−59** | effectively invisible |

### The rule

> **A fraction of the viewport is not the orb's budget. The viewport minus the header and
> the dock is.** Never express the orb's size as a `dvh`/`vh` fraction — that number is a
> guess about the dock's height, and it goes stale the moment anyone touches the dock.

### The fix

The orb is now capped by width and *sized by the height it actually has*:

```html
<div className="flex min-h-0 w-full flex-1 items-center justify-center">
  <div className="aspect-[1/1.12] h-full w-auto min-w-0 max-w-[var(--orb-size)]">
    <OrbVisualizer … />
  </div>
</div>
```

- `h-full` + `aspect-[1/1.12]` derive the **width from the row's height**.
- `max-w-[var(--orb-size)]` caps it on tall screens.
- Whichever axis is scarcer wins, automatically. There is no number to keep in sync, so a
  future dock change cannot desync it.

`--orb-size` is now `min(62vw, 320px)` — width terms only. The `dvh` term is deliberately
gone; do not add one back.

#### `min-w-0 w-auto` is load-bearing

Without it the fix silently does nothing. CSS gives a block an **automatic minimum size**
(`min-width: auto` = min-content). The orb scene inside sets `width: 100%`, which pushes the
wrapper's min-content width up, and that minimum **overrides the aspect ratio** — the wrapper
keeps its full width and the scene re-derives its height from that width, overflowing exactly
as before.

Verified: with `h-full max-w-[…]` alone at 1280×540 the wrapper measured 248×99 while the
scene inside stayed 248×**278**, still overflowing. Adding `min-w-0 w-auto` collapsed both to
88×99. If you ever see the orb overflow again, check these two classes first.

### Verified after the fix

13 viewports from 360×640 to 1512×600, including every previously failing size:

```
    viewport  hdr  main  dock    orb w×h   top  sphere  pill  verdict
     430x932   30   570   332    267x299    30     191   191  ok (aligned)
    1440x800   48   408   344    320x358    48     229   229  ok (aligned)
    1440x700   48   308   344    246x276    48     176   229  ok (orb height-capped)
    1280x540   48   148   344    103x116    48      74   229  ok (orb height-capped)
     756x469   48    77   344      40x45    48      28   229  ok (orb height-capped)
 → ALL 13 VIEWPORTS PASS (no off-screen, no row overflow, no horizontal scroll)
```

### Re-running the check

[`scripts/check-orb-viewports.mjs`](../scripts/check-orb-viewports.mjs) reproduces the table
above. Run it after any dock or orb-sizing change — it exits non-zero on any off-screen orb,
row overflow, or horizontal scroll. Usage is in the header of the script.

### Known trade-off, accepted

When the orb is height-capped, it becomes narrower than `--orb-diameter`, so the mic pill and
capability grid are wider than the sphere and the deliberate alignment is lost. The orb also
gets genuinely small on very short windows (23px wide at 1024×450).

This is the right trade: **visible and misaligned beats invisible.** If short-window quality
matters later, the fix is to make the *dock* yield — collapse the reserved hint band and the
mic caption under a `[@media(max-height:…)]` variant — not to reintroduce a `dvh` cap on the orb.

### Alignment contract

`OrbShowcase.tsx` publishes two custom properties on the grid container:

| property | meaning |
|---|---|
| `--orb-size` | the visualiser's **box** |
| `--orb-diameter` | the **drawn sphere**, `--orb-size × 0.715` |

`0.715` is not arbitrary — it is the sphere's inset in
[`liquidGlass.module.css`](../src/app/components/orb/themes/liquidGlass.module.css) (`width: 71.5%`).
**If that percentage changes, change `--orb-diameter` with it**, or the dock will align to a
silhouette the orb no longer has.

The mic pill and the capability grid both measure against `--orb-diameter`, which is why they
line up with the sphere rather than with the invisible box around it. Both carry fallbacks
(`var(--orb-diameter, 17rem)` / `var(--orb-diameter, 22rem)`) so the components still render
sanely outside this screen. An undefined var does **not** hide an element — it falls back to
`auto` width, which measured 420px instead of 216px. Silent wrongness, not absence.

---

## Fault 2 — `next build` run against a live `next dev`

### What broke

```
⨯ Error: Cannot find module './996.js'
Require stack: …/.next/server/webpack-runtime.js
```

`next dev` and `next build` share one `.next/` directory. Running a build while the dev server
is up **replaces the dev server's chunks underneath it**. The dev server keeps serving module
references that no longer exist. Pages return 200 with broken or missing client chunks, so
hydration dies and client-driven UI — the canvas orb above all — never paints, while the
server-rendered markup around it looks perfectly normal.

This also caused an unexplained `404` earlier in the same session that was written off as
"stale dev-server state". It was the same root cause, undiagnosed.

### The rule

> **Never run `npm run build` while `npm run dev` is running.** Stop the dev server first,
> or build into a separate directory.

```bash
# safe: stop dev, build, restart
pkill -f "next dev" && npm run build && npm run dev

# safe: build somewhere else, dev keeps running
DIST_DIR=.next-build npm run build      # requires distDir wired in next.config
```

### Recovering from it

Symptoms are `Cannot find module './<n>.js'`, unexplained 404s on routes that exist, or UI
that renders but is inert.

```bash
pkill -f "next dev"
rm -rf .next
npm run dev
```

A `.next/` holding `export-marker.json`, `prerender-manifest.json` or `*.nft.json` while a dev
server is running is the tell — those are production build artefacts.

---

## Checklist before touching the dock

1. Does the dock get taller? The orb now absorbs that automatically — but re-run the viewport
   matrix to confirm, don't assume.
2. Did you add a `vh`/`dvh` term to the orb's size? Don't.
3. Did you keep `min-w-0 w-auto` on the orb wrapper?
4. Did the sphere's inset in `liquidGlass.module.css` change? Update `--orb-diameter`.
5. Verify at a short window (1280×540) as well as a phone — **the short window is where this
   class of bug shows up first, and phones will not catch it.**
