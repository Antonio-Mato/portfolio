# Creative brief — a bilingual studio site for an Athens website designer

You're designing and building a one-page website for a freelance website designer and developer in Athens, Greece. I'm going to be exact about the **facts** and the **theme**, and deliberately loose about everything else. Treat the facts as fixed. Treat the theme as a boundary — push right up to its edge, but don't step outside it. Everything I haven't pinned down is yours to design, and I'd rather you make a strong, considered choice than a safe, generic one.

The site does two jobs at once. For **small local businesses** — a barber, a nail salon, a café, a plumber, an accountant — it has to make a professional website feel affordable, safe and worth it. For **employers**, it has to prove I can build real things properly. Both should leave with the same impression: *this person is careful, and what they make is real.*

---

## 1. Fixed facts — don't improvise these

```
NAME        Antonio Mato            Greek: Αντόνιο Μάτο
ROLE        Website designer and developer
DEGREE      BSc in Computer Science
CITY        Athens, Greece
EMAIL       matoantonio795@gmail.com
PHONE       +30 690 768 2456   (tel:+306907682456)
GITHUB      https://github.com/Antonio-Mato
LINKEDIN    https://www.linkedin.com/in/antonio-mato-9b2098281
SITE        https://personalportfolio-aa146.web.app   (one constant — the real domain goes here later)
```

### Projects — in this order
1. **Bling Nails** — a live client website for a nail boutique in Piraeus. Greek-language, one page: services, price list, gallery, opening hours. Hand-written HTML/CSS/JS, no framework or builder, responsive, reduced-motion aware, hosted on Firebase. **Link:** live site.
2. **Asclepius AI** — a medical assistant grounded in real clinical literature rather than model memory. Retrieval over chunked, embedded field manuals and first-aid references in a vector database; reads uploaded images for visual triage; screens every message for emergency red flags; reports an *urgency level, never a diagnosis*; maps the recommended specialty to real nearby clinics. Python, Flask, Gemini, RAG. **Links:** GitHub (coming soon), test-run video.
3. **Mato's Adventures** — a full 2D RPG in JavaFX with no game engine and no libraries. Hand-written frame loop and Canvas renderer, tile map with its own collision grid, axis-by-axis movement so the player slides along walls, four-direction sprite animation, a camera that scrolls the world, branching NPC dialogue, logic-riddle puzzles that gate progress. **Links:** GitHub, test-run video.

The client website goes first on purpose: a business owner has to meet a real website before a game engine.

### Packages — one-time payments
The **inclusions and numbers are fixed; the wording is yours.**

| | **Starter — €449** | **Business — €699** | **Pro — €999** |
|---|---|---|---|
| For | businesses that need a proper website, done well, without an agency budget | businesses that want their website to actively bring in customers | established businesses that want a complete premium presence |
| Pages | up to 4 | up to 8, custom layouts | up to 12 |
| Delivery | about 1–2 weeks | about 2–3 weeks | about 3–4 weeks |
| Includes | custom design (not a template), works on phone/tablet/desktop, contact form, Google Maps, social links, set up so Google can find it, fast loading, SSL, 7 days of support after launch | everything in Starter, plus booking/appointments/reservations, Google Analytics + Search Console, stronger local SEO, 30 days of support | everything in Business, plus any further languages, advanced SEO structure, more refined animation and interaction, priority build, 60 days of support |
| Hosting | **free for the first year** | **free for the first year** | **free for the first year** |

**Business is the "Most popular" package** and should read as the best value. **Starter must feel complete** — never the deliberately weak option that exists to push people upward.

### Policies — all must appear, near the packages
- Every package includes SSL, performance tuning, a second language (Greek + English), and the first year of hosting.
- Domain *setup* is included; the client pays for the domain registration and renewal, so **the domain always belongs to them**.
- After year one, hosting and maintenance is **optional and priced then** — no number is quoted. The website belongs to the client; they can stay or move it anywhere.
- Payment: **50% to begin, 50% when the site is ready to launch.**
- Add-ons: extra page from €70 · advanced booking system from €120 · professional copywriting, online store, custom functionality — custom quote · ongoing SEO — monthly plans. **Online stores are always quoted separately**, never inside a package.
- A route for the unsure: a free, no-commitment consultation.

### Hiring
I'm also open to a developer role — full-time, contract or internship; on-site, hybrid or remote in Athens.

---

## 2. The theme — stay inside this

**The world.** A design studio late at night. Near-black and cool. A single blue light low on the horizon, as if dawn were just below the edge of the screen. Underneath everything, the faint precision of an engineering drawing or a surveyor's plan — grids, hairlines, measured marks. Nothing shouts. The confidence comes from restraint and exactness, the way an architect's portfolio feels rather than a startup's homepage.

**Mood:** precise · calm · nocturnal · crafted · trustworthy · quietly premium.

**It should feel credible to an accountant or a construction company, and modern enough for a salon or a gym.**

