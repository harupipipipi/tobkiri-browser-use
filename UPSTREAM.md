# Source baseline

This work continues [Tobkiri Browser Use PR #1](https://github.com/harupipipipi/tobkiri-browser-use/pull/1),
whose baseline was `fbc67807a57b54d88a28925dcc4091d21c48981d`
(`feat/brand-icon-visible-cursor`). Existing repository files remain in place.

Changes add explicit DOM input, bounded network capture/rules, exact-tab guards,
cursor-pack loading, and standalone installed-extension acceptance tests.
The MCP exposes its own `browser_*` interface and does not start Computer Use.

The presentation renderer is a versioned source snapshot of Cursor Studio;
see [SOURCE.md](extension/vendor/cursor-studio/SOURCE.md). It builds locally,
without a neighboring checkout or runtime dependency. The optional JSON pack
contains presentation data only. Computer and Browser remain separate products.

Historical validation is retained with its original host/date scope in
[docs/VALIDATION.md](docs/VALIDATION.md). Current standalone results are recorded
separately. Generated images, reports, credentials and profiles are not committed.
