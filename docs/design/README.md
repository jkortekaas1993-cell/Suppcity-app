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
