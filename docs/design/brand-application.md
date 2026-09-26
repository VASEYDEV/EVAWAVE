# Brand application: EVAWAVE under the Vasey Multimedia Brand System v2.0

**Status:** applied, 2026-09-26 (ADR 0005). **Source:** `docs/design/reference/vasey-brand-system-v2.0.pdf`,
§03–§07 binding. **Where it lives:** `src/app/styles/` (`tokens.css` → `base.css` → `type.css` →
`components.css` → `pages.css`, imported in that order from `src/app/layout.tsx`), `src/app/fonts.ts`,
`src/fonts/`. **What proves it:** `tests/unit/brand-tokens.test.ts`, `tests/unit/brand-fonts.test.ts`,
`tests/e2e/brand.spec.ts`, and the icon assertion in `tests/e2e/s5.spec.ts`.

This file records how the guide is applied here, what was measured, where the app departs from
the guide, and why. It is not a second brand guide: where the two disagree, the PDF wins and
this file is wrong.

## 1. Colour

EVAWAVE is a VASEY/AI product (ADR 0002), so it draws on the CORE palette plus V/AI's signature.
Every value is a hex literal in `tokens.css` so the unit test can measure it.

| Token | Value | Guide name | Role in EVAWAVE |
| --- | --- | --- | --- |
| `--vm-turquoise` | `#00B8D9` | Turquoise | Headings, links, primary action fill, icons, focus ring, the open module's rule and glow, the header beam |
| `--vm-teal` | `#397281` | Teal | Structure: the closed module's rule, the header baseline, the warn rule |
| `--vm-field` | `#052E3A` | Deep Turquoise | The page field; the well inside inputs on a Charcoal panel |
| `--vm-navy` | `#191970` | Navy | Unused in v1; kept as CORE |
| `--vm-accent-blue` | `#454CFC` | Accent Blue | Unused in v1; never text on Charcoal (2.18:1) |
| `--vm-silver` | `#C9D0D3` | Silver (bookend) | Body text, wordmark, quiet buttons, primary button hover fill |
| `--vm-charcoal` | `#29363F` | Charcoal (bookend) | Elevated surfaces (modules, panels, cards); ink on Turquoise fills |
| `--vm-beam` | `#22E8F5` | BEAM (V/AI signature) | The kicker's slash, once per page, nothing else |
| `--vm-line` | `#798389` | derived: Silver 50 % into Charcoal | Control borders, dividers, the quiet button's border |

Rules kept from the guide: five chromatic values plus two bookends; four inks on a page
(Silver, Turquoise, Teal, Charcoal); one signature per frame; Turquoise fills carry Charcoal
ink; anything between the bookends is a surface tint, not a colour, so `--vm-line` is the one
tint and there is no muted text colour. Hierarchy comes from the type scale. A new colour
requires a retirement.

### Measured contrast (WCAG 2.x relative luminance, as the guide's §10 matrix)

The guide's published figures reproduce to two decimals; the test holds them there.

| Pairing | Ratio | Use | Threshold |
| --- | --- | --- | --- |
| Silver on Deep Turquoise | 9.22 | body text on the field | AAA 7 |
| Silver on Charcoal | 7.94 | body text on panels | AAA 7 |
| Turquoise on Deep Turquoise | 6.07 | page headings, links, icons | AA 4.5 |
| Turquoise on Charcoal | 5.23 | module headings, icons, rules | AA 4.5 |
| Charcoal on Turquoise | 5.23 | primary button ink | AA 4.5 |
| Charcoal on Silver | 7.94 | primary button hover ink | AAA 7 |
| BEAM on Deep Turquoise | 9.55 | the kicker's slash | AAA 7 |
| BEAM on Charcoal | 8.22 | (not used; recorded from the matrix) | |
| Line on Charcoal | 3.20 | control borders, dividers (WCAG 1.4.11) | UI 3 |
| Line on Deep Turquoise | 3.72 | control borders on the field | UI 3 |
| Turquoise focus ring on Charcoal / on the field | 5.23 / 6.07 | `:focus-visible` | UI 3 |
| Teal on Silver | 3.45 | (matrix figure; Teal is never text here) | |
| Teal on Deep Turquoise / on Charcoal | 2.67 / 2.30 | structural rules only, never text or a lone indicator | |
| Accent Blue on Charcoal | 2.18 | never text (the test forbids `color: var(--vm-accent-blue)`) | |

