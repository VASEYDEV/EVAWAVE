# 2026-09-26 · Brand restyle to the Vasey Multimedia Brand System v2.0

Owner request: "Generate a gorgeous front-end using the Vasey Multimedia style and branding
guide." Scope confirmed as a restyle of the existing app (Composer, Import, Library, Sign-in):
behaviour, routes, markup roles and the e2e catalogue unchanged; presentation, tokens,
typography and the few markup hooks a style needs. The guide (21 pages, §03–§07 binding)
arrived as an attachment and is kept as ground truth at
`docs/design/reference/vasey-brand-system-v2.0.pdf`. The application record is
`docs/design/brand-application.md`; the decision is ADR 0005.

## Owner decisions

1. CORE only: the SPEC §1.9 per-module hue table is retired.
2. Semantic states by typography, no new colours.
3. Lockup `EVAWAVE` with a `VASEY/AI` kicker; the kicker's slash is the page's one BEAM.
4. Token values from the PDF; no `vasey-tokens.json` or vector mark supplied.

## What changed

- `src/app/styles/{tokens,base,type,components,pages}.css` replace `globals.css`; imported in
  that order from `layout.tsx`, so the cascade is the file order.
- `src/app/fonts.ts` + `src/fonts/`: Bebas Neue, Reddit Sans and JetBrains Mono as woff2
  (converted from the google/fonts OFL sources with fonttools), self-hosted through
  `next/font/local`, with their OFL texts beside them.
- `layout.tsx`: kicker, wordmark, tagline, nav; `themeColor` `#052E3A`.
- `Module.tsx`, `import/page.tsx`, `library/page.tsx`: the inline `--hue` styles go;
  `data-hue` becomes `data-icon`.
- `className="primary"` on the four main actions (Create style profile, Save to library,
  Save the composer's spec as a profile, the sign-in submit).
- Docs: ADR 0005; SPEC §1.9 rewritten and §1.11's lockup item closed; CLAUDE.md gains one
  Project Notes invariant (design source of truth; a new colour requires a retirement);
  CHANGELOG; README mark line, hero screenshot and brand-application link.

## Found on the way

- **Turbopack and `next/font/local` `declarations`.** The build failed with
  `Can't resolve '@vercel/turbopack-next/internal/font/local/cssmodule.module.css'`
  (`font_options_from_query_map failed`, "expected `,` or `}`"). Turbopack serialises the
  font options into a JSON query string and does not escape double quotes inside a
  declaration value, so `"liga" 0, "calt" 0` broke the JSON. Single-quoted feature tags
  (`'liga' 0, 'calt' 0`) are equally valid CSS and build; the generated `@font-face`
  carries `font-feature-settings:"liga" 0, "calt" 0` (checked in the built CSS chunk).
- **Family names under Turbopack** are the export names (`sans`, `bebas`, `jetbrains`),
  not the file names. `tests/e2e/brand.spec.ts` therefore resolves each role's computed
  family through the page's `@font-face` rules to the woff2 URL it loads, and reads the
  feature setting off the same rule, rather than matching a bundler-chosen name.
- **The beam fell instead of rising.** With `transform-origin: right bottom`, a negative
  rotation sends the free end below the baseline, where the header clips it, so nothing
  showed. Anchored at `left bottom` it rises to the right like the house slash. Checked at
  412, 768, 1024 and 1280 px: it stays clear of the tagline and nav at every width.
- The native file-picker button (`::file-selector-button`) and the budget meters (an 8 px
  track with a bordered inner bar read as a double hairline) needed their own rules.

## Evidence

- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium bash scripts/gate.sh`:
  `GATE: PASS` (standards, lint, typecheck, 632 unit and integration, build, 18 e2e, client
  bundle, audit). The e2e count is 16 + the two brand tests; axe WCAG 2.2 AA still passes
  on `/`, `/import`, `/library` and `/login`, and `scrollWidth` equals `innerWidth` with
  every module open at the Pixel 7 width and at 1280.
- Contrast: every guide §10 figure reproduces to two decimals; the app's pairings and
  thresholds are tabled in `brand-application.md` §1.
- Mutations, each caught: Turquoise off by one hex digit fails the palette and matrix
  tests; a missing `BebasNeue-Regular.woff2` fails the fonts tests; a second BEAM use
  (`.tagline { color: var(--vm-beam) }`) fails the unit count and the e2e ("Expected: 1,
  Received: 2").
- Screenshots on the production build in `docs/design/screenshots/` (Pixel 7 and 1280 px),
  reviewed against the guide's rules: four inks, one BEAM, no filled mark, Bebas never
  below 17 px, no emoji.
- Keyboard walk: the 3 px Turquoise ring is visible on every control on both surfaces
  (5.23:1 on Charcoal, 6.07:1 on the field).

## Not done, and why

- Favicon, app-icon suite and manifest: need the VASEY/AI vector mark (marks are traced,
  never invented). The README mark stays deferred.
- Light mode: the app is dark-only; the guide's "both modes" check has one mode to check.
- BEAM value confirmation (`#22E8F5` vs legacy `#4BC2F0`) is the guide's own open item.
- `vasey-tokens.json`: replace the hand-copied values when it exists.
- Adjacent, listed not fixed (CLAUDE.md §1.1): the header comment in
  `scripts/build-module-icons.mjs` still says the inline SVG "takes the module hue"; the
  script's output is unchanged and `--check` still passes, so the comment is left for a
  follow-up rather than touching a generator in a restyle.
