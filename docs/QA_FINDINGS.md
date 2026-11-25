# Independent QA findings

Verified on 2026-11-20 after the Windows workspace reconnected.

## Executed checks

```powershell
$env:TEST_TRANSPORT='direct'
node --test tests/integration.test.js
node scripts/browser-check.js
```

- Integration: 19 tests passed, zero failed, zero skipped. Latest suite duration 12.73 seconds.
- Browser: 14 checks passed, zero unhandled browser errors. Chromium 157.0.8103.79. Journey duration approximately 12 seconds, excluding setup/cleanup.
- Browser-derived approved sample PDF: one page, 99,294 bytes, exactly 297 x 420 mm. The browser run generated two synthetic recipients, reviewed their real worker-rendered proofs, approved them, then used the staff export form. The exported file was fetched through the authorized artifact route.
- The generated PDF was independently rendered with the installed PDF.js and canvas packages. Page geometry was 841.8897637795277 x 1190.5511811023623 points. Its two inserts and readable Malayalam name were visually inspected.

## Transport boundary

The environment denied Node loopback TCP with `connect EACCES 127.0.0.1`, including a minimal standalone socket check. Tests therefore used an explicit `TEST_TRANSPORT=direct` mode. It executes the actual server request handler, authentication, CSRF validation, SQLite transactions, Sharp decoding, private storage and separate worker. It supplies in-memory request/response streams instead of a TCP socket; no successful business response is mocked.

The browser uses Playwright request routing into that same handler. It runs the shipped HTML/CSS/JavaScript, real IndexedDB, cookies, image selection, forms and server-backed jobs. A failed-upload test intentionally aborts one request. The remaining responses come from the implemented backend. HTTP mode remains the default for the integration harness on an ordinary unrestricted host. Live LAN/HTTPS networking is still unverified.

The staff PDF link was clicked and Chromium emitted a download event, but the host cancelled its download manager (`download.saveAs: canceled`). The same authenticated browser successfully fetched the complete PDF from that exact URL, and those bytes were saved and validated. The report records `browserDownload: false`; native browser download completion is still unverified on an unrestricted host.

## Covered behavior

- Unauthenticated and cross-order reads blocked; helper ownership and production-role restrictions enforced; revoked links stop working.
- CSRF and foreign-origin mutations rejected.
- Unicode name persistence, stable recipient IDs, duplicate Save and upload retries, photo retention on name edits, conflicting revisions and stale uploads.
- JPEG/PNG upload decoding; malformed image, SVG and unsupported HEIC rejection with actionable feedback.
- Real canonical proof generation by the separate durable worker, hash equality, current-revision review, approval snapshots and private-response redaction.
- A3 page dimensions, exact two-copy quantities, manifest artwork hashes, uncalibrated production-release blocking and superseded-output blocking.
- Late proof completion cannot attach to a newer revision; shared wording invalidates reviews; two helpers can contribute independently.
- Missing calibration measurements are rejected.
- Mixed groups correctly distinguish recipient, copy and front/base component counts. Group overrides invalidate only affected recipients, clearing overrides restores shared defaults, and revisions remain in history. A required template field omitted by a recipient fails proof generation and blocks approval.
- A synthetic JPEG with EXIF orientation 6 is correctly rotated to normalized pixel dimensions; its served derivative contains neither orientation nor EXIF metadata.
- Customer photo-first and name-first entry, descriptive filename suggestion without automatic acceptance, generic filename suppression, IndexedDB photo/text/crop recovery after reload and an app-switch event simulation.
- Fresh next card contains no previous photograph, name, achievement or crop. Failed upload keeps the draft; retry does not duplicate the record. Sorting preserves photo/name associations.
- Customer entry layouts at 360, 390 and 768 px have no horizontal overflow, including crop controls; primary photo and Save targets measure at least 48 px. Desktop staff production screen inspected at 1440 px.
- Individual proof review, organiser approval, Malayalam UI switch and staff A3 export completed through the UI.

## Regressions found and fixed

1. Missing-file asynchronous errors escaped the request-handler catch. All file sends now await inside the catch boundary; the missing-static-file regression passes.
2. Public proof responses exposed the stored private render snapshot. Responses now explicitly select public fields; regression passes.
3. Repeated approval exposed its full immutable private document. Retry responses now return only the public approval identity/hash; regression passes.
4. At 360 px, hidden file input sizing caused 33 px horizontal overflow. Accessible visually-hidden rules and range-grid minimum sizing were corrected. All three viewport checks now pass.

## Evidence

`artifacts/qa-browser/browser-report.json` records the machine-readable browser results. The same directory contains six synthetic UI screenshots, `browser-approved-order.pdf`, and `browser-approved-order-page1.png` for independent PDF inspection. No real customer identities or original reference portraits were used.

## Not verified

WebKit is not installed. Native browser download completion, real Android/iPhone devices, native keyboard behavior, physical app switching, printer Actual Size calibration, cut fit, media/colour matching, Malayalam-reader approval and first-time customer usability remain host/human/device acceptance tasks. The HEIC rejection test uses synthetic invalid HEIC bytes; native device HEIC selection and conversion still need a real-phone check. This report does not claim those checks passed. The separate stress and backup reports should be consulted for their measured results.
