# Verification report — Trichur Trophies Personalise & Print

## Shop counter release

See [the shop test report](docs/SHOP_QA.md) for the current results. The new native HTTP run passed 71 regression tests and 21 browser checks. Chrome downloaded and reopened the generated one-page 297 × 420 mm PDF. The browser restored a draft offline, applied a service worker update and switched between two private order links.

`node scripts/check-counter.js` also passed from a freshly extracted source archive using the dependencies already installed on this PC. A staff member created an order through the form. An independent decoder read the QR from the actual dialog pixels. A second browser opened that order, submitted a photograph and name, and confirmed the saved pairing after reload.

The Windows launcher passed its checks on the shop network adapter. A separate self-request to the Wi-Fi address from this managed environment timed out. Reachability from a real customer phone, public HTTPS deployment and physical printer calibration still need shop testing. Historical transport limits in the original report below are retained for context.

For the real Work 1 sample, outputs 001–017 were compared with their source photos and filename labels. The remaining 83 designs and the complete 100-page review PDF have not been generated. The managed shell's pre-start telemetry triggered an automatic approval rejection. The operator can resume from the original Windows project folder using `Build-Work1.cmd`. See [Work 1 local test](docs/WORK1_LOCAL_TEST.md).

## Initial build verification

Date: 20 November 2026. Tests use synthetic identities and images. Original reference portraits and personal text are excluded from application fixtures and the source package.

The application implements real persistent customer/staff workflows. It is suitable for software evaluation; this report does **not** certify physical printing, real-phone usability, production deployment or full conformance to the preferred PostgreSQL/Next.js architecture. See `docs/SPEC_COVERAGE.md` for deliberate deviations and supported boundaries.

## Final regression run

```powershell
$env:TEST_TRANSPORT='direct'
node --test tests/*.test.js
```

**50 tests passed, 0 failed, 0 skipped; 18.57 seconds.** Full runner output is `artifacts/final-test-output.txt`. Node's count includes the enclosing integration test as reported by its test runner.

| Area | Evidence |
| --- | --- |
| API/security/approval integration | Real server handler, SQLite, decoded uploads, separate worker, canonical proofs and A3 export. Authentication, CSRF, cross-order access, helper scope/revocation, optimistic revisions, retries, stale proof completion, immutable approval and superseded exports tested. |
| Worker | Durable leases/recovery, cancellation/retry/fairness, no duplicate publication, exact component/copy expansion, selected reprints, changed canonical image and changed approval-snapshot refusal, calibration enforcement and process-lock safety. |
| Renderer/packing | Exact A3, deterministic coverage/non-overlap/gaps, allowed rotation, oversized failure, licensed/missing fonts, text overflow, EXIF/crop consistency, source/font hash integrity, polygon masks, supported field scopes and explicit supplied bleed. |
| Backup/restore | Coordinated stopped-instance DB/files backup, hash verification, clean-instance restore, historical path remapping, live-process refusal, corrupt-byte and path-traversal refusal. |
| Retention | Dry-run default; active/recent/in-flight orders preserved. Explicit archive plus retention required before deletion; archived approvals retained until policy permits deletion. |

Additional `node scripts/check-boundaries.js` checks passed: authenticated decoded template thumbnails, anonymous denial, invalid duplicate-field publication refusal, actionable low-storage refusal without losing the saved entry, and all **23 original reference SHA-256 hashes unchanged**. Evidence: `artifacts/boundary-checks.json`.

## Browser journey and layouts

```powershell
node scripts/browser-check.js
```

**14 browser checks passed**, zero unhandled page errors, Chromium **157.0.8103.79**. Actual shipped HTML/CSS/JavaScript and IndexedDB were used. Evidence is `artifacts/qa-browser/browser-report.json` and `docs/QA_FINDINGS.md`.

The journey covered photo-first and name-first entry, descriptive/generic filename behavior, name/photo/crop recovery through reload and an app-switch event simulation, a failed upload and successful retry, fresh next-entry clearing, stable sorting, current canonical proof generation, readable individual review, organiser approval and staff A3 export. Layouts at **360, 390 and 768 px**, including crop controls, passed horizontal-overflow checks. The staff production screen was inspected at **1440 px**.

