# Trichur Trophies: Codex master build prompt

Copy the prompt below into Codex in a project workspace. Put the supplied PSD/JPEG/PNG references in `reference-assets/`. Alternatively, attach this file to Codex and ask it to read and execute the entire prompt. The prompt requests implementation; it is not a claim that the application already exists or has passed production tests.

---

You are the lead full-stack engineer, mobile UX designer, print-production engineer and QA engineer building a real application for Trichur Trophies, Kerala, India.

Build a complete, runnable, self-hostable application called **Trichur Trophies — Personalise & Print**. Implement and test it in this workspace. Deliver functioning customer, staff and print workflows, not only a design, scaffold or frontend demonstration. Work through the phases below without asking permission for routine implementation decisions. Record reasonable assumptions and continue. Ask only when genuinely necessary business information cannot be safely represented as an editable setting or an explicitly unverified value.

## 1. Business and non-negotiable scope

The shop manufactures and sells trophies and mementos. Orders often contain 100–500 recipients. Each insert uses a fixed design with a photograph, recipient name and possibly award/rank/designation. Organisation, event, logo, greeting and date usually repeat across an order. Staff currently replace photos and names manually in Photoshop, proof-check, arrange print sheets, print, cut and assemble.

The actual input source is unsorted WhatsApp messages on customers' phones. Photos and names arrive separately; sometimes a name appears only in the photo filename. Customers will select photos from Gallery/Files and copy-paste text from WhatsApp. Do not require spreadsheets, renamed files, organised folders, chat exports, account registration or installation for the basic workflow.

Build a standalone mobile-first web application. Photoshop remains an optional staff tool for preparing master artwork. Customers complete a short form with a preview. They do not manipulate layers, fonts, coordinates, colours, paper sizes or resolution. No paid AI API is required for any core feature. Do not build WhatsApp scraping, face identification, automatic name corrections or guessed photo/name matching.

The measurable goals are fewer staff editing minutes, fewer mismatches and reprints, and successful self-service by first-time customers. Do not invent percentage savings or claim that all proofreading responsibility or production work disappears.

## 2. Architecture and execution

Inspect the workspace and existing project instructions first. Preserve unrelated work. Reuse a suitable existing stack; otherwise use this default:

- Next.js with React, TypeScript, accessible components and responsive CSS/Tailwind.
- PostgreSQL with migrations and a maintained typed ORM, preferably Drizzle.
- A separate Node.js rendering/export worker using a durable PostgreSQL-backed queue such as pg-boss. Avoid adding Redis unless evidence justifies it.
- Private filesystem storage on persistent volumes behind a small storage interface. Do not put customer files in the public web directory or rely on an ephemeral hosting filesystem.
- A pinned Chromium/Playwright rendering environment, bundled licensed fonts, Sharp or equivalent for validated image decoding, and a maintained PDF library for exact millimetre placement.
- IndexedDB for recoverable local drafts and pending uploads, with server persistence as the authority for saved orders.
- Docker Compose for web, worker and PostgreSQL, with an optional HTTPS reverse-proxy deployment configuration.

Verify current stable compatible versions against official documentation, then pin versions and commit the dependency lockfile. Prefer a modular application in one repository. Avoid unnecessary services. No subscription service, email provider, WhatsApp API or AI key may be required to run the complete core workflow.

Write a short implementation plan and maintain `PROGRESS.md` with completed work, exact verification results and remaining tasks. Build a working vertical slice first, then expand. Do not stop after writing the plan or after completing one phase if independent required work remains.

## 3. Reference assets and template preparation

Inspect `reference-assets/` and any attached files. Expected references may include:

- `479 C.psd`
- `727 A R.psd`
- `H GLASS BIG.psd`
- `CARVING KANADI  BIG BASE.psd`
- `Sheet_A3.psd`
- `CARVING KANNADI R BIG copy.jpg`
- `492 C 4 copy.jpg`
- `image(8).png`, a handwritten order reference.

Previously inspected metadata, to verify from available files: 479 C is 1004 × 1843 px at 300 DPI, approximately 85.01 × 156.04 mm; 727 A R is 402 × 402 px at 300 DPI, approximately 34.04 × 34.04 mm; H GLASS BIG is 1358 × 2870 px at 300 DPI, approximately 114.98 × 242.99 mm; the carving base is 4134 × 543 px at 300 DPI, approximately 350.01 × 45.97 mm; Sheet_A3 is 3508 × 4961 px at 300 DPI, approximately A3. The sheet reference is blank and CMYK; this does not establish the required printer colour profile.

