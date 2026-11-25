# Master specification coverage

Updated 2026-11-20. This checklist distinguishes code that exists, evidence that passed, and requirements still awaiting implementation or physical acceptance. It is not a claim that every phase is complete. `TEST_REPORT.md` is authoritative for the final test run and counts; `PROGRESS.md` records the current checkpoint.

Status meanings: **Implemented** = a real code path exists; **Partial** = useful functionality exists with the listed boundary; **Unverified** = the required environment or human check has not run; **Deviation** = a different implementation was deliberately delivered; **Deferred** = outside the master specification's current scope.

## Business and architecture (sections 1–2)

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| Mobile web entry from Gallery/Files and ordinary paste; no customer account | Implemented | Private order link, photo/name form and scoped session. No WhatsApp scraping, background clipboard access or guessed identity matching. |
| No paid API for core workflow | Implemented | Local backend, database, worker, fonts, artwork and exports. No AI key/email/WhatsApp subscription needed. |
| Next.js / React / TypeScript, PostgreSQL / typed ORM and pg-boss default | **Deviation** | Native JavaScript ES-module UI, Node HTTP, SQLite WAL and a separate durable database worker. Package registry DNS, PostgreSQL and Docker were unavailable in the implementation host. PostgreSQL compatibility is not claimed. |
| Private persistent filesystem | Implemented | `DATA_DIR`; authorized file routes; source/prepared masters are separate from original customer references. |
| Separate durable render/export worker | Implemented | Transactional job claims, leases, retries, progress, cancellation, restart recovery, timeout and fairness. Single worker concurrency is bounded at one. |
| Pinned dependencies / lockfile | Partial | Exact installed versions plus original integrity metadata for 55 package snapshots. Clean registry installation was blocked by missing offline metadata/network; validate on deployment host. |
| Pinned Chromium | Partial | Version-matched Playwright browser in documented installation/Docker. This host used recorded installed Chrome 157.0.8103.79 because Playwright browser installation was unavailable. Every proof records renderer metadata. |
| Docker Compose / HTTPS | Unverified | Configurations are supplied, including persistent volume and Caddy. No Docker runtime was available here. |

## Original references and templates (section 3)

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| Inspect original files before preparing templates; preserve originals | Implemented | 23 originals inventoried, hashes recorded, PSD layers/DPI/fonts audited. See `REFERENCE_AUDIT.md`. |
| Three available model families | Implemented | 479 C synthetic layout; blank source-derived 727 A front/base and H GLASS frames. No claim of faithful original PSD typography/effects. |
| Remove old recipient/photo by layers | Implemented for prepared candidates | Clean layer-derived 479 candidates omit original recipient/type/photo layers. Blank source frames were visually inspected. Private original inspection outputs are excluded from deployment/source archives. |
| Immutable template versions | Implemented | Published definitions are insert-only; order groups bind a version. Seed v2 adds event/date/logo geometry without rewriting v1 approvals. |
| Staff asset upload and numeric setup | Implemented | Clean raster background/foreground upload, per-component geometry and advanced JSON; server bounds/asset validation. |
| Editable-field schema, defaults and custom fields | Implemented supported schema | Recipient name/achievement and shared heading/event/date/logo are supported. Key/scope/required/defaultText/grapheme maxLength rules are enforced; unsupported keys and omitted nonempty content without geometry fail clearly. Arbitrary additional field types are outside the supported schema. |
| Per-template/field fonts / exact PSD font matching | Implemented bundled selection; original matching unverified | Licensed Noto Sans Malayalam/Liberation Sans selectable at template/component/text-box level. Unknown fonts and Latin-only selection for Malayalam fail. Original missing fonts, legacy encoding and effects require staff preparation; arbitrary external font editing is not supplied. |
| Masks, trim paths, safe zone and bleed | Implemented supported geometry | Numeric geometry/safe zones, circle/rect/rounded clipping, bounded non-self-intersecting polygon photo/trim masks and explicit supplied full-bleed background/mask. Raw SVG/URL paths, inferred border cuts, curved spline editing and machine cutter output are not supported. Physical cuts remain unverified. |
| Template thumbnails | Implemented | Authenticated generated template previews identify immutable model/version geometry; anonymous access is denied. Endpoint decoding and authorization passed `scripts/check-boundaries.js`. |
| Physical dimensions/cut fit | **Unverified** | Source canvas/DPI verified, but no trophy or printer was physically measured. All seeds begin uncalibrated. |