The browser-created PDF was retrieved through the authenticated artifact route and independently rasterized using PDF.js. It contains one **297 × 420 mm** A3 page and the expected two approved pieces. The native download click emitted a download event, but this host cancelled the download manager's save operation. Authenticated browser retrieval returned the complete PDF bytes. **Native browser downloading remains a deployment check.**

Additional targeted frontend checks passed for group wording/quantity edits, numeric template geometry and validated asset upload, printer and template calibration forms using explicitly synthetic measurements, archive/revocation controls, group-specific wording in customer review/approval, offline IndexedDB recovery/reconnection, and truthful messaging when IndexedDB throws `QuotaExceededError`. These do not constitute real physical calibration or native-device testing.

## Transport and environment limitations

This execution sandbox denied Node loopback TCP (`EACCES`) and Chromium localhost networking (`ERR_NETWORK_ACCESS_DENIED`). The integration harness's explicit `TEST_TRANSPORT=direct` mode calls the actual request handler with Node request/response streams. Browser requests are routed into that same handler. Business responses are **not** mocked: real sessions, CSRF, SQLite transactions, Sharp decoding, private files, worker processes, Chromium render assets and PDFs run. One upload request is deliberately aborted to test recovery.

This transport substitution does not prove OS networking, native cookie transport, reverse-proxy configuration, HTTPS or native downloads. HTTP remains the integration harness's default on an unrestricted host. Repeat the integration test without `TEST_TRANSPORT=direct` there.

The versioned service worker caches only static app-shell assets; private API/media/proofs are excluded. Offline draft recovery was tested with API requests failing, but real secure-origin service-worker installation/update remains unverified. WebKit was not installed. Android/iPhone hardware, keyboard behavior and actual app switching were not tested.

## Actual approved-order artifacts

```powershell
node --env-file-if-exists=.env scripts/sample.js
node scripts/check-render.js
```

The sample command saved a recipient, attached a validated synthetic photograph, queued a real proof, reviewed that revision, stored an immutable approval and exported its exact canonical artwork through the worker. It did not forge an approval or mark a model physically calibrated.

| File | Meaning |
| --- | --- |
| `artifacts/sample-approved-order-A3.pdf` | Actual approved synthetic order, two copies at intended dimensions, diagnostic/unverified physical calibration. |
| `artifacts/sample-individual-artwork.png` | The lossless canonical proof artwork embedded in that PDF. |
| `artifacts/sample-placement-manifest.json` | Exact recipient/component/copy/page/position/dimension/rotation and artwork hashes. |
| `artifacts/sample-approved-artworks.zip` | Approved PNGs, high-quality JPEG derivatives and manifest. |
| `artifacts/sample-evidence.json` | Real persisted approval/proof/print-job IDs and snapshot/artwork hashes. |
| `artifacts/calibration.pdf` | Exact A3 with 100 mm rulers and 50 mm reference shapes; no physical calibration claim. |
| `samples/render-check/sample-A3-artwork.pdf` | Three-family, six-piece rendering/imposition check, exact A3. |
| `samples/render-check/malayalam-corpus.png` | Actual shaped Malayalam conjunct/chillu/vowel/mixed-script/curved-text feasibility image. |

The current sample uses immutable version 2 templates with pinned prepared-asset and font hashes. The renderer is `tt-canonical-3`, with OFL Noto Sans Malayalam and licensed Liberation Sans. Malayalam visuals and rasterized PDFs were inspected; a fluent Malayalam reader must still sign off. Editable curved Malayalam is deliberately disabled for production until that quality gate passes. Staff-approved fixed heading artwork is supported and is not described as editable text.

The first-generation 479 layout is synthetic. 727 A and H GLASS use inspected empty source frames with new field placement. The proposed 727 front/base association is a staff verification item. Reference canvas dimensions and blank CMYK sheet metadata do not establish physical cut sizes or a printer ICC profile. Output is explicitly sRGB, not CMYK/PDF-X certified.

## Stress and resource measurements

