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
| `manus.im/share/*`, `manus.im/app` artifacts on `files.manuscdn.com` | Manus | Share links + `files.manuscdn.com` media CDN. |
| `*.canva.com/design/*/view`, `*.my.canva.site` | Canva (Magic Design) | Canva hosts human-made designs too — host alone ⇒ `ai_likely` cap unless other signals. |
| `*.beautiful.ai` share links | Beautiful.ai | AI-assisted deck tool; same caveat as Canva. |
| `tome.app/*` public pages | Tome | AI deck tool. |
| `*.decktopus.com` | Decktopus | AI deck tool. |
| `*.pitch.com` public decks | Pitch | Human deck tool with AI features — host alone ⇒ `uncertain`. |
| `*.lovable.app`, `*.bolt.host`, `*.blinkusercontent.com`, `v0.app`/`*.v0.dev` chat-shared links | Lovable / Bolt / Blink / v0 | AI site builders. `*.vercel.app`/`*.netlify.app` alone are NOT evidence (generic hosts) — but the subdomain convention `v0-<slug>.vercel.app` is a weak v0 tell (observed in collector URL lists; UNVERIFIED against captured HTML). |
| `*.durable.co`, `*.mixo.io`, `*.framer.website` | Durable / Mixo / Framer AI | Site builders with AI generation; check for badge/generator meta. |

### A2. Watermarks and badges

Literal strings in HTML or visible as in-image corner pills (all observed bottom-right):

| Badge | Tool | Form observed |
|---|---|---|
| `Made with Gamma` / "Made with GAMMA" pill | Gamma | HTML `<a>` w/ SVG gamma logo (`css-1fr8asy`); white/blue pill in exported slides (`reddit-ai/7ec04a40d143d2aa.png` labeled `unknown-ai` — badge overrides collector label). Present in only 28/153 HTML exports (tier-gated). |
| `Made in Bolt` pill | Bolt | Dark pill bottom-right in screenshot; HTML injects `<script src="https://bolt.new/badge.js?s=<uuid>">` — 10/10 bolt HTML files. |
| `Made with Blink` pill | Blink | Small dark pill bottom-right (`blink/3d-car-showroom-*.png`); DOM `blink-badge-container` ×20, `blink-badge`. |
| `lovable-badge*` classes | Lovable | `lovable-badge`, `lovable-badge-close`, `-cta`, `-divider`, `-text` DOM classes; 11/17 lovable files carry any lovable fingerprint at all — badge is tier-gated. |
| `Built with v0` pill | v0 | Dark pill bottom-right (`v0/v0-ai-food-order-bot*.png`); DOM `v0-built-with-button-<uuid>` fixed div w/ dismiss button (11/13 v0 files). |
| "Built with Lovable", Canva/Beautiful.ai credit lines, Genspark logo lockup | various | Expected; verify in-artifact. |

Absence of a badge means nothing (paid tiers remove them) — never use absence as a human signal.

### A3. Generator/meta markup

- `<meta name="generator" content="...">` naming an AI tool — decisive.
  Observed: `<meta name="generator" content="v0.app">` in 11/13 v0 HTML files.
- Gamma quirk observed: `<meta name="robots" content=", ">` (malformed value) plus
  `og:image`/`twitter:image` `content="null"` — sloppy meta generation, strong tell.
- Blink default OG (conclusive when unedited): `og:title "Blink App"` +
  `og:description "An app built with Blink."` (17/17 non-gated blink apps in dataset).
