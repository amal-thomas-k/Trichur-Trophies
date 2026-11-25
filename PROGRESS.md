# Trichur Trophies — implementation progress

## GitHub hosting handoff

- The owner's and technician's deployment guide is `docs/HOSTING_HANDOFF.md`. It covers a separate HTTPS subdomain on suitable existing hosting, setup on the designer-room Wi-Fi, testing with an actual phone and printer, and restoring a backup.
- Repository handoff uses the vetted application source, prepared model assets, font licenses, tests and synthetic sample outputs. Keep private shop databases, raw photographs, private links, backups, credentials and original PSD files on the shop PC. The source can start with a fresh database on either host.

## Shop counter release

- Added per-order staff QR sharing, local encoding and independent QR decoding tests. Token exchange, revocation and server-side approval gates remain active.
- Added a clean-shop Jyothi carving template with its fixed arch and campus background. Verified creation from a new database and a genuine 2953 × 2953 Malayalam recipient proof.
- Windows LAN launcher, installable HTTPS web app, simplified model-aware customer UI, runbook and authenticated QR share implemented. 71/71 regression tests and 21/21 native HTTP browser checks passed. Independently decoded the QR from staff screen pixels and saved a customer entry from a separate browser. Repeated this counter flow from an extracted source ZIP.
- Launcher binding passed; managed-host request back to its private LAN address timed out. Real phone Wi-Fi, HTTPS/Docker deployment and physical fit are open operator checks.
- Work 1 recovery: 17 of the 100 designs have actual PNG/JPEG outputs. Entries 001–017 were visually compared with their input photos and filename labels. Entry 014 has a visibly soft 160 × 191 px input. Entries 018–100, the complete manifests and the 100-page review PDF remain pending. See `Work1-Output/qa-visual/REVIEW.md`.
- Automatic approval review rejected the full batch because the managed PowerShell host attempted external telemetry before its first script statement. The shop PC can resume with `Build-Work1.cmd`; the batch launcher sets telemetry opt-outs before starting PowerShell and runs its offline guard checks before touching the orders. The launcher and full offline run still need execution on the operator's PC. Customer approvals are never fabricated by the import.

Updated: 2026-11-20. The master specification was read in full from its saved original (27,660 bytes). Original `Design Templates/` files are preserved.

## Plan and ownership
1. Inspect PSDs/exported frames, inventory dimensions and fonts; establish immutable template definitions.
2. Complete one persistent customer entry, validated upload, authoritative Malayalam proof, review/approval, and physically sized A3 PDF.
3. Complete bilingual drafts/recovery, mixed groups, scoped helpers, versioning, jobs, manifests, staff operations.
4. Verify real journeys, security and print invariants; run 500-recipient stress/restart and backup restore; document deployment and physical checks.

## Environment decisions
- Available: Node 24.22.3, Sharp, Playwright, pdf-lib, JSZip, Chrome, Windows Nirmala font.
- Unavailable: Docker, PostgreSQL, npm command and package registry DNS access. Native Node HTTP + ES-module frontend + SQLite WAL and a separate durable worker provide the runnable implementation here. This is an explicit deviation from the recommended Next.js/PostgreSQL stack, not a claim of PostgreSQL compatibility.
- No real reference identities will be published as demonstration data. Use audited empty frames and synthetic identities/photos.
- Source canvas DPI is not a physical calibration. Production release will require operator calibration; generated diagnostic samples will be labelled accordingly.

## Current work
- [x] Read complete master specification.
- [x] Enumerate original reference files.
- [x] Asset audit and three template families; original hashes preserved. 727 front/base association remains a staff check.
- [x] Database, sessions, scoped links and revision-safe API implemented and checked by the final integration suite.
- [x] Customer/staff frontend and recoverable IndexedDB drafts implemented and checked through the actual browser journey.
- [x] Canonical renderer, bundled licensed Malayalam/Latin fonts, Malayalam feasibility image, calibration PDF and A3 packing.
- [x] Durable jobs, approval snapshots, production lifecycle and selected reprints implemented and tested.
- [x] Integration/browser/security tests: 50-test regression passed; 14 Chromium journey checks passed. Direct real-handler transport used because sockets are restricted; native networking/download checks remain.
- [x] Full 500-recipient stress with forced restart: 500 proofs, 999 copies, 1,998 pieces, 58 exact A3 pages; no missing/duplicate pieces. 617.44 seconds total on synthetic workload. Final optimized export alone: 51.00 seconds, sampled Node peak RSS 289,284,096 bytes; Chromium excluded.
- [x] Backups and clean-instance restore, including authorized byte-identical photo/proof/PDF/manifest reads from the restored directory.
- [x] Runnable setup, source migrations, locked dependencies and operator documentation. Container installation remains unverified on this host.
- [x] Numeric template setup/uploads, polygon masks, bundled font selection, SHA-pinned prepared artwork/fonts, thumbnails, shared group wording, profile calibration, archive/retention and static-only service worker implemented.
- [x] Final source archive staged; every included file's SHA-256 was verified after ZIP decompression. `SOURCE_MANIFEST.json` records the complete allowlisted payload. Originals, live data, backups, secrets and private reference inspection material are excluded.

