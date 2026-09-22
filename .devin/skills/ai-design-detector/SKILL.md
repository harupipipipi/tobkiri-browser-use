---
name: ai-design-detector
description: Judge whether a slide deck, site, or design artifact was AI-generated, and when possible identify which tool/model pipeline produced it. Use when given a screenshot (PNG/JPEG), an HTML export, a URL, or a dataset metadata record and asked "was this made by AI?" or "which AI made this?".
---

# AI Design Detector

Decide whether an artifact (slide, site, landing page, document design) was produced by an
AI generation tool — and, when the evidence allows, name the tool and its model pipeline.

**Two separate questions — never merge them:**
1. **Provenance**: which tool/pipeline produced or serves this artifact?
   (host, badge, generator meta, CDN fingerprints)
2. **Generation**: is there evidence the *design, text, or embedded media* were
   actually AI-generated?

A confirmed pipeline does NOT settle question 2 by itself for human-operated
tools (Canva, Framer, Webflow, Wix, Pitch, Replit). It DOES settle the *design*
question for generator-hosts (a `*.gamma.site` doc is a Gamma-generated design
even when the text inside it is human-authored — report the scopes separately).

Every verdict must trace to observed signals. Never infer a model from vibes alone.
When only stylistic evidence exists, the ceiling is `uncertain` — say so.

## Inputs

| Input | Where it comes from |
|---|---|
| Screenshot (png/jpg) | `browser_screenshot` captures, dataset `*.png` files |
| HTML export | `scripts/fetch-asset.mjs` captures of hosted artifacts (`*.gamma.site`, share pages) |
| URL only | resolve it first if possible; otherwise judge on URL pattern alone |
| `metadata.jsonl` record | dataset-internal provenance (`tool`, `assetUrl`, `pageUrl`, `title`) |

Evaluate in this order: **provenance → construction fingerprints → visual heuristics**.
Stop early when a higher tier is decisive.

## Tier A — Decisive provenance signals

Tier-A signals prove the **pipeline** (which tool produced/served the artifact).
What they imply about *generation* depends on the tool class:

- **Generator hosts** (`*.gamma.site`, `*.lovable.app`, `*.c.websim.com`,
  `*.manus.space`, `*.base44.app`, `*.grok.me`, `*.emergent.host`,
  `*.chatgpt.site`, `*.bolt.host`, `*.polsia.app`, `*.trickle.host`,
  `*.butternut.ai`, `*.durable.co`, `*.mixo.io`, `*.blinkusercontent.com`,
  `*.wegic.net`, presenton gallery, `*.ai.studio`) — the hosted artifact IS
  the generator's output ⇒ `ai_confirmed` at **design/layout scope**.
  This does NOT settle text/image *content* authorship (see `scope` field).
- **Human-operated tool hosts** (`*.framer.website`/`framer.site`, `*.webflow.io`,
  `*.wixsite.com`/wixstatic, `*.my.canva.site`, `*.pitch.com`, `*.replit.app`,
  `*.beautiful.ai`) — pipeline confirmed, authorship undetermined ⇒
  `uncertain` (lean `human_likely` only with additional human evidence).
- **AI-first deck tools** (`*.decktopus.com`, `tome.app`) — hosted artifacts
  are tool-generated ⇒ `ai_likely` (marketplace/vendor templates are a
  known contamination class — verify it's an output page, not a template
  listing).

### A1. Hosted-artifact domains (the artifact IS served by the generator)

| Domain / URL pattern | Tool | Notes |
|---|---|---|
| `*.gamma.site` | Gamma | Generator host — design is Gamma-generated; text/image authorship stays separate (scope). |
| `gensparkpublicblob.blob.core.windows.net` | Genspark | Asset CDN. Path `user-upload-image/public-skills/prod/slide-agent/v2/i18n/<locale>/<deck-slug>/thumbnails/NN-NN-*.png` = slide-agent deck thumbnails. |
| `manus.im/share/*`, `manus.im/app` artifacts on `files.manuscdn.com`; `*.manus.space` (8-char slug) | Manus | Share links + `files.manuscdn.com` media CDN; published sites on `*.manus.space`. |
| `*.canva.com/design/*/view`, `*.my.canva.site` | Canva | Human-operated design tool — host alone ⇒ `uncertain` (Magic Design is opt-in). |
| `*.beautiful.ai` share links | Beautiful.ai | AI-assisted but human-operated deck tool — host alone ⇒ `uncertain`. |
| `tome.app/*` public pages | Tome | AI deck tool — hosted artifact is generated ⇒ `ai_likely`. |
| `*.decktopus.com` | Decktopus | AI deck tool ⇒ `ai_likely`; marketplace/vendor templates are label noise (seen in eval). |
| `*.pitch.com` public decks | Pitch | Human deck tool with AI features — host alone ⇒ `uncertain`. |
| `*.lovable.app`, `*.bolt.host`, `*.blinkusercontent.com`, `v0.app`/`*.v0.dev` chat-shared links | Lovable / Bolt / Blink / v0 | Generator hosts. `*.vercel.app`/`*.netlify.app` alone are NOT evidence (generic hosts) — but the subdomain convention `v0-<slug>.vercel.app` is a weak v0 tell (observed in collector URL lists; UNVERIFIED against captured HTML). |
| `*.durable.co`, `*.mixo.io`, `*.polsia.app`/`polsia.io` | Durable / Mixo / Polsia | AI site builders — generator hosts. |
| `*.base44.app` (+ `app.base44.com`, `media.base44.com` asset CDN in every page) | Base44 | AI app builder; `base44-edit-badge`/`base44-scale-in`/`base44-fade-in` classes. |
| `*.chatgpt.site` | ChatGPT sites | ChatGPT-built sites; often semantic vanilla HTML+CSS (no React) — see Tier B. |
| `*.emergent.host` | Emergent | AI builder; badge + scripts below. |
| `*.wegic.net` demos, `*.framer.ai` | Wegic / Framer published | Wegic AI demos; `*.framer.ai` + "Made in Framer" boilerplate ⇒ Framer-AI surface `ai_likely`. |
| `*.grok.me` | Grok (xAI app builder) | + `<meta name="grok-project-id" content="<uuid>">` + `grok.com` script — decisive. |
| `*.replit.app` | Replit | General IDE/host; humans deploy there constantly ⇒ `uncertain` w/o other signals. |
| `*.ai.studio` site pages | AI Studio (Google) app hosting | Pages are Vite+React+Lucide SPAs w/ NO self-marker — host is the fingerprint; host+stack ⇒ `ai_likely`. |
| `*.butternut.ai` | Butternut | AI site builder; `butternut.ai` refs throughout HTML. |
| `*.trickle.host` | Trickle | AI site builder; `trickle`/`Trickle` markers in HTML. |
| `*.c.websim.com` (artifact iframe host); `websim.com/@user/slug` project pages | Websim | Project page embeds the generated app in an iframe — the page is a shell, but the artifact is inside ⇒ still `ai_confirmed`. `__websim_origin`/`__websim_route` params + `__websim*` globals. Bare `websim.com` non-project paths = tool page. |
| `presenton.ai/community/presentations/<id>` | Presenton | Public gallery — the page IS the generated deck (slide text embedded). |
| `presenton.ai/community/presentations/<id>` | Presenton | Public gallery of AI-generated decks; HTML embeds full slide text. |
| `*.webflow.io`/sites w/ `data-wf-site`+`data-wf-page`+`webflow.css`+`<meta generator content="Webflow">` | Webflow | Human designer tool — pipeline proven, authorship leans human ⇒ `human_likely` (not `uncertain`: designer tools are overwhelmingly human-edited; lean ≠ proof). Custom domains hide the host: content fingerprints still identify the *pipeline* (eval: 10/10 custom-domain Webflow pages → `human_likely`). |
| `wixstatic.com` assets, `X-Wix` markup on custom domains | Wix | Same rule — designer pipeline, `human_likely` lean. |