These are source canvas dimensions, not confirmed physical cutting measurements. Keep size and trim geometry explicitly unverified until staff calibrate them. Do not infer a physical cut path solely from decorative borders.

Preserve original files. Inspect PSD layers and generate an asset inventory. Prepare fixed backgrounds, transparent foreground decorations, photo masks and variable field geometry. Remove or hide original variable content through layer-aware preparation where possible. Never leave an old recipient name/photo behind the new content. Do not use generative inpainting to fabricate a clean master.

Do not promise automatic faithful conversion of every PSD effect, font, smart object or warped text. Document unsupported elements and the exact staff export needed. If assets or fonts are missing, keep building with clearly marked synthetic demonstration templates; do not present those as exact reproductions. Do not publish sample people's photos, names or handwritten contact information as public demo content.

Implement a staff template setup form using prepared assets and numeric geometry; a general-purpose canvas editor is not necessary. Define immutable template versions with:

- Model code and size variant, thumbnail, component names such as front/base, physical dimensions and calibration status.
- Background/foreground assets, masks, trim path, safe zone, bleed policy, media and allowed rotation.
- Editable fields, shared-versus-recipient scope, labels, required flags, default text and length/fit rules.
- Font assets, font size limits, wrapping/alignment, colour, and straight or curved text geometry.
- Photo placement, clipping mask and default crop rules.

Start with three available model families, subject to preparation/calibration. A published template used by an order must never change underneath that order.

## 4. Roles, access and order structure

Staff use authenticated accounts. Provide owner/admin and production-staff roles with real server-side authorization. Use secure password hashing and a first-run admin creation command; never ship a fixed production password.

Customers open a high-entropy, revocable order link or QR without registration. Treat links as access credentials. Keep scopes explicit: organiser can manage and approve their order; a helper can contribute only within their allowed scope; staff access follows role permissions. Never expose other orders or their media.

Staff create an order with model/size groups, expected quantities and the selected template version. Common event wording and logo are entered once, with per-group overrides only when needed. The organiser sees these clearly and confirms them. Contributors cannot accidentally change shared wording or model dimensions.

Support more than one model/size in an order, while a normal recipient form already knows its assigned model. Distinguish recipient count, copies and component count. One recipient with two copies and a front/base pair produces four printed components, not one.

Use separate order, recipient-completeness, approval and print-job states. Do not squeeze all conditions into one status field. Model at least orders, order groups, versioned templates, recipients/revisions, uploaded assets, scoped access, approvals, render jobs, print jobs and audit events.

## 5. Customer interface and exact entry flow

Design for ordinary Android/iPhone browsers, first-time users and older customers. Use Malayalam and English UI strings, readable text, at least 48 px primary touch targets, strong contrast and clear text labels. Keep the primary form one column with no horizontal scrolling. Do not expose implementation details in customer screens.

The entry card contains only:

1. Add/change photo.
2. Recipient name: paste or type.
3. One optional achievement/designation field when the template requires it.
4. A large trophy-insert preview.
5. Save and add next, plus a secondary option to return to the list.

Accept photo-first and name-first entry. Keep the photo visible while editing the name. The final preview is of the printable insert; do not invent a misleading photorealistic trophy mockup.

After Save and add next, create a fresh stable recipient ID and clear the previous name, photo, achievement and crop. Carry forward only genuine shared order content. Double taps must not create duplicate records.

Auto-save drafts as work progresses. On app switching, reload or browser recovery, restore the same unfinished card, including text, photo where retained, crop and order position. Clearly distinguish saved on this phone, uploading, saved to order and upload failed. Local storage is best-effort and may be evicted; never promise permanent offline storage or guaranteed background uploads after the browser closes.

Show an order list with thumbnail, name or entry number, completeness and review state. Include search and simple filters: all, needs name, needs photo, needs checking. Show truthful counts. Sorting must never alter photo/name relationships. Editing an existing name must not require re-uploading its photo. Replacing a photo or crop resets that entry's review state.

## 6. WhatsApp-oriented intake and recovery

Gallery/Files selection and ordinary text paste are the universal baseline. Explain saving a WhatsApp image to the phone only when the customer cannot find it. Do not attempt to read private chats or the clipboard in the background.

If a descriptive original filename survives, offer an editable, unconfirmed Use filename as name suggestion. Remove the extension for the suggestion, but preserve the original filename privately. Reject generic camera/WhatsApp filename patterns as name suggestions. Never guess a name from a generic filename or silently strip meaningful initials/digits.

