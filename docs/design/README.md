# Design — release 2a ("Gym floor at night")

Approved by the owner on 2026-10-16. The mockups in `mockups/*.dc.html` are the visual source of truth
(HTML with inline styles; read them for exact colours, sizes, spacing and copy). `brief-ronde2.md` has the
research and the design brief (palette, type scale, motion, do/don't).

Release 2a scope: new design system + restyle of all existing screens, Voortgang (progress/stats),
Supplementenschema (supplement schedule with stock → ReorderCard), Mijlpalen (badges, weekly goal; no prize challenge).
NOT in 2a: Voeding/macro tracker, body measurements, monthly challenge with prize (release 2b). The tab bar in 2a has
4 tabs: Vandaag, Trainen, Shop, Ik (Voeding tab arrives in 2b).

Key tokens: bg0 #08090A, bg1 #111416, bg2 #1A1E21, bg3 #252B2F, border #2C3338, borderStrong #3A434A,
text1 #F2F4F3, text2 #A7B0B5, text3 #7E8990, accent #1FC7B6, accentText #4FE0D0, accentMuted #0E2F2C,
accentBorder #1F4D48, success #3DD68C, gold #F5B544 (bg #2E2410, border #5A4A22), error #FF6166.
Data series: #1FC7B6, #A594FF, #F2B33D, #FF7F6E, #4EA8F5.
Fonts: Barlow Condensed 700/800 (display, hero numbers, UPPERCASE titles), Barlow 400/500/600/700 (UI/body),
tabular-nums on every weight/reps/timer number. Dark theme only in v1, but keep tokens swappable for a later light theme.
Accent turquoise only for: primary action, live state (running workout/timer), completed sets. Never on exercise names or headings.
Icons: own SVG icons via react-native-svg (no icon library), 24px, 2px stroke.
Owner's exact logo hex is unknown; keep #1FC7B6 in ONE token so it can be swapped.

## Design system (`src/ui`) — component catalogue

Everything is imported from `@/ui`. Tokens live in ONE file, `src/ui/tokens.ts` (colours, spacing, radii,
layout, motion, font names); the brand turquoise is the single `ACCENT` constant. Read tokens through
`useTheme()` (`colors`, `space`, `radius`, `layout`, `motion`, `type`, `fonts`). Never hard-code hex values,
font families or font sizes in a screen.

**Fonts.** `app/_layout.tsx` loads Barlow + Barlow Condensed with `useFonts`, keeps the splash up until they
are ready, and gives up after `FONT_LOAD_TIMEOUT_MS` (2.5 s). Without fonts the theme falls back to the
system font (with matching weights), so never set `fontFamily` yourself: use a `Text` variant.

**Type scale (`<Text variant>`).** `display` 40 condensed UPPERCASE (tab-screen title) · `hero` 48 condensed
tnum (the one big number; 96 on the PR card via `style={{ fontSize: 96, lineHeight: 92 }}`) · `title` 28
condensed UPPERCASE (card/sub-screen title) · `metric` 32 condensed tnum (stat numbers) · `heading` 17 bold
(exercise name) · `body` 15 · `bodyStrong` 15 semibold (row titles) · `caption` 13 (meta lines) · `eyebrow`
11 bold UPPERCASE tracked · `button` 16 bold · `micro` 11 (tab labels, axes). Tones: `default` (text1),
`secondary` (text2), `tertiary` (text3), `accent` (accentText), `success`, `gold`, `danger`, `onAccent`.
Add `tnum` to every changing number that is not already `hero`/`metric`.

| Component | Use it for |
|---|---|
| `Screen` | Every screen. Safe area, bg0, 20pt gutter, 16pt rhythm. `title` (+`eyebrow`, `subtitle`, `headerRight`); `onBack` gives a back chevron and the smaller title; `footer` for one sticky CTA; `scroll={false}` when the screen owns a FlatList. |
| `Text` | All text. Variants/tones above. |
| `Button` | Actions. `primary` = the ONE accent action per screen (haptic light); `secondary` neutral; `ghost` quiet ("Skip"); `link` accent text ("+ Set toevoegen", "Bestel"); `danger`. Sizes `lg` 52 (screen CTA, `fullWidth`), `md` 48, `sm` 40 (inline; hit area stays 48). Optional `icon`. |
| `IconButton` | Icon-only action. `accessibilityLabel` is required. `plain` (back/more/settings), `outline` (round header action, `badge` for the cart), `filled` (add-to-cart, steppers), `accent`. |
| `Card` | Grouping surface. `default` bg1 + hairline; `hero` turquoise gradient, max ONE per screen (next workout, challenge); `gold` PR celebration; `inset` bg2 well. `eyebrow`, `padding` (0 for row lists), `onPress` makes it tappable. |
| `StatTile` | A number with a label: `label`, `value` (pre-formatted nl-NL), `unit`, `caption`, `delta` (`up` = green arrow; down stays grey, never red), `footer` (e.g. ProgressBar). `bare` inside a hero card. Put 2–3 in a row. |
| `ProgressBar` | Continuous progress 0..1 (protein 112/180, stock left). `tone="gold"` for "running low" (no red). |
| `SegmentBar` | Discrete goals: weekly goal (`total` 3–7), monthly challenge (`total` 12, `height` 8). Needs an `accessibilityLabel`. |
| `Ring` | Circular progress (rest timer, kcal); put the time inside as children. |
| `Pill` / `Badge` | `Pill` = non-interactive status ("Bestseller" accent, "Nieuw persoonlijk record" gold `size="md"`). `Badge` = count bubble on an IconButton. |
| `Chip` / `Segmented` | `Chip` = filter choice (shop categories), selected is light, not turquoise; in a horizontal ScrollView. `Segmented` = 2–4 views of one screen (Oefening/Week/Lichaam). |
| `ListRow` | Rows in a Card with `padding={0}`: settings, supplements, orders. `leading` icon name (bg2 well) or node, `value`, `trailing`, `chevron`, `divider`, `done` (struck through), `destructive`. `ListItem` is the deprecated release-1 wrapper. |
| `SectionLabel` / `Divider` | Eyebrow header above a block, with a right `value` ("2 van 4 trainingen") or `action` link ("Alles"). `Divider` = hairline. |
| `EmptyState` / `Avatar` | Empty lists: icon, title, body, next-step `action`. `Avatar` = initials circle (44 header, 56 profile). |
| `LineChart` | Progress over time (e1RM, heaviest set): `data[{ value, pr }]`, `xLabels`, `legend`, required `accessibilityLabel` sentence. Gold dots = PRs. |
| `BarList` | Horizontal bars with label + value: sets per muscle group, stock days. |
| `LiveDot` / `LiveBar` | "Live now" only: pulsing turquoise dot; `LiveBar` is the bar above the tab bar (used by `ActiveWorkoutBar`). |
| `Icon` | Own SVG set, 24 grid, 2px stroke: `<Icon name size color filled />`. Names in `src/ui/icons/glyphs.ts`; add new glyphs there (no icon libraries). Decorative: label the control around it. |
| `PressableScale` | Base for custom tappables: 0.97 press scale (reanimated, off with reduce motion) + haptic. |
| `haptics` | `light` (primary press, set ticked), `medium` (workout finished, timer done), `success` (PR, badge, weekly goal), `selection` (chips, tabs, steppers). Never throws. |

**Rules for the screen builders.** Turquoise only for the primary action, live state and completed sets (set
row bg `accentMuted`, check box `accent` with an `onAccent` check). Gold only for PRs/achievements. Cards
have no shadows. Touch targets ≥ 48 (≥ 44 visual + hitSlop). Numbers: `tnum`, nl-NL formatting
(`18,4`, `2.775`). Every icon-only control has an `accessibilityLabel`; charts have a one-sentence summary.