### A2. Watermarks and badges

Literal strings in HTML or visible as in-image corner pills (all observed bottom-right).
A badge proves the *publishing pipeline*, i.e. that the design/artifact was emitted
by that tool — for generator tools that is `ai_confirmed` at design scope; for
human-operated tools (Framer "Made in Framer", Canva credit lines) it is a
designer-tool tell only. It never proves the *text or image content* was
AI-written.

| Badge | Tool | Form observed |
|---|---|---|
| `Made with Gamma` / "Made with GAMMA" pill | Gamma | HTML `<a>` w/ SVG gamma logo (`css-1fr8asy`); white/blue pill in exported slides (`reddit-ai/7ec04a40d143d2aa.png` labeled `unknown-ai` — badge overrides collector label). Present in only 28/153 HTML exports (tier-gated). |
| `Made in Bolt` pill | Bolt | Dark pill bottom-right in screenshot; HTML injects `<script src="https://bolt.new/badge.js?s=<uuid>">` — 10/10 bolt HTML files. |
| `Made with Blink` pill | Blink | Small dark pill bottom-right (`blink/3d-car-showroom-*.png`); DOM `blink-badge-container` ×20, `blink-badge`. |
| `Made with Lovable` pill | Lovable | Dark pill bottom-right (`lovable/chiliforge*.png`); DOM `lovable-badge`, `lovable-badge-close`, `-cta`, `-divider`, `-text` classes; 11/17 lovable files carry any lovable fingerprint at all — badge is tier-gated. |
| `Built with v0` pill | v0 | Dark pill bottom-right (`v0/v0-ai-food-order-bot*.png`); DOM `v0-built-with-button-<uuid>` fixed div w/ dismiss button (11/13 v0 files); badge href `v0.app/chat/api/open/built-with-v0/...`. |
| `Made with Emergent` anchor | Emergent | `<a id="emergent-badge" href="https://app.emergent.sh/?utm_source=emergent-badge">`. |
| `wegic-branding-badge` | Wegic | `<div id="wegic-branding-badge" class="wegic-badge" aria-label="Visit Wegic website">` + `cdn.wegic.ai` logo. |
| "Made in Framer" / "Create a free website with Framer" | Framer | Boilerplate on `*.framer.ai` published sites. |
| ⚡️ `Bolt.new + Vite + React` `<title>` | Bolt | Survives on Netlify-deployed Bolt apps (custom domains lose `*.bolt.host` host tell). |
| "Built with Lovable", Canva/Beautiful.ai credit lines, Genspark logo lockup | various | Expected; verify in-artifact. |

Absence of a badge means nothing (paid tiers remove them) — never use absence as a human signal.

### A3. Generator/meta markup

- `<meta name="generator" content="...">` naming an AI tool — decisive for the *pipeline*.
  Observed: `<meta name="generator" content="v0.app">` (11/13 v0 files);
  `<meta name="generator" content="Framer e0809aa">` (build-hash suffix; Framer ⇒ pipeline
  only, humans design in it — cap `ai_likely`).
- Gamma quirk observed: `<meta name="robots" content=", ">` (malformed value) plus
  `og:image`/`twitter:image` `content="null"` — sloppy meta generation, strong tell.
- Blink default OG (conclusive when unedited): `og:title "Blink App"` +
  `og:description "An app built with Blink."` (1,748/3,199 html in dataset; rest carry
  `blink-badge*` classes or the `auto-engineer.js?projectId=` stub script instead).
- Manus shell: `csp-nonce` meta, `<meta name="theme-color" content="#f8f8f7">`,
  `google: notranslate`, assets on `files.manuscdn.com`.
- Emergent: `<meta name="description" content="A product of emergent.sh">`.