Allow pasting a longer message into a draft text field for manual editing. Optional extraction can be added later; core functionality must not depend on AI. Preserve Unicode, Malayalam vowel signs, joiners and meaningful punctuation. Do not silently spell-correct personal names.

An optional Add several photos action creates separate unnamed drafts and a one-photo-at-a-time completion queue. Bounded uploads and clear progress must keep phones responsive. Never associate a separate list of names by upload order, alphabetical order, timestamps or unverified filenames.

Validate content server-side by decoding, not by extension alone. Support JPEG, PNG and WebP. Explicitly implement and test the chosen HEIC/HEIF path; if the runtime cannot decode a file, show a specific actionable conversion message and preserve other work. Correct EXIF orientation, preserve the full-resolution source privately and use thumbnails for lists. Avoid publishing GPS metadata in derivatives. Set configurable file-size and decoded-pixel limits with useful errors.

Uploads must be retryable and idempotent. Bind each upload to its intended recipient ID. A late upload or render response for an old revision cannot overwrite a newer selection. Handle interrupted connections, repeated taps, duplicates and storage exhaustion. Warn about possible duplicate photos/names without automatically merging or deleting legitimate repeated awards.

Helpers can enter separate recipients concurrently. Use optimistic revision checks for edits, preserve conflicting drafts and show a simple resolution path instead of silently overwriting another person's work.

## 7. Photo crops and Malayalam rendering

Fit photos to the specified circle/shape while retaining the original. Provide simple move/zoom and rotation controls. Save crop transforms relative to the orientation-normalized source and reproduce them exactly in server output. Background removal and face detection are optional later; do not require either.

Prove Malayalam rendering early. Bundle licensed Unicode Malayalam and English fonts, including license files. Font loading must finish before authoritative rendering. Test conjuncts, chillus, vowel signs, mixed scripts, initials, punctuation and long names with a curated corpus. Record which visual checks require a Malayalam reader.

Automatically fit text within template limits using correct shaping and grapheme-safe handling. Never silently truncate names, drop combining marks, stretch text arbitrarily or shrink below the configured readable minimum. Overflow should produce a clear field-level issue.

Curved Malayalam headings are a required feasibility test. A tested Chromium SVG textPath approach is acceptable if the actual glyph shaping is correct. Do not split strings into individual Unicode code points and rotate the characters around an arc. If editable curved text cannot meet the quality gate, explicitly mark it unsupported and use a staff-approved fixed heading asset for that template. Record this limitation; never label a fixed image as editable text.

Audit legacy Malayalam font encodings in PSDs rather than assuming their text is Unicode. Do not silently substitute a visually different font in an approved design.

## 8. Authoritative proof and approval

Use one authoritative server rendering pipeline with pinned fonts, renderer version and explicit physical dimensions. The interactive editing preview may be lightweight, but final approval must display a preview derived from the exact authoritative high-resolution artwork that will be placed in the PDF.

Store immutable render assets and hashes, with source/template/input/revision references. Capture template version, shared content, recipient fields, source asset hashes, crop, copy counts and component mapping in the approval snapshot. Include the render configuration. Never reconstruct approved artwork later from mutable current fields.

Require readable individual review, with enlargement and a clear photo/name pairing. A tiny contact sheet or a checked checkbox without accessible proofs is insufficient. Record review against each current recipient revision, then obtain organiser approval of shared wording, counts and the full order snapshot.

Use plain approval wording such as: I have checked the names, photographs, wording and quantities. Approve for printing. Record actor, time and approved revision. Do not claim this transfers all legal or manufacturing responsibility.

Any later content, photo, crop, template, model or quantity change creates a new revision and invalidates current final approval. A shared-content edit invalidates affected entry reviews too. Block stale approval submissions transactionally if edits occur during approval. Old approvals remain in history.

Staff see a production-ready order only after required uploads, validations, proofs, calibration and approval are complete. Staff retain technical print checks.

## 9. Print pipeline and A3 imposition

Make approved orders available directly in the staff dashboard. Customers should not need to download and resend hundreds of images. Offer optional individual high-quality JPEGs/ZIP and A3 PDF downloads behind authorized access.

Generate A3 pages at exactly 297 × 420 mm, with configurable portrait/landscape and printer profiles. Store geometry in millimetres; use correct conversion to PDF points and raster pixels. Render inserts at 300 DPI by default. Higher export DPI cannot recover detail missing from a low-resolution photo; evaluate effective photo resolution after cropping.

