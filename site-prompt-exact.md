# Build prompt — bilingual portfolio + small-business web-design site

Build me a complete, production-ready, single-page website for a freelance website designer and developer in Athens, Greece. It serves two audiences at once: **small and medium local businesses** who might buy a website, and **employers** who might hire me as a developer. It is bilingual (English and Greek), dark, precise and quiet — a boutique studio, not a SaaS template. Follow every value below exactly; where I give a number, it has been measured and tuned, not guessed.

---

## 0. Details to fill in

Everything personal lives here. The rest of the prompt uses these.

```
NAME            Antonio Mato            (Greek: Αντόνιο Μάτο)
ROLE            Website designer and developer
DEGREE          BSc in Computer Science
CITY            Athens, Greece
EMAIL           matoantonio795@gmail.com
PHONE           +30 690 768 2456        (tel: +306907682456)
GITHUB          https://github.com/Antonio-Mato          (@Antonio-Mato)
LINKEDIN        https://www.linkedin.com/in/antonio-mato-9b2098281
SITE ORIGIN     https://personalportfolio-aa146.web.app  (one constant — swap for the real domain)
PRICES          Starter €449 · Business €699 · Pro €999  (one-time)
TIMELINES       1–2 weeks · 2–3 weeks · 3–4 weeks
```

---

## 1. Hard constraints

- **One `index.html`** with all CSS in one `<style>` and all JS in one `<script>`. Vanilla HTML/CSS/JS. **No framework, no Tailwind, no React, no npm, no build tooling** — except one small Python script (section 7) that generates the Greek page.
- **Bilingual EN/EL.** Every visible string exists in both languages. English is the source.
- **One typeface for the entire site: Manrope** (Google Fonts, `wght@400..800`, `display=swap`). It must ship Greek glyphs, and Manrope does. Roles are separated by weight, size and tracking — never by a second family. No monospace anywhere.
- **Dark only.** No light theme.
- **Honest content only.** No fake testimonials, no "trusted by" logos, no invented customer counts, no fake discounts, no countdown timers, no "only today".
- Must work from 390px phones to 3840px 4K monitors, with no horizontal scrolling at any width.

---

## 2. Design system

### Palette — use these exact tokens on `:root`

| Token | Value | Use |
|---|---|---|
| `--ink-950` | `#060608` | deepest shade, text on white buttons |
| `--ink-900` | `#09090B` | **page background** |
| `--ink-800` | `#0F1219` | raised panels |
| `--ink-700` | `#161A24` | pill/card grounds |
| `--rule` | `rgba(148,170,205,.13)` | hairlines, card borders |
| `--rule-2` | `rgba(148,170,205,.26)` | stronger rules, hover borders |
| `--chalk` | `#FBFCFE` | primary text — 19.4:1 |
| `--chalk-dim` | `#88A0BA` | body copy — 7.3:1 |
| `--chalk-faint` | `#6C7F96` | labels, captions — 4.8:1, **the contrast floor** |
| `--chalk-tint` | `#C6D5F1` | second line of the hero headline — 13.4:1 |
| `--marker` | `#3B82F6` | accent as *ink*: lines, icons, links, highlights — 5.4:1 |
| `--marker-fill` | `#2563EB` | accent as *surface*: filled buttons/chips — 5.2:1 under white |
| `--marker-deep` | `#1D4ED8` | hover state of filled surfaces |
| `--on-marker` | `#FFFFFF` | text on filled accent |
| `--ease` | `cubic-bezier(.22,.61,.36,1)` | every transition |

**Why two blues:** white text on `#3B82F6` is only 3.7:1 and fails WCAG. Anything *filled* with blue uses `--marker-fill`; `--marker` is only ever used as a colour on the dark ground. The **primary hero button is white** (`--chalk` fill, `--ink-950` text, 19:1) — not blue.

The accent is used with restraint: icons, ticks, one highlighted phrase per heading, the "Most popular" badge, the filled CTA on the featured pricing card, focus rings, hover underlines. Never as large background fills.

### Background texture (whole page, `position:fixed`)
- `body::before`: a 52×52px grid of `--rule` lines at 50% opacity.
- `body::after`: SVG `feTurbulence` fractal noise (`baseFrequency .85`, 3 octaves) at ~38% opacity, `mix-blend-mode:overlay`.
Both `pointer-events:none`, under all content.

