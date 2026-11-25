# Shop application QA - 24 November 2026

All checks use disposable synthetic fixtures under the operating-system temporary directory. No Work1 orders, photographs, approval records or production databases are opened or changed by the HTTP/browser fixture. Pure Work1 crop-function regression tests do not access its dataset.

## Reproduce

```powershell
$env:TEST_TRANSPORT='http'
node --test --test-reporter=tap tests/*.test.js
node scripts/shop-browser-check.js
```

The harness selects a free loopback port and sets `BASE_URL` to that exact origin before loading the server. It creates temporary users, immutable templates, synthetic images and orders, and runs the real background worker. No application response is replaced with a successful fixture response. The browser deliberately aborts one upload to exercise recovery; all other requests use native HTTP.

## Completed results

- Native Node loopback HTTP now works. This supersedes the 20 November environment's loopback restriction for this host/session.
- Standalone native HTTP integration: 19/19 tests passed; 15.02 seconds inside the suite and 20.19 seconds including process startup/cleanup.
- Final regression: **71/71 tests passed**, zero skipped or failed, in 25.43 seconds. Log: `artifacts/shop-qa/regression.tap`. This includes real HTTP integration, QR encoder/independent decoder and endpoint security, PWA privacy/lifecycle units, immutable approval/artwork checks, rendering, packing, worker recovery, backups, retention, and a fresh-database Jyothi model proof.
- Final native browser journey: **21/21 checks passed** using Chrome **158.0.8127.88**, with zero unhandled page errors and zero external application requests. Report: `artifacts/shop-qa/browser-report.json`.
- The browser's download manager delivered `artifacts/shop-qa/browser-approved-order.pdf` successfully. It is a real one-page PDF from the two approved fixture entries. Every page was parsed and measured as **297 x 420 mm**, within 0.001 mm. This is explicitly an uncalibrated diagnostic PDF; no production release or printer calibration was falsely asserted.

## What the browser exercised

| Area | Observed result |
|---|---|
| New order | Opens directly at photograph/name entry; private fragment exchanged and removed |
| Photo/name | Photo first offers a suggestion without accepting it; name first survives photo selection; generic camera names are not suggested |
| Persistence | Unsaved image Blob, Malayalam name and crop survived pagehide, reload and a real offline reload |
| Recovery | Aborted upload remained an unsaved recoverable draft; reload and retry saved once; Save and add next cleared all entry fields |
| Mapping | Every original file matched its SHA-256 and recipient ID in the database; sorting retained the same name/photo pairs |
| Layout | 360, 390 and 768 px had no horizontal overflow; principal photo/save targets were at least 48 px high |
| Proof/approval | Worker rendered both proofs, customer reviewed them, organiser approved the exact revision |
| Staff | Authenticated QR endpoint rejected organiser/anonymous/foreign-host/revoked requests; sharing dialog loaded its local SVG |
| PDF | Staff queued the actual job and downloaded its completed A3 PDF through the browser |
| PWA | Secure-context registration, token-free manifest, static-only precache and offline shell worked |
| Updates | A real waiting worker was installed using the server's `/sw.js?qa-update=1`; clicking Update app persisted the unsynced draft before reload |
| Re-entry | Blank `/` accepted an explicitly supplied order A link; from `/o`, a second order B link changed the authenticated order and removed the fragment |

The service-worker update probe intentionally changes only the script URL while serving the real worker bytes. It does not alter application source or return a mock script. Startup can offer a second update when it registers the canonical `/sw.js` again; that is specific to this probe.

The native run found a stale offline warning retained after reconnection. The frontend now clears only that exact offline warning after successful online load or the online event, while retaining the unsaved draft and other errors. The final rerun asserts the warning is absent and the draft still does not claim server success.

The required-field integration fixture now loads its template from the authenticated staff endpoint, because the public template response correctly removes private asset paths. It explicitly checks this redaction before publishing its test version.

## Evidence

- `artifacts/shop-qa/browser-report.json`: machine-readable browser checks, environment, PWA cache paths and native download details.
- `artifacts/shop-qa/regression.tap`: complete final test output.
- `artifacts/shop-qa/customer-entry-360.png`, `customer-entry-390.png`, `customer-entry-768.png`: responsive entry screenshots.
- `artifacts/shop-qa/customer-offline-390.png`, `customer-approved-390.png`, `customer-malayalam-390.png`: recovery, approval and Malayalam UI screenshots.
- `artifacts/shop-qa/staff-production-1440.png`: staff job/download interface.
- `artifacts/shop-qa/browser-approved-order.pdf` and `browser-approved-order-page1.png`: downloaded diagnostic PDF and an independently rasterized page for visual review. The Malayalam name is shaped and visible in both the browser and generated print artwork.

## Browser verification boundaries

`scripts/shop-browser-check.js` uses Chromium touch/mobile emulation at 390 px and checks layouts at 360, 390 and 768 px, plus a 1440 px staff view. This is not a physical Android/iPhone test. Loopback HTTP is a browser secure-context exception; a phone using an ordinary shop LAN HTTP address does not inherit that exception. Real public HTTPS and real-device installation remain separate deployment checks.

WebKit was not installed and was not tested. Native installation prompts, standalone Android/iOS launch, camera/gallery selection, WhatsApp sharing, real phone memory pressure and actual camera scanning of the QR remain device checks. QR payloads were independently decoded by the regression suite; this does not replace a camera test.

Physical printer calibration, cut fit, colour/media matching, Malayalam-reader sign-off and real customer usability cannot be certified by these software tests. Print the calibration sheet at Actual Size, measure its 100 mm ruler and each model's cut dimensions, then record the measured printer/template calibration before production release.
