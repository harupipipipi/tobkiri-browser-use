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

## blink/ — 3,199 html + 2,684 png + 2,354 pdf + 350 webp shots + 400 provenance md (verified)

- Host alone is decisive: `*.blinkusercontent.com` (+ signed `?__bpt=` preview tokens).
- Live apps are SSR — full text in the initial GET. Artifact markers across 3,199 html:
  `built with Blink`/`og:description "An app built with Blink."` 1,748; `blink-badge*`
  classes (`blink-badge-container`, `blink-picker`, `blink-edit-hover`, `blink-seo-text`) 1,271;
  Vite `/assets/index-*.js` + `modulepreload` + `createLucideIcon-*.js`; inline
  `localStorage.getItem('theme')` dark-mode script; `images.unsplash.com` preloads.
- SPA stub shell (~650B): `<title>Blink App</title>` + `auto-engineer.js?projectId=<slug>`
  module script — unhydrated marker, needs a renderer; observed hydrated to 42KB DOM via
  a real browser tab.
- `Preview | Blink` interstitials (two kinds, both ~2KB, HTTP 200): "Authorized Users Only"
  gate and dead-project shell — hosting fingerprint, NOT app content (68 pre-filter files
  remain from earlier runs; collector now rejects them).
- Showcase provenance: `blink.new/p/<slug>` exposes `og:image` → `cdn.blink.new/screenshots/`
  official preview webp; `blink.new/p/<slug>.md` is a provenance doc (title, tech stack
  "React, TypeScript, Blink DB", creator handle, build time) containing the `Live URL:` line.
- Public index: `blink.new/llms.txt`-style index lists ~686k public projects across 687 pages.
- Visual (`3d-car-showroom*.png`): "Made with Blink" pill bottom-right; premium dark-luxe
  editorial — serif-italic display, numbered eyebrow `01 / THE COLLECTION`, orange accent,
  configurator/spec panels, footer `STUDIO MODE · V1.0`.

## reddit-ai/ — 77 imgs labeled `unknown-ai` (verified subset)

- Several ARE Gamma: "Made with GAMMA" pill visible in-image
  (`7ec04a40d143d2aa.png`, `ff6fe267fe984846.png`) — collector labels are provenance of
  fetch, not generator truth; badges override.
- Style: dark navy gradient, big-stat rows `87% / 0 / ∞`, italic parenthetical subtitle,
  comparison splits, numbered timeline chips.

## human/ — 52 imgs (verified subset)

- r/webdev-type posts: iPhone product-shot promos (real device photos w/ reflections,
  skeuomorphic UI) — `8e869c32b6917d93.png`, `b37e5687d5c90052.png`.
- `97bb83fc0123c4cd.png` (CHRCIT.COM): cream bg, hand-drawn border grid, dithered portrait,
  REAL book covers + REAL brand logos (React, Arc, Notion, BetterTouchTool), weather widget
  "VIENNA, AT 09:24 19°" — idiosyncratic human content.
- Slidesgo themes (`3899d954bc4511d7.jpg`, `51bc4c7cff4c3a1d.jpg`): placeholder copy
  "Here is where your presentation begins", "20XX" year slots, real photography (fig
  cross-section, train station), mixed serif/sans type — polished HUMAN templates;
  calibration: polished ≠ AI.
- apple.com/newsroom, ir.tesla.com shots — corporate human baseline.

## v0/ — 13 html + screenshots (verified)