### Typography
- Family: `--f-display: "Manrope", system-ui, sans-serif`; `--f-body` and `--f-ui` both alias it.
- Body: weight **400** (not 300 — Manrope Light goes fragile as pale text on near-black), line-height 1.65.
- Display headings: weight 700–800, letter-spacing `-.02em` to `-.035em`.
- UI labels (eyebrows, nav, buttons, chips, form labels): weight **500–600**, uppercase, letter-spacing `.12em`–`.26em`, 0.55–0.8rem.
- `::selection` uses `--marker-fill` / white.

### Shape
- Cards: **2px** borders in `--rule`, radius **10px** (pricing cards, CTA bar) or **8px** (detail cards). Chips and dividers stay **1px**.
- Chips/pills: radius 100px.
- Buttons: radius 2–7px, never fully rounded.
- Shadows are rare and soft; the only strong one is under the featured pricing card.

### Layout tokens (all in **rem** — see section 6 for why)
```css
--maxw:   clamp(80rem, 74vw, 100rem);
--gutter: clamp(1.25rem, 5vw, 3.75rem);
--bar:    4rem;   /* fixed top bar height */
```
`.wrap { width:100%; max-width:var(--maxw); margin:0 auto; padding:0 var(--gutter); }`
Sections use generous vertical padding: `clamp(5.25rem, 12vw, 8.6rem)` top and bottom.

**Section header pattern** (Work, Pricing, Contact): a row with a small uppercase label on the left preceded by a 20px accent line, a small note on the right, and a `--rule-2` hairline under the row. Then a large `h2` (`clamp(2.4rem, 6.8vw, 4.5rem)`, weight 800). Do not number sections — they are not a sequence.

---

## 3. Page structure, top to bottom

### 3.1 Top bar
Fixed, height `--bar`, full width. Left: a tiny 4-cell pixel monogram in `--marker` + the name in uppercase, weight 500. Right: nav links **Work · Pricing · Contact**, then two small flag links (US flag → `/`, Greek flag → `/el/`). The current language's flag is full colour with a `--marker` ring; the other is 40% opacity and greyscale.
On scroll past 30px, the bar gets `rgba(9,9,11,.82)` + `backdrop-filter: blur(14px) saturate(1.3)` + a bottom `--rule-2` hairline.
Nav links: `--chalk-dim`, a 1px accent underline that scales in from the left on hover. **Scrollspy**: the link for the section currently crossing the middle of the viewport is lit the same way (IntersectionObserver with `rootMargin: "-45% 0px -50% 0px"`, so exactly one is active; none while over the hero). Hide the nav links below 600px; keep brand and flags.

### 3.2 Hero — the signature section
`min-height:100svh`, content centred on one vertical axis, text centred. Contents, in order, and **nothing else**:

1. **H1, two lines**, each line its own block:
   - line 1 `--chalk`: **"Hi, I'm"** — Greek **"Γεια, είμαι ο"**
   - line 2 `--chalk-tint`: **"Antonio Mato."** — Greek **"Αντόνιο Μάτο."**
   - `font-size: clamp(2.5rem, min(9.6vw, 19vh), 8.6rem)`; weight 800; line-height 1.02; letter-spacing −.035em.
2. **Intro paragraph**, `--chalk-dim`, `max-width:52ch`, `font-size: clamp(1.05rem, 1.9vw, 1.35rem)`:
   > A **website designer** and developer in Athens, with a BSc in Computer Science. I design and build websites and web applications — the look, the code behind them, and everything it takes to get them live.
   ("website designer" in `--chalk`.)
3. **One button: "See the work →"** linking to `#work`. White pill (chalk fill, ink text), padding `clamp(1rem,1.5vw,1.35rem) clamp(1.6rem,2.4vw,2.35rem)`, the arrow nudges 4px right on hover.

