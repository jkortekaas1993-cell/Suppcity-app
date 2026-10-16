# Ronde 2 — research functies + design (16 okt 2026)

## Functies (MVP)
1. Macroteller: kcal/eiwit/kh/vet, neutrale kleuren (geen rood/"te veel"), schakelaar "calorieën verbergen" (standaard eiwit-only voorgesteld). Bronnen: NEVO 2025 (RIVM, gratis, ongewijzigd + bronvermelding, geen kosten aan gebruiker) voorgeladen; Open Food Facts online (ODbL, 15 product/10 zoek per min, eigen User-Agent, cache gescheiden houden); Supp City-producten via Shopify-metafields. Barcode via expo-camera (EAN-13/8). Recent, favorieten, maaltijd kopiëren, snel toevoegen. Doelen: Mifflin-St Jeor "schatting, pas zelf aan", max ~20% tekort, 16+, link naar hulp. Aparte toestemming nutrition_sync; eetlog = gezondheidsdata (regel 1).
2. Supplementenschema: eigen dosering als tekst (app stelt nooit zelf dosis/moment voor), per weekdag/trainingsdag/rustdag + tijd, melding met "Ingenomen/Later", innamelog, voorraad automatisch aftrekken → ReorderCard. iOS max 64 lokale meldingen.
3. Mijlpalen & maandchallenge: badges lokaal, geven nooit punten; weekdoel i.p.v. dagstreak; challenge telt alleen aantal workouts (max 3/week), iedereen die haalt krijgt prijs (geen loting), 18+, server stelt voltooiing vast, kortingscode voor gratis product, voorwaarden op één scherm.
4. Voortgang: grafieken per oefening (e1RM 1–10 reps, zwaarste set, volume, PR per reps), weekoverzicht, spiergroepen-heatmap (react-native-body-highlighter), lichaamsgewicht/omvang met aparte toestemming body_metrics, standaard lokaal. Onbeperkte historie gratis (Hevy beperkt tot 3 mnd).

## Design-brief "Gym floor at night"
Donkere sportschool om middernacht; alleen jouw cijfers lichten op in turquoise. Principes: cijfers zijn de held; turquoise = "jij, nu"; elke tik voelt fysiek.
Palet: bg0 #08090A, bg1 #111416, bg2 #1A1E21, bg3 #252B2F, border #2C3338, text1 #F2F4F3, text2 #A7B0B5, text3 #7E8990, accent #1FC7B6, accentText #4FE0D0, accentMuted #0E2F2C, success #3DD68C, PR-goud #F5B544, error #FF6166. Data: #1FC7B6, #A594FF, #F2B33D, #FF7F6E, #4EA8F5.
Fonts: Barlow Condensed 700/800 (koppen, hero-cijfers), Inter (UI, tnum). Alleen donker thema in v1.
Componenten: kaarten zonder schaduw, set-rij 56pt met SVG-vink, stat-tegels, eigen SVG-grafieken, SVG-iconen (lucide), tabbar met blur. Haptics bij set/PR/timer, timerring.
Pakketten: expo-font + google fonts, react-native-svg, reanimated, expo-haptics, expo-linear-gradient, expo-blur, lucide-react-native, expo-camera.
Open: exacte logo-hex van eigenaar.
