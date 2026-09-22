---
name: ai-design-detector
description: Judge whether a slide deck, site, or design artifact was AI-generated, and when possible identify which tool/model pipeline produced it. Use when given a screenshot (PNG/JPEG), an HTML export, a URL, or a dataset metadata record and asked "was this made by AI?" or "which AI made this?".
---

# AI Design Detector

Decide whether an artifact (slide, site, landing page, document design) was produced by an
AI generation tool — and, when the evidence allows, name the tool and its model pipeline.

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

Any one of these, verified in the artifact itself, yields `ai_confirmed` for the tool named.

### A1. Hosted-artifact domains (the artifact IS served by the generator)

| Domain / URL pattern | Tool | Notes |
|---|---|---|
| `*.gamma.site` | Gamma | Public published docs/sites. Subpath pages = same doc. |
| `gensparkpublicblob.blob.core.windows.net` | Genspark | Asset CDN. Path `user-upload-image/public-skills/prod/slide-agent/v2/i18n/<locale>/<deck-slug>/thumbnails/NN-NN-*.png` = slide-agent deck thumbnails. |
| `manus.im/share/*`, `manus.im/app` artifacts on `files.manuscdn.com`; `*.manus.space` (8-char slug) | Manus | Share links + `files.manuscdn.com` media CDN; published sites on `*.manus.space`. |
| `*.canva.com/design/*/view`, `*.my.canva.site` | Canva (Magic Design) | Canva hosts human-made designs too — host alone ⇒ `ai_likely` cap unless other signals. |
| `*.beautiful.ai` share links | Beautiful.ai | AI-assisted deck tool; same caveat as Canva. |
| `tome.app/*` public pages | Tome | AI deck tool. |
| `*.decktopus.com` | Decktopus | AI deck tool. |
| `*.pitch.com` public decks | Pitch | Human deck tool with AI features — host alone ⇒ `uncertain`. |
| `*.lovable.app`, `*.bolt.host`, `*.blinkusercontent.com`, `v0.app`/`*.v0.dev` chat-shared links | Lovable / Bolt / Blink / v0 | AI site builders. `*.vercel.app`/`*.netlify.app` alone are NOT evidence (generic hosts) — but the subdomain convention `v0-<slug>.vercel.app` is a weak v0 tell (observed in collector URL lists; UNVERIFIED against captured HTML). |
| `*.durable.co`, `*.mixo.io`, `*.framer.website`/framer.site, `*.polsia.app`/`polsia.io` | Durable / Mixo / Framer / Polsia | Site builders; Framer + humans ⇒ cap `ai_likely`; Polsia = AI agent builder. |
| `*.base44.app` (+ `app.base44.com`, `media.base44.com` asset CDN in every page) | Base44 | AI app builder; `base44-edit-badge`/`base44-scale-in`/`base44-fade-in` classes. |
| `*.chatgpt.site` | ChatGPT sites | ChatGPT-built sites; often semantic vanilla HTML+CSS (no React) — see Tier B. |
| `*.emergent.host` | Emergent | AI builder; badge + scripts below. |
| `*.wegic.net` demos, `*.framer.ai` | Wegic / Framer published | Wegic AI demos; `*.framer.ai` + "Made in Framer" boilerplate. |
| `*.grok.me` | Grok (xAI app builder) | + `<meta name="grok-project-id" content="<uuid>">` + `grok.com` script — decisive. |
| `*.replit.app` | Replit | AI-capable IDE/host; humans deploy there too ⇒ `ai_likely` cap w/o other signals. |
| `*.ai.studio` site pages | AI Studio (Google) app hosting | Pages are Vite+React+Lucide SPAs w/ NO self-marker — host is the fingerprint; host+stack ⇒ `ai_likely`. |
| `*.butternut.ai` | Butternut | AI site builder; `butternut.ai` refs throughout HTML. |
| `*.trickle.host` | Trickle | AI site builder; `trickle`/`Trickle` markers in HTML. |
| `*.c.websim.com` (artifact iframe host); `websim.com/@user/slug` project pages | Websim | Project page embeds the generated app in an iframe — the page is a shell, but the artifact is inside ⇒ still `ai_confirmed`. `__websim_origin`/`__websim_route` params + `__websim*` globals. Bare `websim.com` non-project paths = tool page. |
| `presenton.ai/community/presentations/<id>` | Presenton | Public gallery — the page IS the generated deck (slide text embedded). |
| `presenton.ai/community/presentations/<id>` | Presenton | Public gallery of AI-generated decks; HTML embeds full slide text. |
| `*.webflow.io`/sites w/ `data-wf-site`+`data-wf-page`+`webflow.css`+`<meta generator content="Webflow">` | Webflow | Human designer tool — pipeline proven, authorship `uncertain`/`human_likely`. Custom domains hide the host: content fingerprints still identify the *pipeline* (eval: 10/10 custom-domain Webflow pages → `human_likely`). |
| `wixstatic.com` assets, `X-Wix` markup on custom domains | Wix | Same rule — designer pipeline, `human_likely`. |