**Atmosphere behind it** (decoration only: `aria-hidden`, `pointer-events:none`):
- **The bloom**: a wide ellipse (`min(1320px,170vw)` × `min(680px,82vw)`) made of two stacked radial gradients — `rgba(59,130,246,.20)` fading by 70%, and `rgba(29,78,216,.30)` fading by 58% — blurred 18px. **Its centre sits exactly on the hero's bottom edge**, so it reads as light rising over a horizon.
- **Survey rings**: an SVG of 5 concentric circles (radii 15/24/33/42/49.5 in a 100×100 viewBox), `stroke:var(--marker)`, `stroke-dasharray:2 11`, `vector-effect:non-scaling-stroke`, stroke-opacity .34/.26/.19/.13/.08 from inner to outer, sized `min(1700px,200vw)` square and centred on the same bottom-edge point. Masked with `linear-gradient(to top, #000 18%, rgba(0,0,0,.62) 52%, transparent 88%)` so they fade out before reaching the text. The ring group breathes very slowly: `scale(1) → scale(1.05)` over 18s, ease-in-out, infinite.
- **Do not clip this at the hero's edge.** The background container overhangs the hero by 300px (`inset: 0 0 -300px 0`) with `overflow:hidden` on itself, and fades out across that overhang with `mask-image: linear-gradient(to bottom, #000 calc(100% - 300px), transparent 100%)`. The glow bleeds softly into the next section and dies there; a hard cut at the boundary looks broken.

**Entrance**: each headline line sits inside its own `overflow:hidden` clip box and the text rises from `translateY(115%)` to `0` over 1s, staggered .24s and .36s. Give the clip box `padding: .06em 0 .15em; margin: -.06em 0 -.15em` so descenders aren't shaved off. The paragraph and button fade up (opacity 0→1, translateY 22px→0) at ~.6s and ~.8s. The bloom and rings fade in over ~2s.

### 3.3 Work
Label **"Work"**, note **"Client work and software · 2024—2026"**, title **"Projects & builds."**

Three project rows, alternating: text column left / media right, then media left / text right (`0.95fr 1.5fr`, mirrored on even rows). **Order matters — the client website comes first**, because a business owner must see a real website before anything else.

Each row: `h3` name (display 700, `clamp(1.65rem,3.4vw,2.45rem)`), an accent-coloured small tagline, a description paragraph (`max-width:48ch`), a row of small tech chips, and 1–2 outline buttons with icons.

1. **Bling Nails** — *A live client site for a nail boutique in Piraeus.* A real business website, designed and shipped end to end. A single Greek-language page carrying the full service menu, price list, gallery and opening hours, written by hand in HTML, CSS and JavaScript with no framework or page builder. Scroll reveals fall back gracefully for reduced motion, the layout holds from phone to desktop, and it runs live on Firebase Hosting. Chips: HTML, CSS, JavaScript, No Framework, Responsive, Firebase. Button: **Visit live site ↗**.
2. **Asclepius AI** — *A medical assistant that can see, triage, and guide.* A medical assistant grounded in real clinical literature rather than model memory. Field manuals and first-aid references are chunked, embedded and stored in a vector database, so each answer is retrieved from verified sources before it is written. It reads uploaded images for visual triage, screens every message for emergency red flags, and deliberately reports an urgency level instead of a diagnosis, then maps the recommended specialty to real clinics near the user. Chips: Python, Flask, Gemini, RAG, Vector Search, Vision, Geolocation. Buttons: **GitHub coming soon**, **See test run ▶**.
3. **Mato's Adventures** — *A 2D RPG, engine and all, built by hand.* A full 2D role-playing game built entirely in JavaFX with no game engine, no libraries, nothing but the standard toolkit. Every system was written from scratch: an AnimationTimer frame loop driving a raw Canvas renderer, a tile map parsed into its own collision grid, movement resolved axis by axis so the player slides along walls instead of catching on them, four-direction sprite animation, a camera that scrolls the world around the player, branching NPC dialogue, and a logic-riddle puzzle system that gates progression. Chips: Java, JavaFX, No Engine, Canvas, AnimationTimer, Collision Maps. Buttons: **View on GitHub**, **See test run ▶**.

**Media**: each row shows a laptop mockup — a PNG laptop frame with a transparent screen cut-out laid over a slideshow of screenshots that crossfade every few seconds. Position the slideshow behind the frame with percentage insets (`left 9.876%, top 5.709%, width 80.318%, height 70.994%` for a 1448×1086 frame). If you don't have a frame image, draw a restrained CSS laptop instead. On fine pointers, the mockup tilts toward the cursor (`perspective(1500px) rotateX(±5deg) rotateY(±6deg) translateY(-8px)`), resetting on leave. "See test run" opens a modal with a video (webm + mp4 sources); clicking the backdrop, the ✕, or pressing Escape closes it; focus is trapped inside while open and returned afterwards. A small "Watch test run" hint chip sits on the screen corner.