**Never:** a SaaS template, neon, purple-to-pink gradients, glassmorphism as a style, bouncy or showy animation, stock illustration, emoji, rocket ships, fake scarcity.

### Palette — fixed
This *is* the theme. You may derive intermediate shades from these, but add no new hues.

| Role | Value |
|---|---|
| Page ground | `#09090B` (deeper `#060608`, raised `#0F1219`, `#161A24`) |
| Hairlines | `rgba(148,170,205,.13)` and `rgba(148,170,205,.26)` |
| Text | `#FBFCFE` primary · `#88A0BA` body · `#6C7F96` quiet (the contrast floor) |
| Cool tint | `#C6D5F1` — a paler, colder white for emphasis in large type |
| Accent as ink | `#3B82F6` — lines, icons, links, one highlighted phrase |
| Accent as fill | `#2563EB` — anything filled with blue that carries white text |
| Fill hover | `#1D4ED8` |

White text on `#3B82F6` fails contrast (3.7:1), which is why filled surfaces use `#2563EB`. The accent is precious: use it sparingly enough that it always means something.

### Type — fixed family, free hierarchy
**One typeface only: Manrope** (Google Fonts, `wght@400..800`). It ships Greek glyphs; many fonts don't, and a missing Greek subset fails silently. No second family, no monospace. Build the whole hierarchy — display, body, labels, UI — from weight, size, case and letter-spacing. Body at 400, not 300: light weights go fragile as pale text on near-black.

---

## 3. Keep these three anchors — then add one of your own

These are what make the site recognisably itself. Interpret them freely, but keep them:

1. **Light on the horizon.** The hero has one atmospheric device that reads as blue light rising from below the fold. It should *continue gently into the next section and die out there* — never stop at a hard edge.
2. **One voice in type.** A single family, with a large, confident display size in the hero.
3. **Emphasis by elevation, not glow.** Whatever you emphasise — above all the featured package — is raised, framed or given more room. Never neon-lit.

Then **invent one signature detail of your own** that belongs in this world, and leave a short comment in the code explaining it. It should be something a visitor remembers, not decoration for its own sake. For a sense of the register — don't copy these — things that would fit: borders that catch the light where the pointer is; section markers drawn like survey annotations; a background grid that sharpens as you scroll into a section; a headline that cools from white to blue line by line.

---

## 4. The page — what each part must achieve

For each section: what it **must** do, and what's **your call**.

### Top bar
**Must:** my name, links to the main sections, and a language switch. The switch is two plain links — `/` for English, `/el/` for Greek — with the current language clearly marked.
**Your call:** everything visual. Mark the section the visitor is currently reading if you can.

### Hero
**Must:** a warm, personal greeting that includes my name, then a short introduction — that I'm a website designer and developer, that I have a BSc in Computer Science, that I'm in Athens, and what I focus on. One clear way forward to the work. It must *fill* the screen with confidence: large, spacious, unhurried — never a small block floating in a big empty window, on a laptop or a 4K monitor.
**Your call:** the exact words of the greeting and introduction, the composition, what the horizon device is (a bloom, rings, a grid dissolving into light, a slow gradient — anything inside the theme), and how it all arrives on load.

### Work
**Must:** the three projects in the order above, each with its name, a one-line summary, a short description, the technologies, and its links. Screenshots or video. A business visitor should instantly see that the first one is a real client website.
**Your call:** the presentation — device mockups, a gallery, a case-study layout, whatever serves the work. How client work reads differently from software projects. How videos open.

### Pricing
**Must:** the three packages with prices, "one-time payment", delivery times, inclusions, and a clear call to action on each. Business visibly emphasised as the most popular. The free first year of hosting should be *memorable*, not buried in a list. All the policies above visible without being intimidating. End with the free-consultation route for anyone who isn't sure.
**Your call:** card design, how the featured package is raised, iconography (a distinct, meaningful icon per inclusion reads far better than a column of identical ticks), the layout of the fine print, and any micro-interaction.
**Watch the ladder:** someone who knows nothing about websites should grasp the difference in a few seconds — Starter is a professional presence, Business brings in customers, Pro is the complete premium version.

### Hiring
**Must:** a clear, dignified place telling employers I'm open to a developer role, with degree, location and availability. Word it so a business owner reading it never concludes I'll take a job and vanish mid-project.
**Your call:** everything else.

### Contact
**Must:** a form (name, email, message) that genuinely submits, and my direct channels — email, phone, GitHub, LinkedIn — each clickable, each with an icon so it's recognisable at a glance.
**Your call:** layout and style.

### Footer
Small and quiet. Your call.

---

## 5. Voice

- **First person singular.** One person, not an agency "we".
- Plain English a café owner understands. **Sell outcomes, not technology** — "works perfectly on your phone", "Google can find you", "easy for customers to reach you"; never "responsive architecture" or "full-stack deployment".
- Confident and warm; never salesy, never cute.
- The Greek must read as if a Greek speaker wrote it, not as a word-for-word translation.