## Access, orders and customer intake (sections 4–6)

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| Admin and production staff roles | Implemented | Server authorization, salted scrypt passwords and first-run admin command; no fixed shipped production password. |
| High-entropy revocable expiring private link | Implemented | 32 random bytes, hashed token storage, fragment exchange, scope checks and revocation. QR rendering is not supplied; ordinary private links are the supported entry method. |
| Organiser/helper scopes | Implemented | Organiser controls shared content/approval; helpers contribute only within their assigned group and their own recipients. Cross-order media remains protected. |
| Mixed groups, expected quantities, copies, front/base | Implemented | Separate group/template assignments and independent recipient/copy/component counts. |
| Common wording/logo and group overrides | Implemented | Shared content and group overrides are rendered and approval-bound. Changes invalidate affected proofs/reviews and final approval. |
| Simple bilingual form / large touch targets | Implemented, human usability unverified | English/Malayalam primary customer controls, one-column entry, large controls and live photo/name pairing. Some staff/error/help strings remain English. Native-reader review is still required. |
| Fresh stable entry after Save and add next | Implemented | New ID and cleared fields/photo/crop; idempotent saves prevent duplicate records. |
| Recoverable drafts and pending photo | Implemented | IndexedDB stores draft text, photo Blob, crop, stable recipient ID and position. Phone storage can be unavailable or evicted; it is not permanent offline backup. |
| Saved locally vs uploading vs saved to order | Implemented | Distinct states and retry/error messages. Final server status is not inferred merely from local persistence. |
| Search/filter/sort and incomplete entries | Implemented | Photo/name relationships stay on stable IDs. Incomplete entries remain visible and block full approval. |
| Filename suggestions / long pasted messages | Implemented | Extension removal only; generic camera/WhatsApp names rejected. Suggestions require a tap and remain editable. No automatic matching or spelling changes. |
| Multiple photos | Implemented | Separate unnamed draft cards and manual completion queue; uploads are bounded. Names are never matched from a separate list. |
| JPEG / PNG / WebP / EXIF / metadata privacy | Implemented | Server decodes bytes, rejects invalid/animated input, normalizes orientation, keeps private full-resolution sources and creates stripped derivatives/thumbnails with upload/pixel limits. |
| HEIC / HEIF | Implemented rejection path | Explicit conversion-to-JPEG/PNG message; no unverified promise of native HEIC decoding. Other draft work is retained. A real iPhone trial is pending. |
| Retry, stale responses and conflict handling | Implemented | Stable recipient/upload IDs and optimistic revisions. Late render results cannot attach to newer revisions; conflicting draft contents remain for comparison. |
| Duplicate warnings | Implemented | Name and normalized photo-hash warnings; no automatic merging/deleting. |

## Rendering, proof and approval (sections 7–8)

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| Crop move/zoom/rotation reproducible on server | Implemented | Orientation-normalized source, saved relative crop transform and 90-degree rotations; canonical proof is authoritative. |
| Malayalam shaping, chillus, conjuncts, vowel signs, mixed text | Implemented feasibility; human check pending | Bundled licensed font, font readiness check and curated corpus artifact. A Malayalam reader must approve visual quality. |
| Fit text without truncation / unreadable shrink | Implemented | Complete Unicode strings are shaped and measured; configured minimum font size is enforced. Overflow produces a field-specific error. |
| Editable curved Malayalam | **Explicitly unsupported for production** | SVG textPath feasibility image supplied. Until a Malayalam reader approves it, templates must use a staff-approved fixed heading asset; that is not editable text. |
| Canonical proof and PDF consistency | Implemented | Lossless high-resolution artwork hashes are approved; PDF embeds those bytes at recorded dimensions without rebuilding text. |
| Individual readable proof review and enlargement | Implemented | Each current proof is accessible before recording its current revision as reviewed. Full-order approval checks every current entry. |
| Immutable approval snapshot | Implemented | Fields, groups, copy/component mapping, source/crop/template references, canonical artwork hashes, actor/time and renderer metadata are stored. |
| Edits invalidate current approval | Implemented | Name/photo/crop/model/copies/shared/group changes require new checks. Old snapshots remain intact. Transactional checks block stale approval requests. |
| Production readiness gate | Implemented | Current complete proofs, reviews, approval and physical calibration records required for production export/release. Diagnostic output cannot be released as production. |