### 3.4 Pricing — its own section, `#pricing`
Label **"Pricing"**, note **"One-time projects · Athens"**, title **"Simple pricing. Professional websites."**, lede **"No hidden costs. Choose the package that fits your business, and pay once."**

**Three cards** in a 3-column grid (`align-items:stretch`), 2px `--rule` borders, 10px radius, `rgba(20,24,33,.34)` ground. Hover: lift 2px, border to `--rule-2`.

**The middle card (Business) is raised, not lit up**: `margin-block: clamp(-1.5rem,-2vw,-1rem)` so it stands proud of both neighbours, border `rgba(59,130,246,.5)`, ground `rgba(24,31,46,.6)`, `box-shadow: 0 24px 60px -30px rgba(0,0,0,.9), 0 0 0 2px rgba(59,130,246,.12)`. A **"MOST POPULAR"** pill (blue-600 fill, white, tiny uppercase) sits centred on its top edge, half above the card. Its CTA is filled blue; the other two CTAs are outlined. No glowing gradients.

Each card, top to bottom:
1. Package name as an **`h3`** — small, uppercase, tracked, `--chalk-faint` (accent-coloured on the featured card). It must be a real heading so the packages appear in the document outline.
2. One-sentence blurb.
3. **Price**, huge: display 800, `clamp(2.4rem,4.4vw,3.15rem)`, letter-spacing −.04em.
4. "One-time payment" in small uppercase.
5. A clock icon + delivery timeline, e.g. "Live in about 1–2 weeks".
6. Full-width CTA button (≥54px tall).
7. The selling line, in `--chalk` weight 500, separated by a top hairline.
8. The feature list. **Every feature has its own relevant icon** (pages, devices, envelope, magnifier, padlock, support, layout, calendar, bar chart, map pin, globe, sparkle, lightning, gift) drawn as inline 24×24 stroke SVGs in `--marker` — never a column of identical ticks. **"Everything in X, plus:"** is a hinge, not a feature: small uppercase `--chalk-faint`, no icon. The hosting line is the one row in full `--chalk` weight 500 with its gift icon inside a small accent-tinted box.

| | **Starter — €449** | **Business — €699** | **Pro — €999** |
|---|---|---|---|
| Blurb | For businesses that need a proper website, done well, without an agency budget. | For businesses that want their website to actively bring in customers. | For established businesses that want a complete premium presence. |
| Sell line | Everything you need to look established online. | Designed to turn visitors into customers. | A complete website built for serious businesses. |
| Timeline | Live in about 1–2 weeks | Live in about 2–3 weeks | Live in about 3–4 weeks |
| CTA | Get started | **Build my website** | Get started |
| Features | A website designed around your business, **up to 4 pages** · Looks sharp on phone, tablet and desktop · Contact form, Google Maps and your social links · Set up so Google can find and list you · Fast loading, with SSL security included · 7 days of support after launch · **FREE hosting for 1 year** | *Everything in Starter, plus:* · **Up to 8 pages**, with custom layouts · Booking, appointments or reservations built in · Google Analytics and Search Console set up · Stronger local SEO, so nearby customers find you · 30 days of support after launch · **FREE hosting for 1 year** | *Everything in Business, plus:* · **Up to 12 pages** · **Any further languages** you need, not just two · Advanced SEO structure across the whole site · Refined animations and interactions · Priority build and 60 days of support · **FREE hosting for 1 year** |

Starter must feel complete, not deliberately crippled. Business must read as the best value.

