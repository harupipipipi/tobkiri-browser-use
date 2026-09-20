# Evidence log — ai-design-detector

Distilled from `dataset/_notes/skill-author.md` and direct inspection of collected
samples on 2026-09-21. Every Tier-A/B criterion in SKILL.md traces to an observation here.

## gamma/ — `dr-sabu-abraham.html` (322KB export of `*.gamma.site`, verified)

- Host: `*.gamma.site`; assets via `assets.gammahosted.com`.
- Framework: Next.js — `data-next-head` on head elements, `__NEXT_DATA__`,
  `/_next/static/chunks/`, `nomodule` polyfill chunk.
- CSS runtime: Emotion — `class="css-<hash>"` (22× `css-1doss8g`), `<style data-emotion="css ...">`.
- Watermark: literal "Made with Gamma" `<a>` + SVG logo (`css-1fr8asy`).
- Classnames: `gamma-moveable-wrapper` ×41, `gamma-badge`, `gamma-email`, `gamma-font`, `gamma-sites-*`.
- Infra refs: `gamma-app.vercel.app`, `gamma-app.workers.dev`.
- Font: Inter via Google Fonts css2 (weights 100–900).
- Meta quirks: `<meta name="robots" content=", ">`, `og:image`/`twitter:image` = `"null"`.
- **Model pipeline**: embedded feature flags/config — `generatorGPT4:true`,
  `gpt4oMiniGenerate:false`, `prefer-openai-dalle:true`, `imagen:true`, `imagen3:true`,
  `imagenFlash:true`, `ideogram:true`, `ideogram2:true`, `leonardoPhoenix:true`,
  `lumaPhoton:false`, `recraftModel:true`, `playground-api-sdxl:true`,
  `baseten-generate-flux-schnell-url` (Baseten endpoint), `geminiGenerate:false`,
  `importPptModels: {fastModel,bigModel: "gemini-2.0-flash-001"}`, `openAiStatus:"NORMAL"`,
  `web-image-provider:"serper"`.

## genspark/ — 2,385 slide thumbnails (verified)

- Source: `https://www.genspark.ai/ai_slides?tab=skills` public skills gallery
  (page itself is Cloudflare-challenged to plain fetch — 403 challenge page).
- Asset host: `gensparkpublicblob.blob.core.windows.net`
- Path pattern: `user-upload-image/public-skills/prod/slide-agent/v2/i18n/<locale>/<deck-slug>/thumbnails/NN-NN-<name>.png`
  (151 decks × ~15 slides; locales seen incl. `ja-JP`).
- Filenames are zero-padded slide positions: `01-01-cover.png`, `02-02-artifact-opener.png`, …
- Visual (inspected `ai-101-explainer-deck/01-01-cover.png`): Japanese editorial-magazine
  template — hairline rules, small-caps metadata band (セクション/発行番号/日付),
  oversized serif display with red emphasis characters, cream stock, page furniture
  "01 / 14". Consistent template system across decks.

## chatgpt-slides/ — 16 PNGs (verified)

- Source: reddit post images via `preview.redd.it` (r/ChatGPT, deck screenshots).
- Visual (inspected `chatgpt_deck_01.png` + samples): 16:9 deck, kicker
  "04 / COMPETITORS & ADVANTAGES", corner brand mark, giant statement headline,
  uniform 3-card comparison grid, thin-stroke monochrome illustrations with one
  accent color, footer "Product focus comparison · Sources in speaker notes".

## manus.im/app — homepage fetch (verified 2026-09-21)

- Next.js app shell (`_next/static` ×1212, React `charSet` attr style).
- CDN: `files.manuscdn.com` (ogBanner etc.).
- Meta: `csp-nonce`, `theme-color #f8f8f7`, `google: notranslate`,
  `apple-itunes-app app-id=6740909540`.
- Share/artifact pages: `manus.im/share/*` — collect rendered screenshots, not raw HTML
  (JS-rendered app).

## bolt/ — 10 sites × html+png+pdf (verified)