Place the exact approved lossless artwork assets into the PDF at their intended physical size. A raster-embedded PDF is acceptable for the first implementation; do not rebuild text in a different PDF renderer. Keep transparent cutouts and solid backgrounds predictable for print.

Use deterministic conservative rectangle packing first, allowing 90-degree rotation only where the template/media permits. Include the full footprint: trim bounds, configured bleed and cutting gap. Respect printer nonprintable margins and group incompatible media/profiles separately. Do not shrink inserts to fit, overlap artwork, add unrequested copies or promise a fixed number of pieces per A3 sheet.

Support front/base pairs from the same recipient and keep them identifiable in an assembly manifest. Put order, revision, sheet and piece identifiers only in safe waste areas or a separate manifest, never across customer artwork. Avoid unwanted visible borders on finished pieces.

Generate a placement manifest listing recipient ID, model, component, copy number, page, x/y coordinates, dimensions and rotation. Validate page bounds, non-overlap, quantities and complete coverage programmatically.

Provide a calibration PDF with measured rulers and reference shapes. Require staff to verify actual-size output and physical fit before marking a model/profile calibrated. Document printing at 100%/Actual Size, with fit-to-page disabled. Desktop print dialogs require operator action; downloading a PDF is not proof that it was physically printed.

Preserve/convert colour deliberately with explicit profiles. Default to a documented sRGB workflow with a printer test; do not claim automatic CMYK/PDF-X compliance or colour matching without implementing and validating it. The blank CMYK PSD alone does not identify the production printer profile.

## 10. Jobs, revisions and operational reliability

Render/export jobs must run outside request handlers and phone tabs. Use durable job records, bounded concurrency, progress, retry, cancellation, timeouts and worker restart recovery. Prioritize small interactive proofs over large batch exports without starving batches. Do not load 500 full-resolution photos into browser or worker memory at once.

Derive draft proof renders from immutable input-revision snapshots. Production PDFs, JPEG/ZIP exports and print manifests must derive only from an immutable approved snapshot and configuration. Approval binds the already-rendered canonical artwork; it must not trigger a different rendering path. Use idempotent operations and atomic publication of complete artifacts. Never offer a partly written PDF as complete. Queued jobs must not silently switch to newer content. If an approved order is revised, mark older output superseded and block accidental release as the current print job.

Track artifact generation, staff release and manually confirmed printing separately. Reprinting selected pieces should be deliberate and recorded; do not silently reprint a whole order after a minor correction.

Expose useful job failures and retry controls to staff. Record measured performance and resource usage; do not promise an untested completion time.

## 11. Security, data and hosting

Enforce authorization on every read/write/export/media endpoint. Use strong random access tokens, hashed token storage, expiry/revocation, redacted logs and safe session handling. Protect state changes against CSRF, validate inputs and sanitize any staff-uploaded SVG. Render jobs must not fetch arbitrary customer-supplied remote URLs. Keep secrets out of source control.

Use HTTPS for customer deployments. Explain that a shop PC on Wi-Fi serves phones on the same reachable network; it is not automatically accessible from customers' homes. A phone's localhost refers to the phone, not the shop PC. Configure the real base URL for QR links.

Provide runnable local Docker setup and an optional HTTPS server deployment using persistent volumes and a reverse proxy. Keep production database ports private. Document Windows/Docker Desktop prerequisites and Linux operation. The shop server must remain powered and reachable while used.

Treat ordinary LAN HTTP as limited development/testing mode. Service workers/installability require a secure context; desktop localhost exemptions do not make a phone's HTTP LAN-IP connection secure. Installation is optional. Do not require customers to install certificates or bypass browser security warnings to complete normal production orders.

Bundle fonts/assets for operation without third-party runtime requests. After installation, LAN-only operation should not depend on the internet. Recoverable drafts are useful, but final upload, approval and server export require connection to the server. Provide truthful offline/reconnect messages and versioned cache updates that do not discard unsent work.

Provide coordinated database-plus-files backup and restore scripts, a documented recovery process and configurable data retention. Retain assets referenced by approvals/jobs until the applicable retention policy permits deletion. Report storage health. Document that lost devices or cleared browser data can remove unsynced drafts.

## 12. Implementation sequence and boundaries

Phase A: inspect assets, settle stack and schema, build one complete order through entry, upload, Malayalam proof, approval and an actual A3 PDF. Validate text and millimetres before polishing.

Phase B: add the three prepared model families, bilingual customer UI, draft recovery, optional multiple-photo intake, filename suggestions, staff order management and immutable template versions.