**Under the cards:**
- **Trust strip** (8px radius card): *"Every package includes **SSL security, performance tuning, a second language and the first year of hosting**."* and, smaller: *"Domain setup is included. You pay for the domain registration and renewal yourself, so the address always belongs to you."*
- **Two-column extras.** Left column stacks two cards: **"After your first year"** — *"Staying on for hosting and maintenance is entirely optional, and priced when the time comes. Nothing to commit to now."*, four small chips (Hosting · SSL kept current · Regular backups · Basic maintenance), then *"Your website is yours. After the first year you can stay with me or move it anywhere you like."* — and **"How payment works"** — *"50% to begin the project. The remaining 50% is paid once the website is ready for launch."* Right column: **"Need something extra?"** — a list with the price right-aligned on each row and hairlines between: Extra page — from €70 · Advanced booking system — from €120 · Professional copywriting — Custom quote · Online store — Custom quote · Custom functionality — Custom quote · Ongoing SEO — Monthly plans. (Online stores are always quoted separately — never folded into the packages.)
- **Consultation bar** (10px radius, 2px `--rule-2` border): **"Not sure which package you need?"** / *"Tell me about your business and I'll recommend the right option."* / white button **"Get a free consultation →"** / tiny *"No commitment required."*

**Pointer-tracked border glow** on the trust strip, the three extras cards and the consultation bar. Two pseudo-elements driven by `--gx/--gy` CSS variables set from a `pointermove` listener (fine pointers only):
- `::before` — `position:absolute; inset:0; padding:2px; border-radius:inherit;` background `radial-gradient(210px circle at var(--gx) var(--gy), rgba(59,130,246,.85), rgba(59,130,246,.18) 42%, transparent 72%)`, masked to the ring only: `mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;` (plus the `-webkit-` `xor` form). `inset:0` puts the ring exactly **on** the 2px border so the border itself turns blue near the cursor.
- `::after` — `inset:0`, a soft `radial-gradient(260px circle at var(--gx) var(--gy), rgba(59,130,246,.10), transparent 68%)` wash.
- Both `opacity:0` → `1` on hover over .4s. **Lift the children** (`> * { position:relative; z-index:1 }`) or the wash paints over the text.

At ≤1000px: cards stack in Starter → Business → Pro order, the featured card stops being raised, extras go to one column, the badge stays visible.

### 3.5 Hiring — `#hiring`
A full-width band between Pricing and Contact: top and bottom `--rule` hairlines, a slightly lifted `rgba(20,24,33,.28)` ground, padding `clamp(4rem,7vw,6rem)`. Two columns (`1.35fr .65fr`):
- Left: small label **"For employers"**, `h2` **"Open to the right developer role, too."** with "developer role" in `--marker`; lede *"Client work comes first and always ships — but if you're hiring rather than commissioning a website, I'd like to hear about it. Everything on this page I designed and built myself, front to back."*; three chips: **BSc in Computer Science** · **Athens · on-site, hybrid or remote** · **Full-time, contract or internship**.
- Right: white **"Get in touch →"** button and a tiny *"Usually a reply within a day."*

Word it so a business owner never infers "this person will take a job and vanish mid-project." Stack below 860px.

### 3.6 Contact — `#contact`
Label **"Contact"**, note **"Athens · open to work"**, title **"Let's build something."** (line break before "something"), lede *"Have a project, a role, or a rough idea that needs a builder? Write it here and it reaches me directly."*

Two columns (`1.15fr .85fr`):
- **Form**: Name, Email, Message (textarea ≥130px). Labels are tiny uppercase `--chalk-faint`, turning `--marker` when the field has focus. Inputs: `rgba(6,6,9,.5)` ground, 1px `--rule` border, 2px radius, and on focus an **inset 2px accent on the bottom edge only** (`box-shadow: inset 0 -2px 0 var(--marker)`) so nothing shifts. Submit button: blue-600 fill, white, uppercase, arrow. A status line below it.
- **Channels card**: one vertical card with four full-width link rows separated by hairlines — **Email** (`mailto:`), **Phone** (`tel:`), **GitHub**, **LinkedIn** (new tab, `rel="noopener noreferrer"`). Each row: a 34px square icon box with a `--rule-2` border and `--marker` icon, a tiny uppercase label over the value, and an arrow (→, or ↗ for external) pushed to the right. Hover: blue wash, icon box border turns accent, value turns accent, arrow nudges 3px.

**Form submission**: POST JSON to a form endpoint (e.g. Web3Forms: `https://api.web3forms.com/submit` with an `access_key`) held in two constants at the top of the handler. Show "Sending…", then "Thanks {first name} — that reached me. I usually reply within a day." and reset the form. **If the constants are empty or the request fails, fall back to a `mailto:` handoff** with the subject and body pre-filled, so an enquiry is never lost. Validate all three fields first ("Fill in every field first."). Every status string is translated.