## Print and reliable jobs (sections 9–10)

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| Exactly A3, intended physical insert size, 300 DPI | Implemented | 297 × 420 mm or landscape equivalent, mm-to-point conversion, no downscaling-to-fit; raster sampling rounding does not change PDF physical dimensions. |
| Conservative deterministic packing | Implemented | Rectangle shelves, allowed rotation only, printer margins, bleed footprint/gap and non-overlap validation. Oversized pieces fail clearly. |
| Mixed media/profile handling | Partial | Incompatible media is rejected clearly. Automatic splitting of one mixed-media approval into several profile-specific exports is not delivered; use compatible groups/orders/profiles deliberately. |
| Front/base identification and placement manifest | Implemented | Recipient/model/component/copy, page, coordinates, size and rotation; labels stay out of customer artwork. |
| Calibration PDF | Implemented | Actual generated A3 rulers/reference shapes; physical printer/cutter checks remain unperformed. |
| Colour management | Implemented sRGB boundary | Explicit sRGB raster workflow. No CMYK/PDF-X/ICC matching claim. Real printer colour test required. |
| Individual high-quality artwork / ZIP | Implemented staff export | Approved canonical artwork and high-quality derivatives packaged through authorized staff export. Customer self-download of full production archives is not separately offered. |
| Worker restart / atomic publication / supersession | Implemented | Durable jobs, leases and complete artifact publication; queued exports retain approval IDs; obsolete outputs cannot be released as current. |
| Generation, release and physical printing distinct | Implemented | Separate print-job lifecycle and explicit operator confirmation; no printer-success simulation. |
| Selected reprints | Implemented | Exact recipient/component/copy selections checked and audited; no automatic whole-order reprint. |
| 500-recipient resource evidence | Implemented and verified | Fresh forced-restart run passed: 500 proofs, 999 copies, 1,998 pieces and 58 exact A3 pages. Final optimized export of the same immutable approval passed in 51.00 s with sampled Node peak RSS 289,284,096 bytes (Chromium excluded). See final report for fixture/timing boundaries and retained interrupted runs. |

## Security, hosting, backup and acceptance (sections 11–14)

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| Endpoint authorization / CSRF / scoped private files | Implemented | Real backend checks, same-origin mutation policy, expiring sessions, content validation and private file routes. Final test status is recorded separately. |
| Staff SVG sanitization / arbitrary fetch prevention | Implemented restrictive boundary | Staff artwork upload accepts decoded JPEG/PNG/WebP and rejects SVG. Renderer uses approved local assets; it does not fetch customer remote URLs. |
| HTTPS/LAN explanation / local-only dependencies | Implemented documentation | Reachable hostname, BASE_URL, actual HTTPS and persistent server required. A phone's localhost is not the shop PC. No CDN/font request is needed after installation. |
| Offline app shell / service-worker versioned cache | Implemented; secure-host lifecycle unverified | Static-only versioned service worker, secure-context registration, manual update prompt and IndexedDB cached order metadata. Routed Chromium tests confirmed draft photo/text recovery with all APIs offline, edits surviving reconnect/reload and shared overrides visible. API/media/proof responses are never cached by the worker; updates never clear IndexedDB. Actual service-worker installation/update/offline-navigation delivery still needs HTTPS/localhost network validation. No background-upload or permanent-storage guarantee. |
| Coordinated backups and restore | Implemented and verified | Offline checkpoint+database/files backup, manifest hashes, safe clean restore and historic-path map without rewriting approved snapshots. Actual restored photo/proof/PDF/manifest routes returned exact bytes through the server-handler harness; socket access was blocked. |
| Retention / storage health | Implemented | Owner archive/reopen, link revocation, offline retention with a 365-day configurable default, dry-run before explicit `--apply`, and no pending/recent work. Approvals and referenced files remain until the archived order meets the policy. See `BACKUP_RESTORE.md`. |
| Real HTTP deployment validation | **Unverified in restricted host** | Node and Chromium localhost socket access was denied. In-process handler tests are real backend tests but do not prove operating-system networking, browser cookie transport or reverse-proxy setup. |
| Chromium / WebKit and 360/390/768px | Chromium verified; WebKit unavailable | Chromium 157 UI tests used real backend-handler request routing, worker, cookies and IndexedDB. Widths 360/390/768 and desktop staff 1440 passed reported layout checks. WebKit is not installed; real phone checks remain unperformed. See `QA_FINDINGS.md` and final test report. |
| Real Android/iPhone, Malayalam reader, first-time customer and printer | **Unperformed** | `STAFF_PILOT_CHECKLIST.md` gives the required human checks. |
| Required source, setup, docs, tests and actual sample exports | Implemented; packaging at final checkpoint | Source archive excludes live data/secrets/original personal references. Samples are synthetic and generated by the actual approval/render/export pipeline. |

## Explicitly deferred by the master specification

CSV import, per-parent collection links, AI/OCR, WhatsApp API or chat scraping, Android share-target integration, native apps, payments, inventory integration, irregular nesting and multi-site synchronization are not part of this implementation. They must not appear as working controls.

## Outstanding acceptance gates

1. Executed software gates passed: final 50-test suite, 14 Chromium journey checks, 500-recipient stress/restart and 25 targeted renderer/worker checks after export-memory optimization. Retain the test reports and repeat the HTTP transport checks on the deployment host.
2. Validate a clean install, production containers and actual HTTPS/network access on the deployment host.
3. Complete the listed template-engine boundaries if strict full-master acceptance requires those general capabilities; do not represent declared metadata as supported behavior.
4. Have a Malayalam reader approve the straight-text corpus and fixed-heading strategy.
5. Measure the real printer at Actual Size, calibrate every component/profile and check physical cut fit/colour.
6. Run a small first-time-customer trial on actual Android and iPhone devices before wider production use.
