# Offline QR dependencies

These source files are vendored so QR generation and its interoperability tests need no package download or third-party service at runtime.

| File | Source/version | Upstream Git blob | License |
| --- | --- | --- | --- |
| `qrcode-generator.mjs` | kazuhikoarase/qrcode-generator, `js/dist/qrcode.mjs`, package version 2.0.4 | `444522524987df3a4e37c2a5150dc5c8a052bd44` | MIT; `LICENSE-qrcode-generator.txt` |
| `../../tests/vendor/jsQR.cjs` | cozmo/jsQR, `dist/jsQR.js`, package version 1.4.0 | `99ea9df26907009e5553233ffe03c529c1521739` | Apache-2.0; `../../tests/vendor/LICENSE-jsQR.txt` |

Retrieved 24 November 2026 from each upstream repository through authenticated repository file reads. Source contents are unmodified; the test decoder has only a `.cjs` filename extension so Node loads its original CommonJS bundle. Tests verify upstream Git blob hashes.

The production wrapper `src/qr.js` uses QR Model 2 byte mode, automatic version selection, error correction M, four-module quiet borders and black-on-white numeric SVG paths. It normalizes HTTP(S) URLs, permits access credentials only in a base64url fragment, and never writes the URL/token into SVG titles or metadata. The QR image itself remains an access credential and must be returned only to authorized callers using private, no-store responses.

`jsQR` is a separate decoder implementation used only by tests. Tests rasterize SVG with Sharp and decode the pixels, including rotated, reduced and JPEG-compressed images. This is machine interoperability evidence, not a claim that a physical phone has scanned the code.

Upstream sources:

- https://github.com/kazuhikoarase/qrcode-generator/blob/master/js/dist/qrcode.mjs
- https://github.com/kazuhikoarase/qrcode-generator/blob/master/LICENSE
- https://github.com/cozmo/jsQR/blob/master/dist/jsQR.js
- https://github.com/cozmo/jsQR/blob/master/LICENSE