### A4. Embedded model-config dumps (identifies the model pipeline)

Gamma exports embed a client feature-flag/config object naming its generation stack.
Observed keys (dataset `gamma/*.html`): `generatorGPT4`, `gpt4oMiniGenerate`,
`prefer-openai-dalle`, `imagen`, `imagen3`, `imagenFlash`, `ideogram`, `ideogram2`,
`leonardoPhoenix`, `lumaPhoton`, `recraftModel`, `playground-api-sdxl`,
`baseten-generate-flux-schnell-url` (a live Flux Schnell endpoint),
`importPptModels.fastModel: "gemini-2.0-flash-001"`, `openAiStatus`, `web-image-provider: serper`.

Report as: "Gamma pipeline; flag set references GPT-4-class text gen and a multi-vendor
image pool (DALL-E / Imagen 3 / Ideogram / Leonardo Phoenix / Recraft / Flux Schnell /
SDXL)". Do NOT claim which vendor rendered a specific image unless per-asset metadata says so.

### A5. Dataset provenance

`dataset/*/metadata.jsonl` `tool` + `assetUrl` fields are collector labels — treat as
ground truth for *where the file was fetched*, not for what generated the pixels.

## Tier B — Strong construction fingerprints (HTML/assets only)

| Signal | Points to |
|---|---|
| Next.js (`__NEXT_DATA__`, `data-next-head`, `/_next/static/chunks/`) + Emotion (`class="css-<hash>"`, `<style data-emotion="css">`) + `gamma-*` classnames (`gamma-moveable-wrapper` — 152/153 files, `gamma-badge`, `gamma-sites-*`) + `assets.gammahosted.com` CDN + `gamma-app.workers.dev` refs | Gamma |
| Filenames matching `NN-NN-<slug>.png` under a `thumbnails/` dir on the Genspark blob host | Genspark slide-agent |
| Next.js shell + `files.manuscdn.com` | Manus |
| `<manus-content-root>` custom element + inline globals `__manus_space_editor_info` (`spaceId`, `hideBadge` flag) + `__manus__global_env` (`api.manus.im`, amplitudeKey) + `files.manuscdn.com/manus-space-dispatcher/spaceEditor-*.js` | Manus published site — 239/241 `*.manus.space` samples carry the full shell regardless of inner stack (Next/Vite/three.js all seen); the 2 exceptions are dead-space "Manus Space" interstitials (own infra tell). Fingerprint the shell, not the stack. |
| `blink-*` DOM classes (`blink-badge-container` ×20, `blink-picker`, `blink-edit-hover`, `blink-seo-text`) + Vite `/assets/index-*.js` + `createLucideIcon-*.js` chunk + inline `localStorage.getItem('theme')` dark-mode script + `images.unsplash.com` preload list | Blink |
| `bolt.new/badge.js` script, or leftover default `/vite.svg` favicon + `id="root"` + Vite `/assets/index-<hash>.js` | Bolt |
| `<meta generator content="v0.app">` or `v0-built-with-button-<uuid>` or internal classes `v0-gray-*`/`v0-alpha-*`/`v0-blue-*`/`v0-caveat-*` (v0's own design system) + Next.js **App Router** RSC payloads `self.__next_f.push` | v0 |
| `pitch.com/static/platform/asset/` font paths (eina01/lato/markpro woff2 + content-hash names), `pitch-assets-*`, title suffix `\| Pitch` | Pitch (host ⇒ uncertain — human tool w/ AI features) |
| `<meta generator content="Framer <hash>">` + `framerusercontent.com` assets + `data-framer-*` attrs (×500) + `framer-*` classes + `__framer__*` globals (`__framer__breakpoints`) | Framer pipeline (cap `ai_likely` — designer tool) |
| `*.polsia.app`/`polsia.io` host + canonical/og `polsia.io/opengraph-image?<hash>` + Next.js + lucide | Polsia |
| `*.base44.app` host + `media.base44.com`/`app.base44.com` refs + `base44-edit-badge`/`base44-scale-in`/`base44-fade-in` classes | Base44 |
| `*.grok.me` host + `<meta name="grok-project-id">` + `grok.com` script | Grok |
| `<meta generator content="Webflow">` + `data-wf-site`/`data-wf-page` + `webflow.css` + `wixstatic.com` (Wix assets on custom domains) | Webflow / Wix (human designer tools — pipeline only) |
| `*.emergent.host` + `id="emergent-badge"` + `ap.emergent.sh/static/array.js` + `assets.emergent.sh/scripts/{emergent-main,debug-monitor}.js` | Emergent |
| `*.chatgpt.site` host + semantic vanilla HTML (no framework root — `<header>/<main>/<section>`, `style.css`, skip-links) + punchy GPT copy | ChatGPT site |
| `*.wegic.net` host + `id="wegic-branding-badge"`/`wegic-badge` classes + `cdn.wegic.ai` assets + `wegic.ai/assets/onepage/agent/` paths | Wegic (agent one-pagers) |
| `storage.googleapis.com/gpt-engineer-file-uploads/` asset bucket or `gpteng.co` refs or `lovable-badge*` classes + `id="root"` + Vite hash assets | Lovable (GPT Engineer backend) |
| Vite+React SPA (`id="root"` + `/assets/index-<base62>.js`) + Tailwind utility soup (`max-w-6xl mx-auto px-6`, `rounded-lg`) + `class="lucide lucide-*"` SVGs (`stroke-linecap="round"`, `stroke-width="2"`) — no tool marker | **production-method note, NOT an AI tell** — humans hand-write this stack daily. Alone ⇒ `uncertain` with `pipelineGuess:"codegen-style stack"` (method observed, authorship undetermined). Contributes toward `ai_likely` only together with tool-specific fingerprints or content anomalies. |
| Single-file page: Tailwind/Inter CDN + hero-gradient layout, no CMS chrome | same caveat — generic scaffold, not provenance |

Two or more **tool-specific** Tier-B signals (rows naming a tool/CDN) on the same
artifact ⇒ `ai_likely` minimum. Generic-stack signals (last two rows) do not count.

## Tier C — Visual heuristics (screenshots only — weakest tier)

Positive tells — two classes. **Layout/style tells** (grid uniformity, badge-like
chrome, NN furniture, template skeletons, shared deck idioms) never reach
`ai_likely` alone. **Content-anomaly tells** (invented entities with fake metrics,
env/config leaks shipped in the UI, garbled in-image text, impossible details,
in-artifact model claims, contradictory units, future-dated production data) are
the strong class. Rule: `ai_likely` needs ≥2 independent content-anomaly tells,
or ≥3 mixed tells of which ≥1 is content-anomaly; otherwise `uncertain`.
- Uniform card grids: N identical rounded-corner cards, perfectly equal spacing/alignment.
- Statement headline + tiny kicker ("04 / COMPETITORS & ADVANTAGES") + corner brand mark + footer furniture (page number, "Sources in speaker notes") — seen in ChatGPT-generated deck (`chatgpt-slides/`).
- ChatGPT image-slides: whole slide is ONE generated image — flawless baked-in type, oversized bold headline ending in a colored square period (`Infercat` deck), `NN / NN` page footers, flat line-art/contour illustration, restrained 2-3 color palette, consistent corner labels + footer credits per deck.
- ChatGPT site style (`*.chatgpt.site`, e.g. `chatgpt/variantforge*.png`): light neutral bg, single accent color, brand lockup w/ `<small>` tagline, eyebrow + 2-line sans headline w/ accent on second line, promise panel ("Your catalog stays with you."), numbered `01/02/03` steps, FAQ accordions, GPT-punchy short sentences — and NOTE the HTML is semantic vanilla (no React/Tailwind) unlike the vibe-stack builders.
- Editorial-template look: hairline rules, small-caps metadata bands (セクション / 発行番号 / 日付 / ページ番号), oversized serif display type on cream stock — Genspark "一流レビュー誌" template (`genspark/`).
- Genspark consulting look: white bg, navy/ink text, KPI strip row of 4-5 metrics separated by thin dividers (`$4.2M · 138% · 82%`), status-dot tables (●●), footnote lines — typeset, not illustrated.
- Bolt light-landing skeleton: fixed translucent nav → 2-col hero w/ fake product UI → small-caps sections `THE PROBLEM`/`THE SOLUTION`/`PROCESS` → 3+2 icon-card grid → black pill CTA; Inter; lucide icons in gray rounded squares (`bolt/anshuranwa*.png`).
- Lovable dark-dev style: dark navy + single accent, subtle grid bg, pill badge ("Free — no signup required", "AI-Powered X Generator"), centered headline with ONE accent-colored or gradient word ("...in **minutes**"), gradient CTA button + "Free • No account required" microcopy, terminal/code mockups (`$ cat intro.md`), JSON blocks, fake status bars ("Synced 12ms"), metric chips (`<1ms`, `12+`), "How it works" + STEP 1/2/3 icon cards.
- Blink premium-editorial style: dark luxe bg, serif-italic display headline, numbered eyebrow `01 / THE COLLECTION`, single bold accent color, spec/configurator panels (`blink/3d-car-showroom*.png`).
- Gamma slide look: dark gradient bg, big-stat rows (`87% / 0 / ∞`), italic parenthetical subtitles ("(Plot twist: I'm the main character)"), You-vs-Me comparisons, timeline chips (`reddit-ai/*.png` w/ badge).
- v0 style (limited data): black bg + single saturated accent, heavy display headline, step-indicator pills, card UI; badge "Built with v0" bottom-right (`v0/v0-ai-food-order-bot*.png`).
- Fake product UIs: mock dashboards/chat/terminals drawn as illustration — humans screenshot real product, AI invents pixel-perfect fakes.
- Invented-world furniture: fictional platforms with live-looking metrics ("2.4M Pulses", "42.8K conversations"), fake verified-celebrity cards, trending tags, premium upsells ("Turbo $7.99/mo"), trust chrome ("end-to-end encrypted") — AI builders stock a whole fake ecosystem.
- Production-error leaks: env-var/config errors rendered into the shipped UI ("ANAM_API_KEY is not set in the server environment"), typo'd metrics ("Revenue Genereted") — humans QA these away; builders ship them.
- In-artifact model claims: "Powered by Gemini 3 Flash", "GEMINI 3.1 TTS" chips baked into header/footer — Tier-A-adjacent (content-level, not markup).
- Impossible details: wrong unit conversions on product labels ("32 OZ (901g)" — 32oz is ~907g), fake date stamps, future-dated calendars.
- AI-vs-AI comparison artifacts: side-by-side images literally labeled "chatgpt" / "nano banana".
- Thin-stroke flat illustrations, single accent color, stock 3D/icon imagery, emoji-as-bullets.
- Typography: Inter/geometric sans at consistent scale; zero widows, zero overflow — suspiciously polished.
- Visible generator watermark/badge in-frame (see A2 pill table).

Negative tells (human-likely, weak): real photography w/ shadows+reflections (iPhone product
shots, `human/8e869c32b6917d93.png`); REAL third-party assets — actual book covers, actual
brand logos (React/Arc/Notion on `human/97bb83fc0123c4cd.png`); idiosyncratic content an AI
wouldn't invent unprompted (weather widgets, personal listicles); inconsistent
spacing/alignment, dated CMS theme chrome (WordPress template + mismatched plugins),
skeuomorphic/dated styling, raster noise of real captures. Strong human-template tell:
placeholder copy survives — "Here is where your presentation begins", "20XX" year slots
(slidesgo themes in `human/`); AI emits finished copy, templates keep placeholders.
None are proof — humans use templates too, and AI tools can embed real logos when asked.

**AI-builder UI chrome** (recognize, don't misjudge): screenshots of the *builders
themselves* — bolt.new's "What do you want to build?" prompt box, token counters
("500K daily tokens remaining"), suggestion chips ("Create a financial app"), chat
sidebars (`reddit-ai/0a3edcce6fd3818a.png`). These prove an AI tool ecosystem, not that
the artifact in-frame was AI-rendered.

**False-positive trap:** a marketing screenshot *of* an AI tool's website/editor (e.g.
ProductHunt gallery shots in `beautifulai/`, `slidesai/`, `tome/` — served from
`ph-files.imgix.net`) is human-designed marketing, not a generated artifact. Judge the
artifact, not the ad: marketing polish ≠ AI generation.

**Calibration insight:** AI output sits at "competent-but-generic" — conventional polish,
safe palettes, template skeletons. Award-winning HUMAN work (awwwards/httpster/cssnectar
shots in `human/`) is MORE idiosyncratic: weird compositions (site on a monitor in a
garden), real client-logo ribbons (MrBeast/Uber/Binance), 3D art direction, coordinates
ticker bands. Very high polish + weirdness/real-brands leans human; polish + sameness
leans AI.

**Measured false-positive class (blind eval, see below):** polished systematic HUMAN
decks are the #1 visual FP source — Beautiful.ai/Pitch/SlidesCarnival template slides
with stat cards, pyramid diagrams, and app-mockup illustrations get called `ai_likely`
because they match the "AI-deck idiom". The reverse also happens: a human template
slide that embeds an app-screenshot illustration reads as an invented AI app
(`img_088` vs `img_089` — a Beautiful.ai template and a Blink app showing near-identical
teacher-app UIs). When "polished" is the only signal, prefer `uncertain` over `ai_likely`.

**FP-control rules (added after v2/v2b dev-set analysis, human FP was 22%):**
- "Invented brand + polish" is NOT sufficient — human designers invent brands too
  (Boc.Studio, EverSwap, Studio Minds, Mockly were all human FPs). A landing page
  needs ≥2 *content-anomaly* tells (fake-ecosystem furniture, env/config leaks,
  garbled text, impossible details, model claims) to reach `ai_likely`; layout
  polish + invented brand alone = `uncertain`.
- Bento-stat rows, NN section furniture, icon-card grids, gradient CTAs are
  SHARED grammar — human templates and AI decks both ship them. Count them as
  weak signals only.
- Real-entity anchors weigh human: verifiable company/brand names, real product
  logos, named real people + working contact paths, dated/filing content
  (SEC boilerplate, real grant IDs) — unless the in-artifact content is
  self-evidently fabricated (invented firm + invented metrics + no verifiable
  anchor = AI-leaning).
- Template placeholder copy ("Here is where your presentation begins",
  "Elaborate on what you want to discuss", "20XX") is a HUMAN-template tell.
  slidesai/decktopus outputs mimic exactly this — a slide that looks like a
  template with placeholder copy = `uncertain`, not human_likely, when the
  deck could be generated; but do not call it AI either.
- Deliberately naive/hand-drawn style does not prove human — image models
  mimic it (Krea_2 wolf example). Style authenticity is not evidence either way.
- Conversely AI-looking polish does not prove AI: judge *content provenance
  signals*, not vibes.

## Pipeline attribution: codegen vs imagegen

Two distinct artifact families — report `pipelineGuess` separately from `toolGuess`:

| Pipeline | Signature | Tools |
|---|---|---|
| `codegen` | HTML/JS authored by a coding model — React/Vite/Next stacks, utility-CSS class soup, component structure, lorem-free real copy in DOM | v0, Lovable, Bolt, Blink, Websim, Base44, Polsia, Trickle, Emergent, Replit, AI Studio |
| `imagegen` | The artifact IS a rendered image — whole-slide-as-image decks, baked-in typography inside pixels, `slide-agent` thumbnail grids, DALL-E/Imagen-class pool flags | ChatGPT image-slides, Genspark thumbnails, Gamma image assets |
| `mixed` | codegen skeleton + imagegen assets (most deck tools) | Gamma (React DOM + image pool flags), Presenton, Decktopus, SlidesAI |
| `designer-tool` | Human-operated builder pipeline — proves tooling, not AI authorship | Webflow, Wix, Framer, Squarespace, Pitch |

Imagegen tells (artifact itself): text lives inside the raster (flawless anti-aliased
glyphs, no DOM text nodes), `NN-NN-*.png` slide sequences, `blob.core.windows.net`
slide-agent paths, single `<img>`/`<canvas>` occupying the whole viewport.
Codegen tells: real DOM tree, selectable text, framework hydration markers,
bundle chunk filenames. `mixed` = both present.

## Verdicts

| Verdict | Rule | `aiGenerated` | Confidence grade |
|---|---|---|---|
| `ai_confirmed` | Tier-A provenance for a *generator* host/badge, or decisive in-artifact generation evidence (A4 dumps, embedded checkpoint names, safetensors grids) | `true` | high |
| `ai_likely` | ≥2 tool-specific Tier-B, or Tier-C anomaly rule met, or AI-first deck-tool host | `true` | medium |
| `uncertain` | evidence insufficient, mixed, or human-operated pipeline w/o authorship evidence | `null` — **NOT false** | low |
| `human_likely` | human-side evidence (designer-tool pipeline, template placeholders, real-entity anchors) and no AI tells | `false` | low |
| `human_confirmed` | decisive human evidence (SlidesGo credit line, literal unfilled placeholders, verifiable real publication) | `false` | high |
| `unavailable` | blank/unloadable input | `null` | — |
| `toolpage` | the tool's own marketing/chat UI, not an artifact | `null` | — |

`aiGenerated` is **tri-state**: `true`/`false`/`null`. Consumers MUST treat
`null` as "undetermined", never as "human-made". A missing verdict is not a
negative finding.

`confidence` is an **ordinal certainty grade**, not a calibrated probability —
0.9+ means "provenance/decisive evidence observed", ~0.7 "multiple independent
tells", ~0.5 "borderline", ≤0.4 "weak lean". Do not quote it as an accuracy.

Hard rules:
- Generator-host (Tier A) ⇒ `ai_confirmed` for the design/layout scope; text and
  embedded-image authorship stay `unknown` unless separately evidenced (scope field).
- Human-operated-tool host/meta (Canva/Framer/Webflow/Wix/Pitch/Beautiful.ai/
  Replit) alone ⇒ `uncertain`–`human_likely`; never `ai_confirmed`.
- Production method ≠ AI involvement: a real DOM (React/Vite) does not prove a
  coding model wrote it, and a full-raster slide does not prove an image model
  rendered it. `pipelineGuess` records the *method family*; `modelGuess` and
  AI-process claims stay `null` without per-asset evidence.
- Generic layout, polished prose, real logos, placeholder copy, and even
  shipped error messages are EACH non-proving alone — they are weak tells,
  never provenance.
- Screenshot-only input ⇒ cap at `ai_likely` unless a watermark/badge is visible.
- Model attribution requires A4-style in-artifact evidence. Style-only guesses → `uncertain`.

## Model-level attribution (be honest)

Tool-level attribution is often provable; the **underlying model usually is not**.
What is actually known/observable:

| Tool | Model evidence |
|---|---|
| Gamma | A4 config dump names the pool: GPT-4-class text + DALL-E/Imagen3/Ideogram/Leonardo/Recraft/Flux-Schnell/SDXL image vendors + `gemini-2.0-flash-001` for ppt import. Per-asset vendor NOT identifiable — report the pool, not a guess. |
| Lovable | Runs on GPT Engineer infra (`gpt-engineer-file-uploads` bucket) — proves the platform; underlying model undisclosed. |
| Bolt | bolt.new (StackBlitz); model undisclosed in artifacts. Public statements suggest Claude-family — circumstantial only, never sole basis. |
| v0 | Vercel's pipeline; model undisclosed in artifacts. |
| Blink / Manus / Base44 / Polsia / Grok | Proprietary; no in-artifact model disclosure observed. `grok-project-id` ⇒ xAI stack is implied by the tool itself (that's tool-level, still not a named model version). |
| ChatGPT image-slides / `*.chatgpt.site` | Whole-slide-as-image ⇒ image-gen model (GPT-image-class); `*.chatgpt.site` host ⇒ OpenAI pipeline; exact model version not stated. |
| Genspark | Proprietary slide-agent pipeline; model undisclosed. |

Circumstantial model tells (LOW confidence, never sole basis): emoji-free clean copy,
em-dash density, "Here's the thing"-style LLM-isms, perfect grammar + generic phrasing.
Always report `modelGuess` separately from `toolGuess`; default it to `null`.

## Output format

```json
{
  "aiGenerated": true,
  "verdict": "ai_confirmed",
  "confidence": 0.95,
  "toolGuess": "gamma",
  "pipelineGuess": "mixed",
  "modelGuess": null,
  "scope": { "design": "ai", "text": "unknown", "images": "ai-pool-unattributed" },
  "model_evidence": "embedded feature flags name DALL-E/Imagen3/Ideogram/Flux image pool + GPT-4 text gen",
  "evidence": ["A1: *.gamma.site host", "A2: Made-with-Gamma badge", "B: Next.js+Emotion+gamma-* classes"],
  "notes": "what would raise/lower confidence"
}
```

Field contract:
- `aiGenerated`: **tri-state** `true | false | null` — null = undetermined
  (`uncertain`/`unavailable`/`toolpage`), never a synonym for human-made.
- `verdict`: the graded call per the table above.
- `confidence`: ordinal grade only — see Verdicts. Not a calibrated probability.
- `toolGuess`/`modelGuess`: `null` when not attributable.
- `pipelineGuess`: production-method family — `codegen | imagegen | mixed |
  designer-tool | null`. It describes HOW the artifact was built, not whether
  AI did it (a hand-written React site is also `codegen` method).
- `scope`: per-component authorship — `design` (layout/structure), `text`
  (copy), `images` (embedded media); each `ai | human | unknown`. Generator
  hosts give `design:"ai"` while `text`/`images` may stay `unknown` or `human`
  (e.g. a human-authored report published via Gamma).
- `evidence[]`: concrete observed markers only (never vibes).

## Measured performance (dataset-internal eval)

`scripts/detector-eval.mjs` implements these rules deterministically (no model calls)
and scores them against the collected corpus. Split is per-artifact hash
(`sha1(path)` → 30% held-out test), so no artifact appears in both sides.

Held-out test results (n=4,201 HTML records scanned, 32 dirs):

| Class | n | Caught | FP | Missed | Abstain |
|---|---|---|---|---|---|
| AI artifacts | 2,272 | 99.5% | — | 0 | 12 |
| Human pages | 113 | — | 0 (0%) | — | 68 |
| Tool pages | 1,447 | identified separately (not scored) | | | |

**No-host mode** (URL stripped — simulates bare HTML exports / offline captures):
AI caught 67.3% held-out, human FP 0%. Lower than the earlier 76.1% because the
generic Vite/React/Tailwind stack no longer counts toward `ai_likely` (it is a
production-method note, not an AI tell) — the tightening is intentional and the
residual are stub shells whose only tell was the host. Abstain is correct there.

**Contract check** (`scripts/detector-contract.mjs`, 8/8): gamma host ⇒
`ai_confirmed` + `scope.design=ai`/`text=unknown`; framer ⇒ `human_likely`;
hand-written React/Tailwind/Lucide SPA ⇒ `uncertain` + `aiGenerated=null`;
bare URLs and generic hosts ⇒ `uncertain`+`null`. `aiGenerated` is tri-state
and `null` propagates — consumers never see `uncertain` collapse to `false`.

Honest caveats:
- Selection bias: AI dirs were collected largely *via* their decisive surfaces
  (hosted-artifact domains), so URL-mode accuracy is partly tautological. Treat
  no-host mode as the realistic bound for stripped inputs.
- Labels are collector provenance, not independent annotation. Two train-split
  "FPs" were `*.gamma.site` files misfiled under `dataset/wix/` — the detector
  was right, the directory label was wrong. Dir labels are noisy; trust
  in-artifact evidence.
- deckgallery abstentions (68) are intentional: human gallery HTML carries no
  decisive markup and abstain beats guessing.

### Visual-only blind evaluation (Tier C, measured)

`scripts/blindset-build.mjs` samples screenshots into neutral names
(`img_NNN.ext`) under `dataset/_tmp/blindset/`; `scripts/blindset-score.mjs`
scores a `blindset-judge.jsonl` of pixel-only verdicts against the key. The
judge saw ONLY the image — no filename, URL, host, or source dir.

Blind run (n=108, stratified across 23 source dirs; 67 AI / 41 human before
audit). Ground truth audited after judging — 3 items were label contamination
the visual judge got *right* (gamma.site artifact and bidriot.lol app misfiled
under `wix/`; Presenton deck screenshot under `human/`), 2 items were genuinely
contested (chatgpt-slides entries containing human-made Canva templates) and
excluded:

| Mode | AI catch | AI miss | AI abstain | Human FP | Human abstain |
|---|---|---|---|---|---|
| Full visual (n=106, badges in-frame allowed) | 88.2% (60/68) | 8.8% | 2.9% | 13.2% (5/38) | 2.6% |
| No-badge subset (n=74, badge/chrome items removed) | 77.8% (28/36) | 16.7% | 5.6% | 13.2% (5/38) | 2.6% |

Per-pipeline (audited, badge-allowed): codegen 47/50 caught, mixed 12/15,
imagegen 1/3 (small n — the two contested exclusions were imagegen).

**v1 is a learning/internal set — not an independent test.** Its failure list
informed cue tuning, so treat its numbers as a lower bound on difficulty, not
validation.

Failure taxonomy observed:
- **AI misses**: human-authored-looking content ON AI platforms (gamma.site
  event/report pages read as human editorial); AI slides indistinguishable
  from hand-set decks; a Lovable clone of a real brand report.
- **Human FPs**: polished template decks (Beautiful.ai "SaaS Pitch Deck",
  SlidesCarnival stat slides, Pitch slide containing an app-mockup design) —
  systematic polish is shared between human templates and AI output.
- **Dedup hole**: near-duplicate pairs leaked into the set (two Presenton
  community shots of one deck; img_061/062 same Canva template family;
  img_088/089 same app concept across different sources) — filename-level
  grouping is insufficient; content-hash dedup needed for future sets.
- imagegen sample too small (n=3 after audit) to bound — do not quote a rate.

#### Second blind set (v2, n=130 — unseen, per-source isolated)

`blindset-build2.mjs` rebuilds with sha1 content dedup, v1 exclusion, and
per-(dir,author/model/deck) group caps. Post-judge audit excluded 12 of 130:
6 same-deck leaks (hash-named chatgpt-slides files evaded the name-based
grouping — Mind Travel deck ×5, Infercat deck ×3), 3 contested labels
(emergent.sh own auth page = tool UI, two decktopus marketplace vendor
templates), 3 unmeasurable captures (blank websim shell, blank white, IANA
example.com placeholder).

| Mode | AI catch | AI miss | AI abstain | Human FP | Human abstain |
|---|---|---|---|---|---|
| Full visual (n=118) | 90.9% (70/77) | 3.9% | 5.2% | 22.0% (9/41) | 2.4% |
| No-badge subset (n=88) | 88.0% (44/50) | 6.0% | 6.0% | 23.7% (9/38) | 2.6% |

Per-pipeline (audited, badge-allowed): imagegen **16/16**, codegen 44/46,
mixed 10/15. Caveat: badge/chrome items repeat a small number of builder
signatures (Presenton community chrome ×6, v0 template chrome ×4, Lovable
badge ×6…) — badge-assisted catches share one visual cue per tool, so the
no-badge rate is the honest generalization estimate.

#### imagegen supplement (v2b, n=61 — model/author/diverse)

`blindset-build2b.mjs` adds confirmed-provenance imagegen: civitai
(baseModel+author provenance, one per author/model group), X media with
explicit claims (2 AI-claimed, 1 hand-drawn human control), genspark decks
(deck-dir grouping), slidesai/decktopus template-mimic hard cases, human
image/template controls. Audit excluded 8: 4 same-author/same-deck pairs the
group keys missed, 4 decktopus marketplace vendor templates (label noise).

| Mode | AI catch | AI miss | AI abstain | Human FP | Human abstain |
|---|---|---|---|---|---|
| Full (n=53; no badge items present) | 80.0% (24/30) | 16.7% | 3.3% | 21.7% (5/23) | 0% |

Per-pipeline: imagegen 18/19 caught (miss = AI wolf rendered in hand-drawn
style), mixed 6/11 (misses = slidesai template slides + a genspark deck that
reproduced a KAKENHI grant proposal convincingly).

**Combined imagegen across v2+v2b: 34/35 caught (97%)** — but dominated by
obvious AI render styles; the only miss was deliberate style mimicry, so do
not extrapolate to subtle cases.

#### Final held-out set (v3, n=146 → audited n=141 — NEW RULES applied)

v3 was built *after* the FP-control rules above were added, from disjoint
sources (sha1-excluded vs v1/v2/v2b, one per author/deck/template family).
Deliberately includes the hard classes: subtle photoreal imagegen
(Flux/Krea/Hunyuan/SDXL realism), slidesai template-mimic slides, genspark
JP formal decks with real citations, Gamma-hosted human-authored content,
and designer-tool landings. Audit excluded 5: 2 cross-set same-deck
(chatgpt-slides Mind-Travel/Infercat families), 1 same-author civitai pair,
2 blank captures.

| Mode | AI catch | AI miss | AI abstain | Human FP | Human abstain | Decided |
|---|---|---|---|---|---|---|
| Full (n=137) | 67.9% (55/81) | 8.6% | 23.5% | **8.9% (5/56)** | 16.1% | 79.6% |
| No-badge (n=113) | 55.2% (32/58) | 12.1% | 32.8% | 9.1% (5/55) | 16.4% | 73.5% |

Per-pipeline (full): codegen 37/40 caught (92.5%), imagegen 9/19 (47.4% —
10 abstains are the photoreal/subtle cases), mixed 9/22 (40.9% — the
template-mimicry class), human/human 0 FP, human/designer 5 FP / 27.

Post-hoc label audit added 4 `contested` exclusions: Gamma-hosted
human-authored content (real-person deck, Guru report, marketer portfolio,
SPACE 9). Collector provenance says `gamma` but the artifact is a
human-content/AI-layout composite — not binary-scoreable; excluded and
re-aggregated rather than counted as AI misses.

**Before/after on the FP fix — honest comparability:** v2/v3 are
different-difficulty sets, so 22.0%→8.9% is NOT a clean rule-effect number.
Mechanically re-mapping the *same* v2 judgments under the new rules
(ai_likely without badge or content-anomaly evidence → uncertain) gives
**~14.6% FP (6/41), catch 72.7%** — the rules cut dev-set FP by a third;
the remaining gap to 8.9% is set composition, not the rules.

v3 miss analysis (7 scored misses, all template mimicry):
- slidesai slides shipping literal placeholder copy read as human templates;
  genspark JP decks with real citations (Waseda comparative-lit seminar,
  Penguin-paperback bibliography, dense internal report w/ revision table)
  read as real work docs.
- The 4 Gamma-hosted human-content items are **excluded as contested**, not
  counted as misses: composite authorship (human text on AI layout) defeats
  binary ground truth. Reported separately so the reader sees the floor.
v3 FPs (5): webflow Nuvio/SPECODE (invented-brand + placeholder-demo data),
framer SendRoq/DeserveOS (invented logo walls + self-referencing screenshots),
beautifulai circular-diagram slide — the residual FP class is now narrow:
human designer landings that embed fabricated-looking demo content.

Consistent failure taxonomy across both sets:
- **Template mimicry is the #1 AI-miss class** (mixed pipe): slidesai and
  decktopus outputs ship SlidesGo-style placeholders and read as human
  templates; a genspark KAKENHI proposal read as a real academic doc.
- **Designer-tool FPs** (framer/wix/webflow/beautifulai): polished human
  landing pages + bento-stat decks share the AI idiom — invented-brand look
  is not AI-exclusive (Boc.Studio, EverSwap, Studio Minds typo-site were all
  human).
- **Style mimicry both ways**: AI hand-drawn-style wolf called human;
  human hand-drawn art (X claim) called AI.
- New visual tells worth weighting: garbled in-image text
  ("FREES USE PECH" shirt), pseudo-Japanese headers, invented-consulting
  case-study scroll pages.

Reproduce:

```bash
node scripts/blindset-build.mjs           # v1 set (historical)
node scripts/blindset-build2.mjs          # v2 dev set (130 imgs)
node scripts/blindset-build2b.mjs         # v2b dev supplement (61 imgs)
node scripts/blindset-build3.mjs          # v3 final held-out set (146 imgs)
# judge images visually -> dataset/_tmp/blindset{,2,2b,3}-judge.jsonl
node scripts/blindset-score.mjs --audit                  # v1 audited
node scripts/blindset-score.mjs --set v2 --audit         # v2 audited
node scripts/blindset-score.mjs --set v2b --audit        # v2b audited
node scripts/blindset-score.mjs --set v3 --audit         # v3 FINAL (new rules)
node scripts/blindset-score.mjs --set v3 --audit --no-badge  # strict visual
```

Usage:

```bash
node scripts/detector-eval.mjs --split test --cap 4000   # held-out metrics
node scripts/detector-eval.mjs --split all              # full sweep incl. unlabeled dirs
```

Worked judgment examples (all re-checkable in `dataset/`):

| File | Verdict | Evidence |
|---|---|---|
| `blink/<slug>.html` on `*.blinkusercontent.com` | ai_confirmed / blink | A1 host + `blink-badge*` classes + `auto-engineer.js?projectId=` stub variants |
| `wix/9vibesuniversal-*.gamma.site-*.html` | ai_confirmed / **gamma** | A1 host overrides wrong dir label — dataset noise caught by in-artifact evidence |
| `webflow/www.mainder.ai-*.html` (custom domain) | human_likely / webflow | `data-wf-*`+`webflow.css`+generator meta; designer-tool fingerprints never escalate to AI |
| `websim/…@user/slug` | ai_confirmed / websim | shell page but artifact embedded via `*.c.websim.com` iframe |
| `v0/v0.app-chat-*.html` | toolpage | v0's own chat UI (Next.js RSC payload) — provenance of the artifact, not the artifact itself |
| `deckgallery/*.html` | uncertain | human gallery chrome, no decisive markup — abstain is the honest answer |

## Extending this skill

Criteria must trace to `EVIDENCE.md` (observed fingerprints) — when analyzing a new tool,
record concrete fingerprints in `dataset/_notes/skill-author.md` first, then promote
distilled criteria here. See `docs/DATASET.md` for the collection pipeline.