- `<meta name="generator" content="v0.app">` in 11/13 — decisive.
- `v0-built-with-button-<uuid>` fixed div + dismiss button, injected via
  `self.__next_f.push` RSC streaming payload = Next.js **App Router**
  (vs Gamma's Pages Router `data-next-head`).
- The 2 non-generator files are `v0.app/templates/<id>` (v0's own gallery): internal
  design-system classes `v0-gray-*` ×256, `v0-alpha-*` ×120, `v0-blue-*`, `v0-caveat-*`.
- Deploy host convention: `v0-<slug>.vercel.app`.
- Visual (`v0-ai-food-order-bot*.png`): "Built with v0" dark pill bottom-right; black bg +
  single saturated accent (yellow), heavy display headline, step-indicator pills.

## pitch/ — pitch-front-deck.html (verified)

- `pitch.com/static/platform/asset/` font paths (eina01/lato/markpro woff2 +
  content-hash filenames), `pitch-assets-*`, title `"... by @front | Pitch"`.

## framer/ — crazyui.com artifact (verified)

- `<meta name="generator" content="Framer e0809aa">` (build-hash suffix).
- `framerusercontent.com` ×204; `data-framer-*` attrs ×518; `framer-*` classes ×887;
  `__framer__breakpoints`, `__framer__appearAnimationsContent` globals.
- CAVEAT: designer tool — proves Framer pipeline, not AI authorship (cap `ai_likely`).

## polsia/ — `*.polsia.app` sites (verified)

- `polsia.io` canonical + `polsia.io/opengraph-image?<hash>` (Next.js OG route),
  `polsia.com` refs; Next.js `_next` ×156, lucide ×57.
- Visual (ai-outletcom): cream bg, serif display, orange CTA, eyebrow chip, numbered
  card rows, mono micro-labels — editorial AI look.

## base44/ — 21+ `*.base44.app` sites (verified)

- `app.base44.com` (editor) + `media.base44.com` (asset CDN) in every file;
  `base44-edit-badge`, `base44-scale-in`, `base44-fade-in` classes; `id="root"` + lucide.

## grok/ — `*.grok.me` sites (verified)

- `<meta name="grok-project-id" content="<uuid>">` + `grok.com` script — decisive.
- Visual (apex-app): dark mobile-first app UI, mono labels, theme chips, Join/Login/guest.

## replit/ — `*.replit.app` sites (verified)

- Host `*.replit.app` + Vite+React (`id="root"`, lucide ×50); NO badge script observed;
  `replit-helped-build-*` data-testids are content links, not builder chrome.
  Host-only ⇒ `ai_likely` cap (humans deploy to replit.app too).

## webflow/ — 21 files (verified)

- `<meta content="Webflow" name="generator">`, `data-wf-site`, `data-wf-page`,
  `webflow.css` — human designer tool; pipeline proven, authorship usually human.

## aistudio/ — `*.ai.studio` sites (verified)

- Real per-site artifacts captured (bacalabsanalytics, docuvoiceafrica, matrix-1,
  prism-ai, subzero-ai...): all Vite+React+Lucide SPAs (`id="root"`,
  `/assets/index-<hash>.js`, `type="module"`) with NO self-identifying marker —
  the `*.ai.studio` host IS the fingerprint. Stack alone is generic vibe-code;
  combine host + stack for `ai_likely`. (ai.studio = Google AI Studio app hosting.)

## emergent/ — `*.emergent.host` sites (verified)

- `<a id="emergent-badge" href="https://app.emergent.sh/?utm_source=emergent-badge">`
  "Made with Emergent"; `<meta name="description" content="A product of emergent.sh">`;
  `ap.emergent.sh/static/array.js` analytics + `assets.emergent.sh/scripts/emergent-main.js`
  + `debug-monitor.js`; `id="root"`. Decisive.

## chatgpt/ — `*.chatgpt.site` sites (verified)

- Host `*.chatgpt.site` (canonical link present); HTML is semantic vanilla —
  `style.css`, `<header>/<main>/<section>`, skip-links, NO framework root.
  Copy style: punchy GPT short-sentences, eyebrows, numbered steps, FAQ accordions.
- Screenshot note: browser-native file inputs show the *collector's* OS locale
  (Japanese "ファイルの選択") — locale leakage is a capture artifact, not a design tell.

## wix/ — custom-domain site (verified)

- `wixstatic.com` asset CDN on custom domain `bidriot.lol` — Wix fingerprint survives
  custom domains. Wix = human site tool (pipeline only).

## From collector notes (`_notes/site-builders.md`, verified source inventory)

- lovable asset CDN: `cdn.gpteng.co` (matches observed `gpt-engineer-file-uploads` bucket).
- v0 badge href: `v0.app/chat/api/open/built-with-v0/...`.
- Bolt-on-Netlify keeps title "⚡️ Bolt.new + Vite + React".
- Framer published hosts: `*.framer.ai` + "Made in Framer"/"Create a free website with Framer".
- Additional AI-built hosts in the wild: `*.emergent.host`, `*.polsia.app`,
  `*.chatgpt.site`, `*.grok.me`, `*.ai.studio`, `*.wegic.net`.
- Documented dead ends: same.new/durable deploy to custom domains (no crawlable pattern);
  created.app SERPs are phishing-polluted (skipped deliberately).

## aippt/ mixo/ sitekick/ autoslide/ tome/

- Only ProductHunt marketing assets (`ph-files.imgix.net`) — tool *advertising*, not
  generated artifacts. No fingerprints extractable; listed in A1 on host-pattern only.

## slidesai/ slidebean/ decktopus/ beautifulai/ slidescarnival/ deckgallery/

- Template-gallery captures — the vendor's own pre-made designs, NOT generated user
  artifacts: slidesai `cdn.slidesai.io/screenshots/<driveId>/g*.png` (~746), slidebean
  per-slide renders (1,142), decktopus `framerusercontent.com` 1920×1080 webp embeds
  (517), beautifulai `cdn.prod.website-files.com` `*- Slide N.avif` (1,613), deckgallery
  signed `w=1366,q=82?-Sig=<hex>` srcset (~1,700; bare CDN URLs return 410).
- slidescarnival + deckgallery decks are human-made templates — treat as control
  material (`tool` label says fetch source, not authorship; see A5). pitch/ og:image
  renders are likewise human-designed template decks, not generated artifacts.

## presenton/ — community gallery (verified)

- `presenton.ai/community/presentations/<id>` — public gallery of ~366 AI-generated
  decks; HTML embeds full slide text + rendered captures. Real generated artifacts.

## canva/ — 10 rendered decks (verified)

- Raw fetch hits a "Client Challenge" bot-gate (3KB shells); headless-Edge
  `collect-site.mjs` passes — rendered HTML + PNG + PDF captured. Canva hosts human
  designs too: host alone ⇒ `ai_likely` cap stands.

## wegic/ — 277 `*.wegic.net` captures (verified)

- `id="wegic-branding-badge"`/`wegic-badge` classes + `cdn.wegic.ai` logo +
  `wegic.ai/assets/onepage/agent/` paths (also `aibuildcdn-dev.geesdev.com` CDN) —
  218/277 carry the badge (tier-gated); host + badge classes are the fingerprint.

## butternut/ — `*.butternut.ai` sites (verified)

- 13/14 HTML carry `butternut.ai` refs (×20 in one file); "Built on Butternut" is the
  collector fingerprint. Some custom-domain samples are now parked/404.

## websim/ — `*.c.websim.com` sites (verified)

- `websim.com/@user/slug` shell pages render 0B under `--dump-dom`; the artifact lives
  at the direct `*.c.websim.com` iframe URL (`__websim_origin`/`__websim_route` params),
  `__websim*` globals present. Host = `*.c.websim.com`, not websim.com proper.
- Correction (eval pass): the `@user/slug` project page itself still counts as the
  artifact record — the generated app is embedded via iframe, provenance is decisive.
  ~38KB SSR HTML over plain HTTP (not the dump-dom path). Bare `websim.com` paths
  without `/@` are tool pages, not artifacts.

## trickle/ — `*.trickle.host` sites (verified)

- `trickle`/`Trickle` markers throughout HTML (×29+ in samples).

## manus/ — 241 `*.manus.space` captures (verified 2026-09-21)

- 239/241 real site captures carry the dispatcher shell:
  `<manus-content-root></manus-content-root>` + inline
  `var __manus_space_editor_info = {spaceId:'<8-char slug>', patchList:[], hideBadge:false, ...}`
  + `var __manus__global_env = {apiHost:'https://api.manus.im', host:'https://manus.im', amplitudeKey:'<hex>'}`
  + `<script src="https://files.manuscdn.com/manus-space-dispatcher/spaceEditor-<hash>.js" async>`.
- `hideBadge:false` ⇒ badge drawn by dispatcher JS when enabled.
- Inner stack varies per site — Next.js, Vite+React (leftover `/vite.svg`), three.js,
  tailwind — the shell is the fingerprint, not the stack.
- Edge case (2/241): dead/offline spaces serve a "Manus Space" branded interstitial
  (`<title>Manus Space</title>` + centered SVG, no shell globals) — still Manus-infra,
  a distinct fingerprint, just not an artifact page.
- `manus/sessions/` also holds 256 shared-session replays fetched via public
  `api.manus.im/api/chat/getSessionV2|getSessionFilesV2?type=shared` routes;
  `user_file` uploads were deliberately skipped (user-private inputs, not AI outputs).

## Method notes

- `www.genspark.ai` returns a Cloudflare challenge to dependency-free fetch; the blob CDN
  does not — collectors should target the CDN manifest, not the SPA.
- PDFs captured for blink/bolt/lovable show no plain-text Producer/Creator via `strings`
  (compressed streams) — don't rely on PDF metadata without real extraction.
- Gaps still open: `slides-mixed/` (no samples yet); aippt/mixo/sitekick/autoslide/tome
  have PH marketing only; canva is bot-gated beyond the 10 captured decks; ~69 early
  blink captures are the "Authorized Users Only" wall (untokenized, pre-resolver).

## Detector eval findings (2026-09-22, scripts/detector-eval.mjs)

- Held-out test split (per-artifact hash, n=3,920): AI caught 99.4%, human FP 0%,
  abstain on human-gallery HTML (deck.gallery — no framework/CMS markers at all).
- No-host mode (URL stripped): AI caught 76.1%, human FP 0% — honest bound for
  bare-HTML inputs.
- Corpus label noise found by eval: `*.gamma.site` files misfiled under `wix/` and
  `chatgpt/` dirs — in-artifact evidence overrides collector dir labels.
- Designer-tool fingerprints (data-wf-*, webflow.css, wixstatic, squarespace) must
  NEVER escalate toward ai_likely — slidebean's marketing pages are literally
  webflow-built (51 files). Pipeline proven ≠ AI authored.
- butternut artifact on custom domain (journeysutra.com) carries webflow markup —
  likely rebuilt post-export; host erasure degrades to human_likely. Honest miss.