### A2. Watermarks and badges

Literal strings in HTML or visible as in-image corner pills (all observed bottom-right):

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
| Vite+React SPA (`id="root"` + `/assets/index-<base62>.js`) + Tailwind utility soup (`max-w-6xl mx-auto px-6`, `rounded-lg`) + `class="lucide lucide-*"` SVGs (`stroke-linecap="round"`, `stroke-width="2"`) — no tool marker | unattributed vibe-code stack ⇒ `ai_likely`, tool unknown (this stack is also human-usable, so never `ai_confirmed` on it alone) |
| Single-file page: Tailwind/Inter CDN + hero-gradient layout, no CMS chrome | AI site builder (generic — `ai_likely`, no tool attribution) |

Two or more independent Tier-B signals on the same artifact ⇒ `ai_likely` minimum.

## Tier C — Visual heuristics (screenshots only — weakest tier)

Positive tells (each is weak; need ≥3 for `ai_likely`, cap `uncertain` otherwise):
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

| Verdict | Rule | Confidence |
|---|---|---|
| `ai_confirmed` | ≥1 Tier-A signal verified in the artifact | 0.9–1.0 |
| `ai_likely` | ≥2 Tier-B, or ≥3 independent Tier-C | 0.6–0.85 |
| `uncertain` | mixed or ≤2 weak signals | ≤0.5 |
| `human_likely` | no AI signals AND multiple human tells | ≤0.5, say why |

Hard rules:
- Canva/Pitch/Beautiful.ai/Framer host-or-generator-meta alone ⇒ cap at `ai_likely`
  (humans publish/design there too; the meta proves the pipeline, not AI authorship).
- Screenshot-only input ⇒ cap at `ai_likely` unless a watermark/badge is visible.
- Model attribution requires A4-style in-artifact evidence. Style-only guesses → `uncertain`.
- "AI-generated tool" ≠ "AI-generated content": a Gamma site could host human-typed text.
  Report what the signal proves (the *pipeline*), not what it implies.

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
  "model_evidence": "embedded feature flags name DALL-E/Imagen3/Ideogram/Flux image pool + GPT-4 text gen",
  "evidence": ["A1: *.gamma.site host", "A2: Made-with-Gamma badge", "B: Next.js+Emotion+gamma-* classes"],
  "notes": "what would raise/lower confidence"
}
```

Field contract: `aiGenerated` = verdict ∈ {ai_confirmed, ai_likely}; `toolGuess`/`modelGuess`
= null when not attributable; `pipelineGuess` ∈ {codegen, imagegen, mixed, designer-tool, null};
`evidence[]` lists concrete observed markers (never vibes).

## Measured performance (dataset-internal eval)

`scripts/detector-eval.mjs` implements these rules deterministically (no model calls)
and scores them against the collected corpus. Split is per-artifact hash
(`sha1(path)` → 30% held-out test), so no artifact appears in both sides.

Held-out test results (n=3,920 HTML records, 32 dirs):

| Class | n | Caught | FP | Missed | Abstain |
|---|---|---|---|---|---|
| AI artifacts | 2,010 | 99.4% | — | 0 | 12 |
| Human pages | 113 | — | 0 (0%) | — | 68 |
| Tool pages | 1,447 | identified separately (not scored) | | | |

Full-corpus sweep (n=21,603 scanned): AI caught 99.7% (11,003/11,039), missed 2,
human FP 2 (0.5% — both are `*.gamma.site` files misfiled under `wix/`; the
detector was right, the dir label was wrong).

**No-host mode** (URL stripped — simulates bare HTML exports / offline captures):
AI caught 84.9% full-corpus (76.1% held-out), human FP 0.5%/0%. The residual are
stub shells and badge-less artifacts whose only tell was the host — abstain is
correct there.

Honest caveats:
- Selection bias: AI dirs were collected largely *via* their decisive surfaces
  (hosted-artifact domains), so URL-mode accuracy is partly tautological. Treat
  no-host mode as the realistic bound for stripped inputs.
- Labels are collector provenance, not independent annotation. Two train-split
  "FPs" were `*.gamma.site` files misfiled under `dataset/wix/` — the detector
  was right, the directory label was wrong. Dir labels are noisy; trust
  in-artifact evidence.
- The screenshot/visual tier is documented but NOT covered by this harness
  (no vision in the scorer) — Tier-C precision is unmeasured.
- deckgallery abstentions (68) are intentional: human gallery HTML carries no
  decisive markup and abstain beats guessing.

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