- `bolt.new/badge.js?s=<uuid>` script tag: 10/10 HTML files — decisive.
- Leftover default `/vite.svg` favicon observed (vibe-code tell).
- Vite+React: `id="root"`, `/assets/index-<base62>.js`; Tailwind utilities; `lucide` SVGs.
- Visual (`anshuranwa*.png`): "Made in Bolt" dark pill bottom-right; skeleton =
  fixed translucent nav → 2-col hero w/ fake chat UI → `THE PROBLEM` → `THE SOLUTION`
  → `PROCESS` (small-caps eyebrows) → icon-card grid; Inter; black pill CTA.

## lovable/ — 17 html + screenshots (verified)

- `storage.googleapis.com/gpt-engineer-file-uploads/...` asset bucket (GPT Engineer =
  Lovable backend), `gpteng.co`, `lovable.dev` refs: 11/17 files.
- `lovable-badge{,-close,-cta,-divider,-text}` DOM classes when badge enabled.
- All files: `*.lovable.app` host, `id="root"`, Vite hash assets, lucide icons (160× in one).
- Visual (`agentdb*.png`, `blueprintbuddy*.png`): dark navy + cyan accent, subtle grid bg,
  pill badge "Free — no signup required", headline w/ one accent word, terminal mockup
  (`$ cat intro.md`), JSON block, fake status bar "Synced 12ms", metric chips, small-caps
  eyebrow "THIS IS WHAT YOU GET".

## blink/ — 102 html (85 gated + 17 real apps) (verified)

- Gated previews (~85 files): `*.blinkusercontent.com`, title `Preview | Blink`,
  "Authorized Users Only" black interstitial, `blink.new/preview-access?project=` link,
  Cloudflare beacon. The interstitial itself = hosting fingerprint.
- Real apps: `blink-badge-container` ×20, `blink-picker(-active/-editing)`,
  `blink-edit-hover`, `blink-seo-text`, `blink-badge` classes; default OG
  `og:title "Blink App"` + `og:description "An app built with Blink."` (all 17);
  Vite `/assets/index-*.js` + `modulepreload` + `createLucideIcon-*.js`; inline
  `localStorage.getItem('theme')` dark-mode script; many `images.unsplash.com` preloads.
- Visual (`3d-car-showroom*.png`): "Made with Blink" pill bottom-right; premium dark-luxe
  editorial — serif-italic display, numbered eyebrow `01 / THE COLLECTION`, orange accent,
  configurator/spec panels, footer `STUDIO MODE · V1.0`.

## reddit-ai/ — 77 imgs labeled `unknown-ai` (verified subset)

- Several ARE Gamma: "Made with GAMMA" pill visible in-image
  (`7ec04a40d143d2aa.png`, `ff6fe267fe984846.png`) — collector labels are provenance of
  fetch, not generator truth; badges override.
- Style: dark navy gradient, big-stat rows `87% / 0 / ∞`, italic parenthetical subtitle,
  comparison splits, numbered timeline chips.

## human/ — 11 imgs (verified subset)

- r/webdev-type posts: iPhone product-shot promos (real device photos w/ reflections,
  skeuomorphic UI) — `8e869c32b6917d93.png`, `b37e5687d5c90052.png`.
- `97bb83fc0123c4cd.png` (CHRCIT.COM): cream bg, hand-drawn border grid, dithered portrait,
  REAL book covers + REAL brand logos (React, Arc, Notion, BetterTouchTool), weather widget
  "VIENNA, AT 09:24 19°" — idiosyncratic human content.

## v0 (pending — collector in progress)

- `_tmp/v0-batch.txt`: targets are `v0-<slug>.vercel.app` + `v0.app/templates/<id>`.
  Subdomain convention is a weak tell; no captured v0 HTML verified yet.

## Method notes

- `www.genspark.ai` returns a Cloudflare challenge to dependency-free fetch; the blob CDN
  does not — collectors should target the CDN manifest, not the SPA.
- PDFs captured for blink/bolt/lovable show no plain-text Producer/Creator via `strings`
  (compressed streams) — don't rely on PDF metadata without real extraction.
- Gaps still open: beautifulai, canva, decktopus, pitch, slidesai, tome, manus share
  artifacts, v0 captures (dirs exist or collector queues only).