- Manus shell: `csp-nonce` meta, `<meta name="theme-color" content="#f8f8f7">`,
  `google: notranslate`, assets on `files.manuscdn.com`.

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
| `blink-*` DOM classes (`blink-badge-container` ×20, `blink-picker`, `blink-edit-hover`, `blink-seo-text`) + Vite `/assets/index-*.js` + `createLucideIcon-*.js` chunk + inline `localStorage.getItem('theme')` dark-mode script + `images.unsplash.com` preload list | Blink |
| `bolt.new/badge.js` script, or leftover default `/vite.svg` favicon + `id="root"` + Vite `/assets/index-<hash>.js` | Bolt |
| `<meta generator content="v0.app">` or `v0-built-with-button-<uuid>` or internal classes `v0-gray-*`/`v0-alpha-*`/`v0-blue-*`/`v0-caveat-*` (v0's own design system) + Next.js **App Router** RSC payloads `self.__next_f.push` | v0 |
| `pitch.com/static/platform/asset/` font paths (eina01/lato/markpro woff2 + content-hash names), `pitch-assets-*`, title suffix `\| Pitch` | Pitch (host ⇒ uncertain — human tool w/ AI features) |
| `storage.googleapis.com/gpt-engineer-file-uploads/` asset bucket or `gpteng.co` refs or `lovable-badge*` classes + `id="root"` + Vite hash assets | Lovable (GPT Engineer backend) |
| Vite+React SPA (`id="root"` + `/assets/index-<base62>.js`) + Tailwind utility soup (`max-w-6xl mx-auto px-6`, `rounded-lg`) + `class="lucide lucide-*"` SVGs (`stroke-linecap="round"`, `stroke-width="2"`) — no tool marker | unattributed vibe-code stack ⇒ `ai_likely`, tool unknown (this stack is also human-usable, so never `ai_confirmed` on it alone) |
| Single-file page: Tailwind/Inter CDN + hero-gradient layout, no CMS chrome | AI site builder (generic — `ai_likely`, no tool attribution) |

Two or more independent Tier-B signals on the same artifact ⇒ `ai_likely` minimum.

## Tier C — Visual heuristics (screenshots only — weakest tier)

Positive tells (each is weak; need ≥3 for `ai_likely`, cap `uncertain` otherwise):
- Uniform card grids: N identical rounded-corner cards, perfectly equal spacing/alignment.
- Statement headline + tiny kicker ("04 / COMPETITORS & ADVANTAGES") + corner brand mark + footer furniture (page number, "Sources in speaker notes") — seen in ChatGPT-generated deck (`chatgpt-slides/`).
- ChatGPT image-slides: whole slide is ONE generated image — flawless baked-in type, oversized bold headline ending in a colored square period (`Infercat` deck), `NN / NN` page footers, flat line-art/contour illustration, restrained 2-3 color palette.
- Editorial-template look: hairline rules, small-caps metadata bands (セクション / 発行番号 / 日付 / ページ番号), oversized serif display type on cream stock — Genspark "一流レビュー誌" template (`genspark/`).
- Genspark consulting look: white bg, navy/ink text, KPI strip row of 4-5 metrics separated by thin dividers (`$4.2M · 138% · 82%`), status-dot tables (●●), footnote lines — typeset, not illustrated.
- Bolt light-landing skeleton: fixed translucent nav → 2-col hero w/ fake product UI → small-caps sections `THE PROBLEM`/`THE SOLUTION`/`PROCESS` → 3+2 icon-card grid → black pill CTA; Inter; lucide icons in gray rounded squares (`bolt/anshuranwa*.png`).
- Lovable dark-dev style: dark navy + single accent, subtle grid bg, pill badge ("Free — no signup required"), centered headline with ONE accent-colored word, terminal/code mockups (`$ cat intro.md`), JSON blocks, fake status bars ("Synced 12ms"), metric chips (`<1ms`, `12+`).
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
skeuomorphic/dated styling, raster noise of real captures. None are proof — humans use
templates too, and AI tools can embed real logos when asked.

**False-positive trap:** a marketing screenshot *of* an AI tool's website/editor (e.g.
ProductHunt gallery shots in `beautifulai/`, `slidesai/`, `tome/` — served from
`ph-files.imgix.net`) is human-designed marketing, not a generated artifact. Judge the
artifact, not the ad: marketing polish ≠ AI generation.

## Verdicts

| Verdict | Rule | Confidence |
|---|---|---|
| `ai_confirmed` | ≥1 Tier-A signal verified in the artifact | 0.9–1.0 |
| `ai_likely` | ≥2 Tier-B, or ≥3 independent Tier-C | 0.6–0.85 |
| `uncertain` | mixed or ≤2 weak signals | ≤0.5 |
| `human_likely` | no AI signals AND multiple human tells | ≤0.5, say why |

Hard rules:
- Canva/Pitch/Beautiful.ai host alone ⇒ cap at `ai_likely` (humans publish there too).
- Screenshot-only input ⇒ cap at `ai_likely` unless a watermark/badge is visible.
- Model attribution requires A4-style in-artifact evidence. Style-only guesses → `uncertain`.
- "AI-generated tool" ≠ "AI-generated content": a Gamma site could host human-typed text.
  Report what the signal proves (the *pipeline*), not what it implies.

## Output format

```json
{
  "aiGenerated": true,
  "verdict": "ai_confirmed",
  "confidence": 0.95,
  "toolGuess": "gamma",
  "modelGuess": null,
  "model_evidence": "embedded feature flags name DALL-E/Imagen3/Ideogram/Flux image pool + GPT-4 text gen",
  "evidence": ["A1: *.gamma.site host", "A2: Made-with-Gamma badge", "B: Next.js+Emotion+gamma-* classes"],
  "notes": "what would raise/lower confidence"
}
```

Field contract: `aiGenerated` = verdict ∈ {ai_confirmed, ai_likely}; `toolGuess`/`modelGuess`
= null when not attributable; `evidence[]` lists concrete observed markers (never vibes).

## Extending this skill

Criteria must trace to `EVIDENCE.md` (observed fingerprints) — when analyzing a new tool,
record concrete fingerprints in `dataset/_notes/skill-author.md` first, then promote
distilled criteria here. See `docs/DATASET.md` for the collection pipeline.