The initial 500-recipient run was interrupted by a workspace disconnect. Its saved partial work was recovered, then that historical run was deliberately replaced because the newer renderer correctly rejects a supplied shared event when a template has no event box. Interrupted/stopped reports are retained and are **not** counted as passes.

The fresh run uses 500 synthetic recipients, ten 1200 × 1600 graphic portrait fixtures reused through distinct recipient assets, mixed one/two/three-copy quantities, and paired front/base components. It forces a worker interruption and restart and checks every approved component/copy, page bounds, gaps, non-overlap, exact A3 and canonical hashes. These fixtures compress to roughly 52–63 KB and are less complex than typical camera photos; the results are not a real-phone throughput guarantee. Memory sampling covers the Node worker, not Chromium or whole-machine usage.

**Fresh full run passed.** Evidence: `artifacts/stress-500-1795171786367.json`.

| Measured result | Value |
| --- | --- |
| Recipient proofs after forced worker restart | 500, exactly one current proof each |
| Copies / printed components | 999 copies / 1,998 front-base pieces |
| A3 pages | 58, each exactly 297 × 420 mm |
| Render time | 563.07 seconds |
| Baseline export / total run | 49.16 / 617.44 seconds |
| Baseline PDF size | 34,949,936 bytes |
| Baseline sampled peak Node RSS | 1,401,393,152 bytes, Chromium excluded |

The final exporter embeds each decoded PNG immediately to release its raw pixel buffers. A second export of the **same immutable 500-recipient approval**, without rerendering or changing artwork, also passed all 1,998-piece coverage, hash, bounds, gap, non-overlap and A3 checks: **51.00 seconds**, **34,949,933 bytes**, sampled peak Node RSS **289,284,096 bytes (about 276 MiB)**. Evidence: `artifacts/export-benchmark-500-1795172498443.json`. Renderer tests (11) and worker tests (14) passed again after this targeted memory change. Remaining compressed PDF data necessarily grows with export size; no claim of constant memory or whole-machine peak is made.

Earlier verified smoke evidence includes 12 recipients / 48 pieces / 2 A3 pages in 24.70 seconds, plus actual small PNG/JPEG ZIP generation. Independent worker race checks passed for duplicate reviewed-proof preservation, edits during an in-flight proof and cancellation during actual rendering (`artifacts/worker-races.json`). Canonical default artwork hashes are byte-identical between renderer versions 2 and 3; version 3 adds separately tested masks/fonts/strict validation without altering those default rendered pieces (`artifacts/renderer-v2-v3-equivalence.json`).

## Real backup recovery

The actual approved-order database and private files were backed up (464 files, 28,949,526 bytes) and restored to a clean directory. `scripts/verify-restored-instance.js --in-process` verified the unchanged approval snapshot hash and authenticated source-photo, canonical-proof, PDF and manifest routes. Every returned byte matched its hash. Actual read-stream paths were observed inside the restored data directory, so success did not depend on the old files still existing. Unauthenticated export returned **403**. PDF dimensions remained exact A3. Evidence: `artifacts/restore-verification.json`.

## Installation and physical acceptance still required

- Clean dependency installation and production Docker/Compose build/start: not executed because Docker/PostgreSQL were absent and package-registry DNS/offline metadata were unavailable. The supplied stack is native Node/JavaScript/SQLite, not the master specification's preferred Next.js/PostgreSQL stack.
- HTTPS/LAN access, real browser cookies/downloads, WebKit and service-worker updates: verify on the deployment host.
- Malayalam reader, actual Android/iPhone and first-time-customer trial: follow `docs/STAFF_PILOT_CHECKLIST.md`.
- Actual Size printing, both-axis ruler measurements, each component's cut fit, paper/media colour and paired assembly: operator checks, not software-generated successes. Measure calibration marks at stroke centres.
- Automatic splitting of a mixed-media approval into different profile PDFs is not provided. Incompatible media fails clearly; deliberately use separate compatible groups/orders/exports. Irregular nesting/cutter control remains outside scope.

Do not describe the installation as production-ready without successful deployment, real-customer and printer trials. Diagnostic PDFs cannot be released through the production controls.