Phase C: add scoped helpers, mixed model groups, copy counts, paired front/base pieces, review/revision safeguards, durable jobs and production manifests.

Phase D: complete backups, local/HTTPS deployment, security checks, mobile checks, 500-record stress test and operator documentation. Fix failures before reporting completion.

Defer CSV import, recipient-by-recipient parent collection links, AI/OCR, WhatsApp API integration, Android share-target shortcuts, native apps, online payments, inventory integration, advanced irregular nesting and multi-site synchronization. Do not add visible nonfunctional buttons for deferred features. Share-target capabilities vary by platform and installation; never make them necessary for the basic workflow.

## 13. Acceptance tests: implement and report evidence

Use unit/integration tests for business rules and browser tests for critical journeys. Inspect actual rendered screenshots and PDFs. Test the real backend, not only mocked happy paths.

1. Enter photo then name, and name then photo; preserve the pairing through reload, navigation, app-switch simulation and sorting. A fresh card contains no previous recipient data.
2. Simulate failed/slow uploads, reconnect, repeated Save and late responses. No false saved status, lost draft, duplicate recipient or stale photo overwrite.
3. Test descriptive filename suggestions, generic filenames, Malayalam filenames and absent original filenames without automatically approving suggestions.
4. Keep incomplete entries visible and block their accidental inclusion in an approved full order. Verify record, copy and component counts separately.
5. Two helpers can add entries concurrently; conflicting edits cannot silently overwrite work. Cross-order and out-of-scope access attempts fail server-side.
6. Test Malayalam glyph shaping, curved headings, long names, mixed scripts, phone photo orientation and crop consistency. Include visual evidence and clearly identify remaining human font/language checks.
7. Confirm approved proof and PDF refer to the same canonical artwork assets. Changing a name, common heading, photo, crop, model or quantity invalidates approval. Test edits racing with approval/export.
8. Programmatically check A3 page dimensions, physical insert placement, margins, rotation, bleed/gaps, non-overlap, front/base pairing and exact quantities. An oversized insert fails clearly rather than being scaled down.
9. Generate an order of 500 synthetic recipients with representative phone-sized images and mixed quantities. Restart the worker during generation. Verify no missing/duplicated pieces and report actual time, peak memory and output size. Separate a smaller smoke test from the full stress test.
10. Inspect customer layouts at 360, 390 and 768 px widths, including the keyboard/crop state where tools allow, plus desktop staff views. Use Chromium and WebKit browser tests; do not claim real Android/iPhone testing unless performed on those devices.
11. Restore a backup into a clean instance and recover orders, uploads, approvals and print artifacts. Validate safe failure when storage or a required font is unavailable.
12. Build and start the documented production containers where the environment permits. Record unavailable runtime, physical phone and real printer tests honestly rather than treating them as passed.

Use synthetic identities/photos for automated fixtures. Do not send real customer images to external AI services. First-time customer usability and actual printer calibration are human acceptance checks; provide a short checklist instead of claiming they are automatically verified.

## 14. Required deliverables

Deliver source code, migrations, dependency lockfile, Docker/Compose configurations, `.env.example`, first-run setup, repeatable demo seeding, tests and real generated sample exports. Do not include secrets or a publicly accessible dataset of customer references.

Provide:

- `README.md`: precise installation, startup, admin creation, sample customer link generation and troubleshooting.
- `ARCHITECTURE.md`: data model, rendering pipeline, approval invariants and deployment boundaries.
- `TEMPLATE_SETUP.md`: PSD preparation, editable fields, font limitations, calibration and adding a new model without changing core code.
- `PRINTING_GUIDE.md`: A3 profiles, Actual Size settings, calibration, manifests and reprints.
- `BACKUP_RESTORE.md` and working scripts.
- `TEST_REPORT.md`: commands, results, failures, stress metrics and unperformed physical checks.
- `PROGRESS.md`: final completion checklist and known limitations.
- A short bilingual customer instruction card and staff pilot checklist.
- An actual sample approved-order PDF, individual artwork sample, placement manifest and calibration PDF produced by the implemented pipeline.

At the end, report what works, how to run it, what was tested and what still requires human verification. Label the result ready for a controlled pilot only when software checks pass; do not claim production readiness without successful printer and real-customer trials. If a required capability is blocked, keep completing independent work and identify the specific remaining blocker. Do not substitute fake export files, hardcoded success states or screenshots for working functionality.

Begin by inspecting this workspace and the references, writing the implementation plan, and then implementing the complete application in the phase order above.