A few lines that capture the register. Use them, or write better ones:
- "Simple pricing. Professional websites."
- "Designed to turn visitors into customers."
- "Your website is yours."
- "Client work comes first and always ships."

---

## 6. Non-negotiables

**Build**
- One `index.html`: all CSS in one `<style>`, all JS in one `<script>`. Vanilla HTML, CSS and JavaScript. No framework, no Tailwind, no npm — the only extra is a small Python script for the Greek page (below).
- Works from a 390px phone to a 3840px monitor, with **no horizontal scrolling at any width**.

**Two languages, two real URLs**
- Every visible string exists in English and Greek, held in one dictionary with identical keys in both. The static HTML carries the English text, so the page works without JavaScript.
- `/` is English, `/el/` is Greek. Translating text at runtime on one URL is invisible to search engines — the Greek copy would never be indexed. Write a `build.py` that reads `index.html` and writes `el/index.html` with every translated string baked in, plus `lang="el"`, a Greek title and description, and its own canonical URL. It should report how many strings it translated and warn about missing keys.
- The page's language comes from its URL (`document.documentElement.lang`), never from `localStorage`.
- Asset paths are root-absolute (`/assets/…`) so `/el/` resolves them.

**Findable**
- A title and description aimed at the business audience (something like "Website design in Athens from €449"), a canonical link, `hreflang` alternates for `en`, `el` and `x-default`, Open Graph and Twitter tags with a 1200×630 social image in the site's own look, and a `ProfessionalService` JSON-LD block with the business details and the three offers.
- `robots.txt` and a `sitemap.xml` listing both URLs.

**Scales properly**
- Write sizes in `rem` and ramp the root font size on large monitors, so the whole design grows as one piece instead of stranding a small page in the middle of a big screen. Cap line lengths in `ch`.
- Size the hero headline off both width and height, so short laptop screens still fit it above the fold.
- **Size headlines to the wider of the two languages** — Greek usually runs wider than English at the same size. Measure rendered widths; character counts are a poor guide.

**Accessible**
- No skipped heading levels; package names and project names are real headings.
- A skip link, one visible focus style, WCAG AA contrast on every text colour, decorative graphics hidden from assistive tech, 44px touch targets.
- `prefers-reduced-motion` shows everything immediately — including anything that normally animates in from a hidden state.

**Honest**
- No invented testimonials, reviews, client logos, customer counts, discounts or countdowns. "Most popular" is the one exception, because I've asked for it.

**Form**
- POST the form to a form endpoint (e.g. Web3Forms) configured by two constants. If they're empty or the request fails, fall back to a pre-filled `mailto:` so no enquiry is ever lost. Show sending, success and error states, in both languages.

---

## 7. Known traps

If your design goes in any of these directions, here's what breaks:

- **Gradient-clipped headline text** (`background-clip:text`) plus a line animation with `animation-fill-mode: forwards` → the animation leaves a transform behind, which makes a stacking context the clip can't reach, and the headline renders as invisible glyphs. Colour the lines individually instead.
- **An `@keyframes` name that isn't defined** fails silently and freezes the element in its starting state.
- **A glow that stops at a section edge**: `overflow:hidden` on the hero slices it in a hard, bright line. Let the atmosphere overhang and fade out.
- **A glow or highlight pseudo-element** positioned absolutely paints *over* the content unless you lift the content above it.
- **Sizes in `px`** inside `clamp()` won't grow on large screens.
- **Flex columns with `align-items:center`** shrink their children to content width; anything meant to span the column needs `align-self:stretch`, and a centred wrapper with auto margins inside a flex column needs `width:100%`.
- **Checking a font for Greek**: query the Google Fonts CSS with a *full* desktop browser User-Agent and look for `/* greek */`. A short User-Agent returns plain font files with no subset comments, so every font appears to lack Greek.
- **Form controls don't inherit the page font** — set `font-family: inherit` on buttons and inputs.
- **White text on bright blue** usually fails contrast; check it.

---

## 8. Done means

Deliver `index.html`, `build.py`, the generated `el/index.html`, `robots.txt`, `sitemap.xml`, the social image (or a small script that draws it), and an `assets/` folder layout. Then check and report:

- No horizontal overflow from 390px to 3440px wide, in both languages.
- The hero fills the screen at every size, its headline doesn't wrap on desktop in either language, and its call to action is above the fold on a 1280×720 laptop.
- English and Greek have identical keys, and every translated element in the markup has one.
- No heading level is skipped, and every in-page link lands somewhere.
- Every text colour passes WCAG AA.
- With reduced motion on, everything is visible.
- `/` and `/el/` both load with the right language, title and canonical URL, and no failed requests.
- The comment explaining your signature detail, and a short note on the choices you made where I left you free.