### 3.7 Footer
Top `--rule-2` hairline, small uppercase UI text, `--chalk-faint`: *"Written by hand · Athens, 2026"* on the left, a "Back to top ↑" link on the right. Stacks on mobile.

---

## 4. Motion

- Every animation uses `--ease`. Keep it restrained — no parallax, no cursor trails, no scroll-jacking.
- **Scroll reveal**: `.reveal` elements start at `opacity:0; translateY(30px)` and transition to rest over .8s when an IntersectionObserver (`threshold:.12, rootMargin: "0px 0px -8% 0px"`) sees them; unobserve after. Stagger siblings with `.d1/.d2/.d3` = .08s/.16s/.24s delays.
- **`prefers-reduced-motion: reduce`**: kill all animations and transitions, show every reveal element immediately, and **explicitly pin every element that starts hidden** to its finished state — especially the hero headline lines (`transform:none!important`), or they stay pushed below their clip boxes and the headline is invisible.

---

## 5. Signature details — what makes it this site, not a template

1. The hero bloom **centred on the fold line** with dashed survey rings, bleeding softly into the Work section instead of stopping at it.
2. The headline **cooling** from white to pale blue line by line, rising out of clip boxes.
3. One family, Manrope, with hierarchy made entirely of weight, size and tracking.
4. The featured pricing card **raised** above its neighbours rather than glowing.
5. A distinct icon for every pricing feature.
6. Borders that turn blue exactly where the pointer is.
7. The white primary button; blue reserved for ink and a few fills.
8. A faint engineering grid and paper grain under everything.

---

## 6. Responsive and large-screen scaling

- **Every `clamp()` bound is in `rem`, never `px`.** Then ramp the root font-size so the whole design scales as one piece on big monitors instead of sitting as a fixed-size island in the middle of the screen:
  ```css
  @media (min-width:1600px){ :root{font-size:17px} }
  @media (min-width:1920px){ :root{font-size:18.5px} }
  @media (min-width:2300px){ :root{font-size:20px} }
  @media (min-width:2800px){ :root{font-size:21.5px} }
  ```
  At a 16px root, `rem` values equal their px equivalents exactly, so nothing moves at normal sizes.
- Paragraphs cap their own measure in `ch` (roughly 36–66ch) — once the container can reach 2000px, nothing else stops a line running across the whole screen.
- **The hero headline needs a `vh` term, not just `vw`** — `min(9.6vw, 19vh)` — or short laptop panels (1280×720, 1600×720) buy type too tall to fit the fold. On short panels (`min-width:700px and max-height:830px`) also tighten the hero's vertical spacing — spacing only, never the type size.
- Size the headline to the **wider of the two languages**. In Manrope 800, "Antonio Mato." costs ~6.45px of width per px of font size; "Αντόνιο Μάτο." costs ~7.1px. The ceiling above keeps Greek at ~85% of its column and English at ~77%. Measure rendered widths — character count is a useless proxy.
- Below 640px the hero is `min-height:auto`. Primary buttons go full-width on small screens. Touch targets ≥44px.

---

## 7. Bilingual architecture and SEO

