# Design — Classe A Barbearia

The app is the shop's physical world carried onto a phone: matte black ACM panels, a back-lit gold sign, gold piping and stitching, Portuguese wave pavement at the door. Every visual rule below traces back to one of those objects.

## World

| Physical reference | UI expression |
|---|---|
| Back-lit gold sign on black wall | Diffuse gold halo behind the logo (hero, login, final CTA), slow 4 s pulse |
| Matte ACM façade panels | `--ink-*` surfaces with 3 % film grain; glass panels over slow gold orbs |
| Gold piping on shirt and cape | 1 px hairline gold borders on cards and buttons |
| Gold stitching on the cap brim | `Divider variant="stitch"` — dashed gold line between blocks |
| Razor forming the "A" | Brand mark, favicon, loader (razor opening), empty states |
| Portuguese wave pavement | `WaveDivider` SVG, low opacity, before/after "O Espaço" |
| White marble floor | Marble texture only on the annual plan card |
| B&W mural | Photos in grayscale; colour on hover / in view |
| "— BARBEARIA —" lettering | `SectionTitle`: spaced caps between two gold rules |

## Tokens

Source of truth: `src/styles/tokens.css` (exposed to Tailwind via `@theme`).
Ink 950→600, gold 400/500/600/700, text 100/400, success, danger. Gold metallic gradient only on primary buttons, highlighted borders and price numerals. Text on gold is always `--ink-950`.

## Type

- Display/labels: Barlow Condensed 600, uppercase, `letter-spacing: .12em`.
- UI/body: Manrope 400/500/700; numerals `tabular-nums`.
- The logo is the only script lettering. No script fonts.
- Scale: 12 · 14 · 16 · 18 · 22 · 28 · 36 · 48 · 64 (hero clamp up to 72).

## Glass

`.glass` / `.glass-gold` from the brief. Glass is only used where something moves behind it (orbs, photos, scrolling content): header, sticky booking summary, tab bars, sheets, cards over the orb field. Lists get one glass container, never glass per row. Max 3 blurred layers visible on list screens.

## Motion

Ease `cubic-bezier(.22,1,.36,1)`; 150 / 250 / 450 / 800 ms. One authored moment per surface: the hero sign lighting up. Everything else is quiet: 24 px rise on scroll, sliding booking steps, gold pill `layoutId`. `prefers-reduced-motion` keeps opacity only.

## Components

See `/design-system` in development. Button (primary metallic / glass / ghost / danger), Card, SectionTitle, Divider (stitch), WaveDivider, Chip, SlotPill, Stepper, DayStrip, Sheet (bottom sheet < 768 px, modal ≥ 768 px), Toast, Input (floating label + mask), Switch, Tabs, Avatar, Badge, Skeleton (gold shimmer), TabBar, EmptyState (razor).

## Browser surfaces

Gold `::selection` on ink, gold caret, thin dark scrollbars with gold thumb on hover, 2 px gold focus ring with 2 px offset.