Teal fails text thresholds on both surfaces, which is why it only ever draws a rule beside
text that already says what the rule means (a closed module, a warning).

## 2. Typography

Three families, closed, self-hosted under the SIL Open Font License through `next/font/local`
(`src/app/fonts.ts`; the woff2 files and OFL texts are in `src/fonts/`). No request leaves for
a font host; the unit test scans `src/` for one. The bundler names each family after its
export (`sans`, `bebas`, `jetbrains`), so the e2e resolves each role through the page's own
`@font-face` rules to the file it loads.

| Guide style | Size / weight / tracking | Element |
| --- | --- | --- |
| D5 (display) | 38 px / 400 / +0.03 em, Bebas Neue, caps | `h1.wordmark` `EVAWAVE`, the one display size per page |
| Kicker | 17 px / 400 / +0.24 em, Bebas Neue, caps | `.kicker` `VASEY/AI` (17 px is the smallest permitted display size) |
| H2 | 26 px / 600, Turquoise | `.page h2` (Import audio, Library, Sign in) |
| H3 | 21 px / 600, Turquoise | `.module h2` (module titles) |
| H4 | 18 px / 600 | `.panel h2`, `h3` |
| BodyS at heading weight | 14 px / 600 | `h4` |
| Body | 16 px / 1.65 / 400, Reddit Sans | `body` |
| BodyS | 14 px | `.tagline` |
| Label weight at BodyS size | 14 px / 700 | form `label` (deviation, §5) |
| Label | 11 px / 700 / +0.14 em, caps | `legend`, `.module-owns` |
| Caption | 13 px / 500 | `.hint`, `.features dt`, `.chips li` |
| Data | 12 px / 500 / +0.03 em, JetBrains Mono, tabular | `.readout`, `.tap`, `.module-number`, `.features dd`, live panel lines, meter labels |
| Code | 14 px / 400, JetBrains Mono | `code`, `.grid`, `textarea[readonly]` |
| Micro | 10 px / 600 / +0.08 em, caps, JetBrains Mono | `.badge` |

JetBrains Mono ships with `font-feature-settings: 'liga' 0, 'calt' 0` in its `@font-face`
(the guide: ligatures off in interfaces), and the mono roles also set
`font-variant-ligatures: none`. Prose measures at most 75 ch. Zero emoji anywhere in
`src/` (the test scans U+1F000–U+1FAFF).

## 3. Space, shape, motion

- **Space:** `--space-1…11` = 4 8 12 16 24 32 48 64 96 128 192 px; `--gap` is 12. Page gutters
  16 (phone), 48 (≥ 64 rem), 96 (≥ 90 rem); the workspace caps at 1440 px.
- **Radii:** inputs and chips 4, buttons 8, cards 12, modules and panels 16, status pill.
- **Motion:** instant 120, quick 200, base 320, slow 560 ms; easings standard
  `cubic-bezier(.22,1,.36,1)`, entrance `(.16,1,.30,1)`, exit `(.40,0,1,1)`.
  `prefers-reduced-motion: reduce` clears every transition and animation first.
- **The beam** is the only diagonal: `.app-header::after`, a 3 px Turquoise rule leaving the
  header's baseline and rising to the right at `--beam-angle` (25°), anchored at its left end
  so it stays inside the header (which clips overflow, so it never widens the page). Never
  mirrored. This is the beam *device* in Turquoise; the BEAM *colour* is the kicker's slash.

## 4. Components

- **Header:** kicker, wordmark, tagline, site nav (44 px targets, Turquoise underline on the
  current page), a 1 px Teal baseline and the beam. Exactly one `h1`, `nav[aria-label="Site"]`.
  The header is positioned for its beam, so the skip link carries `z-index: 1` to paint above
  it when focused.