- All strings live in one JS object `I18N = { en: {…}, el: {…} }` with **identical key sets**. Elements carry `data-i18n="key"` (text), `data-i18n-html="key"` (strings containing `<b>`, `<em>`, `<span class="hl">`), or `data-i18n-ph="key"` (placeholders). The static HTML contains the English text too, so the page is complete without JavaScript.
- **Each language is a real URL**: `/` is English, `/el/` is Greek. Runtime text-swapping on one URL is invisible to search engines — the Greek copy would never be indexed. Write `build.py` that reads `index.html` and writes `el/index.html` with every translated node replaced by its Greek value (walk tag depth to find each element's own closing tag — a non-greedy regex stops at the first inner `</em>` and leaves duplicated text behind), `<html lang="el">`, a Greek `<title>`, description, OG/Twitter tags, canonical `/el/`, and the Greek flag marked active. It should report how many strings it translated and warn about missing keys. Run it after every edit.
- In the JS, **the language comes from `document.documentElement.lang`** — never from `localStorage`, which would put Greek text on the English URL. The flags are plain links to `/` and `/el/`, not a toggle.
- **All asset paths are root-absolute** (`/assets/…`), or `/el/` resolves them against its own folder and 404s.
- The dictionary's `meta.title` key must equal the SEO title, because the script sets `document.title` from it on load.
- `<head>`: title **"Website design in Athens from €449 · Antonio Mato"** (Greek: **"Κατασκευή ιστοσελίδων στην Αθήνα από 449€ · Αντόνιο Μάτο"**); a matching meta description; `<link rel="canonical">`; `hreflang` alternates for `en`, `el` and `x-default`; Open Graph + Twitter card tags with a **1200×630 `og-card.png` at the site root** (dark ground, the same bloom and rings, "Website design / in Athens." in the two-tone headline, a blue "FROM €449" pill); and a `ProfessionalService` JSON-LD block with name, URL, email, telephone, `priceRange`, `areaServed: Athens`, both languages, the founder, `sameAs` profiles and the three offers with prices.
- Ship `robots.txt` (allow all, point to the sitemap) and `sitemap.xml` listing both URLs with `xhtml:link` alternates.
- Keep the site origin in exactly one constant in `index.html` and one in `build.py`.

---

## 8. Accessibility

- Heading outline with no skipped levels: `h1` in the hero → `h2` per section → `h3` for project names, package names, and the pricing sub-blocks.
- A skip link to `<main>` (`tabindex="-1"`) that appears on focus.
- One `:focus-visible` treatment everywhere: 2px `--marker` outline, 3px offset.
- Every text colour passes WCAG AA against its actual background; `--chalk-faint` (4.8:1) is the lowest allowed for small text.
- Decorative SVGs, the bloom, the rings and duplicated arrows are `aria-hidden`.
- `button, input, textarea, select { font-family: inherit; }` — form controls don't inherit type by default and will otherwise render in Arial.
- The modal traps focus, closes on Escape, and restores focus when it closes.

---

## 9. Do not do these — each one breaks this design

1. **Don't build the headline colour ramp with `background-clip:text`.** Lines animated with `animation-fill-mode: forwards` keep an identity transform, which creates a stacking context, and the clipped gradient can't reach text inside it — the headline renders as invisible glyphs. Give each line a solid colour instead.
2. **Don't reference an `@keyframes` name you haven't defined.** It fails silently and leaves the element frozen in its starting state — here, a headline stuck below its clip box.
3. **Don't put `overflow:hidden` on the hero** to contain the bloom; it slices the glow at full brightness in a hard line.
4. **Don't let an absolutely positioned glow pseudo-element sit over content** without lifting the content above it.
5. **Don't write `px` in clamp bounds or layout tokens** — they refuse to scale with the root ramp.
6. **Don't forget flex's shrink-to-fit.** In the hero's column flex with `align-items:center`, children collapse to their content width — anything that must span the column needs `align-self:stretch`, and the `.wrap` inside a flex column needs `width:100%` or its auto margins stop it stretching.
7. **Don't trust a font's Greek support without checking.** Query the Google Fonts CSS with a *full* desktop Chrome User-Agent and look for `/* greek */` blocks; a short UA returns plain TTF with no subset comments, which makes every font look Greekless.
8. **Don't use `offsetTop` to scroll to a section** inside a positioned parent — it's relative to that parent. Use `getBoundingClientRect().top + scrollY`.
9. **Don't invent social proof or urgency.** The badge is "Most popular" only because the brief demands it; never add testimonials, reviews or client logos that don't exist.
10. **Don't mix e-commerce into the packages.** Online stores are always a custom quote.

---

## 10. Deliver

Files: `index.html`, `build.py`, `el/index.html` (generated), `robots.txt`, `sitemap.xml`, `og-card.png` (or a small canvas script that draws it at exactly 1200×630), and an `assets/` folder layout for screenshots, videos and the laptop frame.

Before you call it done, verify and report:
- No horizontal overflow at 390, 768, 1024, 1280, 1440, 1920, 2560 and 3440px, in both languages.
- The hero headline never wraps above 420px wide in either language, and the hero button is above the fold at 1280×720.
- EN and EL dictionaries have identical key sets, and every `data-i18n*` key in the markup exists.
- No heading level is skipped; every `#anchor` link resolves.
- Every text/background pair passes WCAG AA.
- With reduced motion on, every element — including the headline — is visible.
- `/` and `/el/` both load with the right `lang`, title, canonical, active flag and zero failed requests.