## Historical checkpoints (final completion status is above)
- Workspace reconnected. Saved source and data recovered; the interrupted 500-recipient dataset contained 313 completed proofs. A fresh full run with the final strict shared-field rules is now running; the historical interrupted run is not counted as a pass.
- API integration: 16 checks passed using the real handler, SQLite, Sharp, separate worker, Chromium and PDF pipeline; loopback transport is substituted because the execution sandbox denies sockets.
- Browser journey: 14 checks passed against that same real backend through Playwright routing. Customer photo/name entry, draft/photo/crop reload, failure/retry, sorting, proof review, approval and staff export ran. 360/390/768 px overflow was found and fixed. Fresh final regression is pending completion of remaining controls.
- Restored approved-order verification passed: source photo, canonical proof, PDF and manifest returned exact bytes through authenticated routes; unauthenticated export denied; approval hash unchanged.
- Offline retention: 3 tests passed. Only deliberately archived orders past the configured period and without pending jobs or recent activity qualify; default command is a dry-run.
- `node scripts/sample.js`: real persisted synthetic order approved and exported. Artifacts include `artifacts/sample-approved-order-A3.pdf`, canonical PNG, manifest, ZIP and exact-A3 calibration PDF. Diagnostic output is not physically calibrated and cannot be released as production.
- Renderer/packing tests: 8 passed after moving the hash-mismatch fixture inside private storage. No downscaling, exact A3, rotation policy, gaps, missing fonts and changed-artwork refusal tested.
- Worker tests: 11 passed, including restart leases, fairness, cancellation, exact copy/pair expansion, superseded exports and deliberate selected-piece reprint.
- Real 12-recipient/48-piece smoke with forced worker restart passed in 24.70 s. Full 500-recipient run in progress; metrics pending.
- Backup unit checks: 3 passed; actual approved-order clean-instance restore is underway.
- Shell localhost HTTP connections fail with EACCES in this sandbox. Browser transport and in-process real-handler integration are being investigated; no HTTP transport pass is claimed yet.
- Version 2 seed templates add event/date/logo geometry. Existing version 1 templates/approvals remain immutable.

## Pending physical checks
Malayalam-reader inspection (including curved headings), real Android/iPhone usability, printer Actual Size ruler measurement, media/colour tests and physical fit to each trophy. None is considered passed by software testing.

## Final acceptance boundaries
- No known failing executed software tests. See `TEST_REPORT.md` and the section-by-section `docs/SPEC_COVERAGE.md` for exact evidence and limitations.
- Native JavaScript/Node/SQLite remains an explicit deviation from preferred Next.js/PostgreSQL architecture; no PostgreSQL compatibility is claimed.
- Fresh dependency installation, container build, public TLS, phone-to-PC Wi-Fi, and physical Android/iPhone checks remain open. The current native Chrome run verified service-worker lifecycle and browser PDF download on loopback.
- Editable curved Malayalam remains disabled pending language-reader quality approval. Fixed heading assets are supported; empty shared headings are preserved rather than replaced.
- Mixed incompatible media are rejected; automatic multi-profile splitting is not implemented. Use separate compatible groups/orders/exports deliberately.
- Never mark diagnostic samples or synthetic test calibration records as physical production verification.

## Work 1 local sample — 21 November 2026
- Found exactly 100 source photographs in Work 1/Leonardo DiCaprio; originals remain untouched.
- Prepared source-derived CARVING KANNADI R BIG border and verified its opaque blue pixels against the Photoshop export; source canvas 2953 px square at 300 DPI (250.020667 mm).
- Implemented local fixed English arched heading + campus composition, filename labels and persistent batch import through the real application domain/worker.
- First proof inspected. The interrupted local batch uses isolated data/work1 and outputs Work1-Output. See the shop counter section above for the verified count and resume procedure.
- Added Start-Work1.cmd and isolated launcher; dependencies/port availability checked. The subsequent native HTTP/browser journey and current print/hosting checks are documented in docs/SHOP_QA.md.