- **Modules** (`section.module > details`): Charcoal, radius 16, a 3 px top rule in Teal that
  turns Turquoise when open (quick); the icon is 28 px Turquoise and gains a Turquoise
  drop-shadow when open; the number is Data mono; the "owns" line is Label. Closed and open
  differ by rule colour *and* the chevron, so state never rests on colour alone.
- **Panels** (`.panel`): Charcoal, radius 16, H4 heading; status counts as pills.
- **Fields:** inputs, selects and textareas sit on the Deep Turquoise well with a 1 px line
  border, radius 4, 44 px minimum height, Silver text; `accent-color` Turquoise for checks,
  radios and ranges; `:focus-visible` is a 3 px Turquoise outline, 2 px offset.
- **Buttons:** quiet by default (transparent, Silver 600, line border, radius 8);
  `.primary` for the panel's main action (Create style profile, Save to library, Save the
  composer's spec, the sign-in submit): Turquoise fill, Charcoal ink, hover and active Silver
  fill; `.danger` is quiet at 700, no colour: the label already says Delete. Disabled at
  55 % opacity. The file picker's native button (`::file-selector-button`) is set as a quiet
  button.
- **Groups:** `fieldset`, `.targets`, `.picker`, `.checklist`, `.optional`, `.tempo-tools`:
  1 px line border, radius 12, Label legend; an optional group with nothing in it is dashed.
- **Chips, matches, cards:** chips radius 4 on the well; `.section-card`, `.review-item`,
  `.library-list > li` radius 12.
- **Lint:** block 700 with a 3 px Turquoise left rule, warn 600 with a Teal rule, info 500
  with none; the severity word stays in the text (WCAG 1.4.1).
- **Meters:** track on the field, fill Turquoise; the label says when a budget is over.
- **Status:** `[role="status"]` and `[role="alert"]` render as a Charcoal pill with a line
  border when they have text.
- **Dropzone:** 2 px dashed line, Turquoise while a drag is over it (instant).
- **Badges** (PV-1): Micro mono on the well, radius 4.

## 5. Decisions and deviations

Owner decisions (2026-09-26), recorded in ADR 0005:

1. **CORE only.** The SPEC §1.9 per-module hue table is retired; modules differ by icon,
   number and type. Several open modules never repeat the signature because the open glow is
   Turquoise, not BEAM.
2. **Semantics by typography.** The guide lists semantic states as its own open item, so
   EVAWAVE adds no colour for block, warn, info, danger or success.
3. **Lockup `EVAWAVE` + `VASEY/AI` kicker.** Closes SPEC §1.11's lockup item. The kicker's
   slash is the page's single BEAM.
4. **Values from the PDF.** No `vasey-tokens.json` and no vector mark were supplied.

Deviations, stated:

- **Form labels at 14 px / 700**, not the guide's 11 px Label style: touch readability on a
  phone-first form. Legends and the module "owns" lines use Label as written.
- **The BEAM value** `#22E8F5` is the guide's own open item (measured vs the legacy
  `#4BC2F0`). If it moves, `tokens.css` and the two tests change together.
- **Dark only.** The guide checks both modes where both exist; EVAWAVE has one. A light
  theme, if added, takes Teal as the action colour per the guide.
- **The wordmark is Silver**, not Turquoise: it is a bookend-ink wordmark, so the page's
  Turquoise stays on what the user can act on or must read first.

## 6. Follow-ups (not in the restyle)

- Favicon, app-icon suite and manifest (`any` and `maskable`, transparent, 76 % frame): needs
  the VASEY/AI vector mark. Until then the README mark stays deferred.
- `vasey-tokens.json`, when it exists: replace the hand-copied values and re-run the tests.
- Final icon geometry belongs to the Vector Iconography project; the S5 monoline set stays
  provisional.

## 7. How to re-verify

```
npm test -- tests/unit/brand-tokens.test.ts tests/unit/brand-fonts.test.ts
npm run build && PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test tests/e2e/brand.spec.ts
```

The screenshots in `docs/design/screenshots/` were taken on the production build at a Pixel 7
viewport and at 1280 px wide; retake them after any change to `src/app/styles/`.
