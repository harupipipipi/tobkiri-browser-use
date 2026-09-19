# Validation record — 0.2.0

## What was actually run

**Date:** 2026-09-19 Japan time (0.1.0 baseline). **Build/test platform:** Linux, Node.js 22.16.0, Chromium 144.0.7559.96, Xvfb for headed browser tests. The 0.2.0 additions passed the Node suite on the author's machine; installed-extension verification is noted below.

### 0.2.0 changes

`browser_eval` and `browser_cdp` were added at the owner's explicit request. `browser_eval` sends `Runtime.evaluate` with no `contextId`, so it runs in the page's MAIN world (DevTools-console equivalent). `browser_cdp` passes an arbitrary CDP method/params straight to the granted tab's debugger session. Both route through the unchanged guard stack (owner, revocation, pause, deadline, active-tab protection) and the bounded CDP acknowledgement timeout.

New Node tests cover: schema bounds for both tools (expression/method required, unknown fields rejected, free-form `params` object accepted), main-world dispatch (no isolated-world `contextId`), raw method/params passthrough, and enforcement of grants, cross-session isolation and active-tab protection.

**Installed-extension check on the author's Vivaldi 8.2 (Chromium 143) session, 2026-09-19:** a fresh `cli.mjs mcp` stdio client was driven end-to-end through the real bridge and the reloaded unpacked extension. Verified: both tools appear in `tools/list`; `browser_eval` returns `2` for `1+1`, the real `location.href`, and `done` for a resolved promise; a canvas-2d smiley drawn by eval on jspaint.app produced ~3,400 non-white pixels (visually confirmed); a thrown error maps to `PAGE_ERROR`; `browser_cdp` `Page.getFrameTree` returns the raw frame tree; ungranted tabs still reject with `NOT_GRANTED`. Note: `replMode` was removed because it silently disabled `awaitPromise` on this engine. The repeated `CDP_TIMEOUT` wedges seen with hidden-tab `Input`/`captureScreenshot` traffic on this Vivaldi build remain a host-level issue, unrelated to the new dispatch paths.

### 1. Node tests — 33 passing, 0 failing

`npm test` uses Node's built-in test runner and requires no npm install. The test-runner total includes a parent integration test and its subtests. See `test-results/node-tests.tap`.

The real local HTTP bridge and real stdio MCP implementation are exercised: schema/URL validation, auth, Origin/Host rejection, extension-vs-admin endpoint separation, offline errors, session routing, result delivery, cancellation on release, MCP initialization/version negotiation/listing/error handling, and screenshot pixel-dimension parsing.

The production `extension/background.mjs` is also imported and driven against **mock Chrome APIs** and the real bridge. Those checks cover new-tab consent, explicit inactive creation, group metadata, session/tab isolation, navigation dispatch, front-tab protection, global/workspace pause, CDP input dispatch, clipboard/shortcut rejection, DOM scroll dispatch, protection for ungranted human tabs added to a group, popup-sender checks, paused waits, cleanup/auto-discard restoration, group recreation, debugger revocation and session release.

**These are not tests of Chrome's actual extension APIs or the actual MV3 lifecycle.**

### 2. Real hidden-tab operation core — 12 passing, 0 failing

`tests/cdp_core.py` launches real headed Chromium under the existing managed policy. It uses allowed in-memory `about:blank` fixtures via CDP; it does not navigate to external websites or change the policy. It does **not** use Playwright's default focus emulation, and it does not turn off background throttling.

The test asserts that the human tab stays `visibilityState = visible`, the target stays `visibilityState = hidden`, and the human input element retains focus, including while foreground input and background input run concurrently.

The actual production `extension/page-ops.mjs` runs in a CDP isolated world. The following are checked: real hidden/visible distinction, DOM snapshot/redaction, concurrent text entry/clicking, trusted input events, hidden-tab screenshot, stale refs/open Shadow DOM, checkbox/select, clearing input with empty text, Enter/local form/wait predicate, offscreen element targeting/DOM scrolling, coordinate drag, and full-page screenshots.

See `test-results/cdp-core-report.json`, `background-tab.png` and `full-page.jpg`. The screenshots show fictional fixture data, not a real user's browser.

This verifies the **underlying tab-targeted CDP behavior**, not the `chrome.debugger` transport or the complete MCP→installed-extension path.

### 3. Installed-extension E2E — blocked by environment, not counted as passed

The environment's managed Chromium policy has `ExtensionInstallBlocklist: ["*"]`. The policy was inspected and **not modified or bypassed**. The test returns code 77 and writes `test-results/browser-e2e-report.json` explaining the block.

`tests/browser_e2e.py` is included for running against an extension-enabled local Chromium. It is intended to exercise actual popup pairing, stdio transport, native tab groups, foreground protection, trusted events, screenshot MCP responses, multiple sessions and revocation. Because that script could not run end-to-end here, its completeness and platform-specific behavior are themselves unverified.

### 4. Popup rendering preview

`docs/ui-preview.png` is a rendering of the actual popup HTML/CSS/JS with **simulated extension state**, using an in-memory browser document. It is for reviewing layout only, not evidence of extension installation or connectivity. Pairing secrets are not in the image.

## Issues discovered and addressed

A direct CDP `Input.dispatchMouseEvent` mouse-wheel request on a genuinely hidden tab did not acknowledge within the test timeout. It worked under more permissive test focus-emulation settings, which would have hidden the problem. The production scroll tool was therefore changed to instant DOM scrolling, without activating the target. All CDP operations now also have a bounded acknowledgement timeout that revokes the grant on an uncertain result.

Additional review addressed accidental collapse of a group containing an ungranted active human tab, stale group IDs after closing the last tab, auto-discard cleanup when returning a tab, same-extension-ID collisions across browser profiles, Retina image-to-CSS coordinate metadata, and verification of requested checkbox state.

## Unverified / not claimed

Actual extension installation and native popup/runtime behavior; managed-policy variations; service-worker suspend/restart over long real sessions; Chrome on macOS or Windows (0.2.0 was hand-verified on macOS Vivaldi only); Edge/Brave; production MCP clients such as Tobkiri; real websites beyond the single jspaint.app check above; external navigation and login flows; popups/native UI; full iframe handling; stress/load/security audit.

A successful local acceptance test in the user's chosen browser is still required. Start on a test page, not a financial account, checkout or irreversible action.
