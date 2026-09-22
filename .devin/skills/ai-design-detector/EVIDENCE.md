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

## Visual blind eval (2026-09-22, scripts/blindset-score.mjs, eval/blindset/)

108 images judged pixel-only (no filename/URL/host). Audited n=106 after fixing
3 label-contamination items and excluding 2 contested (AI decks embedding human
Canva templates).

- Full visual mode: AI caught 88.2% (60/68), missed 8.8%, abstain 2.9%;
  human FP 13.2% (5/38). No-badge subset (n=74): AI caught 77.8%.
- Strongest visual AI tells observed: invented-ecosystem furniture (fake
  metrics/verified-cards/trending), env-var leaks in prod UI
  ("ANAM_API_KEY is not set"), in-artifact model claims ("Powered by Gemini 3
  Flash"), wrong unit conversions ("32 OZ (901g)"), typo'd metrics in polished
  UI, AI-vs-AI comparison images ("chatgpt" vs "nano banana" labels).
- Main FP class: polished human template decks (Beautiful.ai SaaS-pitch
  template, SlidesCarnival stat slides, Pitch slide w/ app-mockup) read as
  "AI-deck idiom". Polish alone is not sufficient evidence.
- Main miss class: human-authored content on AI platforms (gamma.site event
  pages, Lovable clone of Filmsupply report) — platform≠authorship cuts both
  ways visually.
- Label contamination found BY the eval: gamma.site artifact + bidriot.lol
  app misfiled under wix/; Presenton community screenshot under human/.
- Dedup hole: filename-level grouping let near-dup pairs into the set
  (same Presenton deck twice; Canva template family; same app concept across
  blink/beautifulai). Future sets need content-hash dedup.
- imagegen n=3 post-audit — too small to bound a rate.

## Visual blind eval round 2 (2026-09-23, blindset2 + blindset2b)

Two new unseen sets judged pixel-only. Keys/audits/judgments in
`eval/blindset/blindset2*.json{,l}` — v2 n=130, v2b n=61.

### blindset2 (mixed pipes, n=118 scored after audit)

- Full visual: AI caught 90.9% (70/77), missed 3.9%, abstain 5.2%;
  human FP 22.0% (9/41), abstain 2.4%.
- No-badge subset (n=88): AI caught 88.0% (44/50), human FP 23.7% (9/38).
- Per-pipe: imagegen 16/16, codegen 44/46, mixed 10/15.
- Audit exclusions (12): Mind Travel deck leaked ×5 and Infercat deck ×3 —
  hash-named `chatgpt-slides/` files evaded filename grouping (content-hash
  dedup caught bytes-dups but not same-deck different slides); emergent.sh
  own auth page (tool UI, not artifact); 2 decktopus marketplace vendor
  templates (platform hosts human-made templates — label noise); 3 blank/
  placeholder captures (unmeasurable).
- Badge/chrome caveat: 30 badge items repeat ~13 builder signatures, so
  badge-mode catch partly measures badge recognition — quote the no-badge
  rate for generalization.

### blindset2b (imagegen-focused supplement, n=53 scored after audit)

- Full: AI caught 80.0% (24/30), missed 5, abstain 1; human FP 5/23.
  (Set contained no badge items — identical to no-badge mode.)
- imagegen 18/19 caught; mixed 6/11.
- Audit exclusions (8): 3 same-author civitai pairs (group regex keyed on
  id+author, not author alone), 1 same-deck slidesai pair, 4 decktopus
  marketplace vendor templates.

### Combined imagegen evidence (v2+v2b, n=35 scored)

- 34/35 caught (97%). Sole miss: civitai Krea_2 wolf rendered in a
  deliberately naive hand-drawn style — style mimicry defeats visual priors.
- Dominated by obvious AI renders (hyperreal anime, impossible scenes,
  fur/latex physics, garbled in-image text). Rate does NOT bound subtle
  photo-like output.

### New confirmed visual tells

- Garbled in-image text: "FREES USE PECH" t-shirt — decisive imagegen tell.
- Pseudo-Japanese headers in AI decks ("レプオブス" non-word in a corporate
  quarterly-review slide).
- "Here is where your presentation begins" placeholder = SlidesGo template —
  human unless typos/invented content coexist (a human deck can typo too:
  "Psychchology" human slide was an FP).

### Failure taxonomy additions

- **slidesai/decktopus template mimicry** = the dominant AI-miss class in
  both sets (5 of 8 v2b misses). Their output ships template placeholder
  conventions — visually indistinguishable from human templates.
- **genspark real-doc mimicry**: KAKENHI grant proposal (Kyoto iPS, real
  funding scheme, ¥42.8M) read as human academic doc — top-tier miss.
- **Designer-tool FPs doubled** vs v1 (22% vs 13.2%): framer/wix/webflow/
  beautifulai/deckgallery items with invented-brand look + bento-stat polish.
  Invented-brand + polish is NOT sufficient AI evidence.
- **Hand-drawn both ways**: AI naive-style wolf -> called human (miss);
  human hand-drawn wolf (X, explicit "手描き" claim) -> called AI (FP).

### Eval-infrastructure lessons

- Trailing-image cap on batched reads dropped leading images silently and
  shifted judgment-to-file mapping for ~2 batches (043-049, 034-042).
  Caught by ev-vs-keydir consistency scan; all affected items re-read solo.
  Batch visual reads at <=3 and always re-verify first/last of a batch.
- Group regexes must capture a *meaningful* identity (deck dir, author).
  Hash-named dirs (chatgpt-slides) need content-based clustering or a
  hard per-dir cap; dt-img marketplace items need provenance review before
  they can carry an AI label.

### blindset3 (final held-out set, n=146 -> audited n=141)

Built after FP-control rules were added to SKILL.md (invented-brand+polish
demoted to uncertain, >=2 content-anomaly tells required, real-entity anchors
weigh human, placeholder copy is bidirectional). Disjoint sources vs
v1/v2/v2b (sha1-verified 0 overlap); one item per civitai author/model;
deck-dir isolation for genspark/slidesai; matched visual conditions
(designer-tool landings vs codegen landings, template slides vs
template-mimic AI slides).

- Full (n=141): AI caught 64.7% (55/85), missed 11 (12.9%), abstain 19
  (22.4%); human FP 5/56 (8.9%), correct 42, abstain 9. Decided 80.1%.
- No-badge (n=117): AI 51.6% (32/62), miss 17.7%, abstain 30.6%;
  human FP 9.1% (5/55). Decided 74.4%.
- Per-pipe: codegen 37/40 (92.5%), imagegen 9/19 (47.4% — 10 abstains are
  the photoreal/subtle cases), mixed 9/26 (34.6%), human/human 0 FP,
  human/designer 5 FP + 8 abstain.
- Audit exclusions (5): 2 cross-set same-deck (chatgpt-slides Mind-Travel
  and Infercat families reused hash-named files across sets — builder
  keyed on file, not deck), 1 civitai same-author pair, 2 blank captures.
- Before/after on the FP fix: dev-set human FP 22.0%/21.7% -> final 8.9%;
  recall cost: catch 90.9% -> 64.7%, abstains 5.2% -> 22.4%.

### v3 miss class detail (all 11 misses = 2 classes)

- Gamma-hosted human content (4): real-person decks/reports/portfolios
  (Patrick Collins deck, Guru enterprise report w/ real authors, Brett
  Swensen marketer portfolio, SPACE 9 Tokyo site w/ real map) — human
  CONTENT on an AI pipeline. Provenance says ai; pixels honestly say human.
  This is the floor of visual detection.
- Template mimicry (7): slidesai slides shipping literal SlidesGo
  placeholder copy ("Month, Year", "Elaborate on what you want to
  discuss", "Replace this text...") scored as human templates; genspark
  JP docs w/ real citations (Waseda comparative-lit seminar w/ 李商隠/
  マラルメ + real bibliography; Penguin-paperback collector page;
  dense internal report w/ revision table) read as real work docs.

### v3 false positives (5 — residual class is narrow)

- webflow Nuvio: invented fintech brand + "Acme Corp" placeholder merchant
  inside a demo transaction table — the placeholder-demo-data tell fired
  on a human site that ships demo content.
- webflow SPECODE: jane@acme.com placeholder in a live form field.
- framer SendRoq: SendRoa/SendRoq name inconsistency + invented
  client-logo wall (UUDO/Flash/Medu) — real human site with sloppy assets.
- framer DeserveOS: self-referencing product screenshot + laurel stats.
- beautifulai circular-diagram slide: gradient + vague "one platform"
  copy — the last layout-only FP.

### Subtle/photoreal imagegen (v3, the honest frontier)

10 of 19 imagegen items abstained: photoreal fashion (sequin dress,
gold-leggings Nike shot), fern terrarium, brass telescope, rainy street,
B&W flamingo fine-art, painterly arch abstract. Flux.2/Krea 2/Hunyuan/SDXL
realism without anomaly is NOT visually separable from real photos — the
verdict is uncertain, and that is the correct answer. Caught imagegen (9)
needed tells: safetensors checkpoint-name grid (v3_086), impossible-craft
(straw mouse motorcycle), AI-fantasy renders, melted-detail anime.

### New v3-specific tells

- In-artifact platform URL inside the artifact itself (mardonic.polsia.app
  rendered in its own card) = badge-equivalent evidence.
- Test-value GSTIN 33ABCDE1234F1Z5 in an embedded Indian-business demo =
  fabricated-data tell (v3_091).
- Repeated identical widgets across cards (same Buildability bars in every
  paper card, v3_140) = template-instantiation tell.
- Name inconsistency inside one artifact (SendRoa logo vs SendRoq copy).

### Cross-cutting conclusion

Visual-only judgment separates into: (a) badge/chrome items ~sure,
(b) codegen apps ~92%, (c) obvious imagegen ~sure, (d) subtle imagegen /
template-mimic slides / human-content-on-AI-hosts = the abstention zone —
and abstaining there is correct, not a failure of the rubric.

## Contract refactor (provenance vs generation separation)

User-identified inconsistency fixed across SKILL.md + detector-eval.mjs:

1. **Two-question split**: Tier-A signals now prove the *pipeline* only.
   Generator hosts (`*.gamma.site`, `*.lovable.app`, `*.c.websim.com`, ...)
   yield `ai_confirmed` at design/layout scope; human-operated tool hosts
   (framer.website, webflow.io, canva, pitch, replit, beautiful.ai) yield
   `uncertain`/`human_likely` — pipeline confirmed, authorship undetermined.
   `scope` field separates design / text / images authorship
   (a Gamma-hosted human report: design=ai, text=unknown).
2. **aiGenerated is tri-state**: `true | false | null`. uncertain /
   unavailable / toolpage -> null, never false. Consumers must not read
   null as "human-made".
3. **Production method != AI involvement**: generic Vite+React+Tailwind+
   Lucide stack is a method note (`pipelineGuess:"codegen-style stack"`),
   excluded from the >=2 Tier-B escalation rule (tool-specific signals only).
   Raster slide != imagegen, DOM != codegen — per-asset evidence required
   for model claims (`modelGuess` stays null without it).
4. **confidence is an ordinal grade**, not a calibrated probability —
   documented in the Verdicts table.

### Contract test (scripts/detector-contract.mjs, 8/8 pass)

- gamma host page -> ai_confirmed, aiGenerated=true, scope.design=ai,
  text=unknown
- framer site -> human_likely, aiGenerated=false
- hand-written React/Tailwind/Lucide SPA (no markers) -> uncertain,
  aiGenerated=null
- websim artifact -> ai_confirmed
- human baseline -> uncertain
- bare URL / pitch.com URL / generic vercel.app host -> uncertain + null

### Re-scored eval under the refactor

- detector-eval held-out test: AI 99.5% (2260/2272), human FP 0/113.
- no-host: 67.3% (was 76.1%) — the drop is the intentional vibe-stack
  demotion; borderline artifacts now abstain instead of overclaiming.
- blindset3 re-aggregated after marking 4 Gamma-hosted human-content items
  `contested` (composite authorship — collector-provenance-only labels):
  Full n=137: AI 67.9% (55/81), miss 8.6%, abstain 23.5%;
  human FP 8.9% (5/56). No-badge n=113: AI 55.2%, FP 9.1%.

### FP-fix comparability (honest)

v2 (dev) and v3 (final) are different-difficulty sets — 22.0% -> 8.9% is
NOT a pure rule effect. Mechanical re-mapping of the same v2 judgments
under the new rules (ai_likely lacking badge + content-anomaly evidence ->
uncertain) gives **14.6% FP (6/41), catch 72.7%** on the identical dev set:
the rules cut FP by ~a third on like-for-like data; the rest of the gap is
set composition. Remaining v2 demoted-FPs show a new boundary: humans also
ship invented demo metrics (real-estate/financial template slides) —
"invented numbers" alone is not AI-exclusive either.

## Strict provenance/generation separation (contract v2)

Follow-up correction: the previous refactor still assumed "generator host =>
design ai_confirmed" (scopeFor + Tier-A text). User review flagged it —
hosting/publishing is not a generation record. Final semantics:

1. **ALL hosts are provenance-only**, including generator artifact domains
   (`*.gamma.site`, `*.lovable.app`, `*.c.websim.com`, ...). Host alone =>
   `provenance.confirmed` + `uncertain` + `aiGenerated:null`. Symmetric:
   designer hosts (framer/webflow/wix/pitch) => `uncertain`, NOT
   `human_likely` — the tool proves neither direction.
2. **Generation evidence is per-item (G tier)**: artifact badge scripts/
   globals emitted only in generator output (`bolt.new/badge.js`,
   `lovable-badge`, `v0-built-with-button`, `emergent-badge`,
   `wegic-branding-badge`, `base44-edit-badge`, `blink-badge*`,
   `auto-engineer.js?projectId=`, `__websim_*` globals, `grok-project-id`
   meta, manus artifact shell, `generator=v0.app` per-item claim, blink
   "built with" OG). Publish badges (`Made with Gamma`, `Made in Framer`,
   Canva credits) and runtime config dumps (gamma flag pool) are P-tier
   provenance — they appear on imported/hand-edited docs too.
   v0 design-system classes = weak G (`G-` => `ai_likely`).
3. **`scope.design="ai"` requires a G hit** — never inferred from the host.
   text/images remain `unknown` without per-asset evidence.
4. **"Powered by <model>" is not generation evidence** — the page uses the
   model, it isn't generated by it. Model names stay null without a
   generation record.

### detector-eval.mjs refactor

- `HOST_RULES` emits `{tool, kind: prov|toolpage}` — no verdict attached.
- `probeHTML` tiers re-tagged `G | G- | P | H`; wordpress/squarespace moved
  to P (pipeline), SlidesGo template signature stays H (human content
  evidence).
- `classify()` order: G => ai_confirmed; G- => ai_likely; H => human_likely;
  provenance/P only => uncertain+null. `provenance` field can be set while
  `aiGenerated=null` (markup provenance recorded as `certainty:likely`).

### Contract test (9/9)

Assertions now encode the contract, not implementation guesses:
`aiGenerated=true` REQUIRES a `G:` evidence line; `false` requires `H:`;
tri-state always. Cases: gamma-hosted page => uncertain+null+prov gamma;
framer => uncertain+null+prov framer; hand-written React SPA => null;
websim artifact with `__websim` globals => ai_confirmed; bare URL /
pitch.com / vercel.app / "Powered by GPT-4" page => all null.

### Corpus re-score (held-out test, n=4,201)

- ai-labeled 2,272: generation-evidence 1,719 (75.7%), provenance-only
  552, human-verdict 1. The 75.7% measures self-marker coverage, NOT the
  share of hosted artifacts that are AI-generated.
- human-labeled 113: ai-verdict 0 (0% FP); all 113 uncertain — designer
  markup no longer pretends to confirm human authorship either.
- provenance identification: toolGuess matched source dir 2,477/3,836
  (rest are generic hosts / marketing chrome with no provenance).
- per-dir: websim 295 confirmed vs 277 uncertain (project shells w/o
  artifact globals = host only, correctly abstains); gamma dir 104
  uncertain (no generated-vs-imported marker exists); slidebean toolpages
  identify as webflow (their marketing IS webflow-built — pipeline
  attribution is correct even when the dir label differs).
- no-host mode identical 75.7% — confirmed items carry in-artifact markers.

### Residual limits

- Gamma/imported-doc distinction has no known in-artifact marker: a
  human-authored deck published on gamma.site is indistinguishable from a
  generated one without an external generation record. Reported as
  `uncertain` — honest, at the cost of coverage.
- Platform-semantic surfaces (websim/lovable artifacts exist only via
  their generator) are strong circumstantial evidence, but we still require
  the in-artifact marker rather than trusting the domain alone.
