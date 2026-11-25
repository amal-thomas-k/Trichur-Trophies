# Work1 local test

Work1 is an isolated copy of the application using `data/work1/app.sqlite` and its own private files. It opens only on this computer at **http://localhost:3000/staff**. The main database, other orders and `.env` are not used by this launcher.

## Start

Double-click **`Start-Work1.cmd`** in the project folder. Alternatively, open PowerShell in the project folder and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-work1.ps1
```

On the first startup only, if Work1 has no staff accounts, choose a username and a password of at least 12 characters. Password entry is masked and must be repeated. There is no supplied/default password. Later startups use the existing account and do not replace it.

Open **http://localhost:3000/staff**, sign in and open the imported Work1 order. Use the organiser link for customer entry/review. The launcher does not import or duplicate an order on every start.

Keep the terminal window open while testing. The web server runs in that window; the rendering/export worker runs hidden. Press **Ctrl+C** to stop the local test. The launcher stops only the worker it started. Saved entries, proofs and exports remain in `data/work1/`; interrupted durable jobs can recover on the next start.

## Check without starting or changing data

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-work1.ps1 -CheckOnly
```

This checks Node, installed dependencies, Work1 process/maintenance locks and whether port 3000 can be bound. It does not create an account/database or start services. An occupied port or active Work1 lock stops startup; do not run another instance over the existing service.

The launcher sets these values for its own processes and restores the calling PowerShell environment on exit:

| Setting | Work1 value |
| --- | --- |
| `DATA_DIR` | Absolute project path plus `data/work1` |
| `HOST` | `127.0.0.1` |
| `PORT` | `3000` |
| `BASE_URL` | `http://localhost:3000` |
| `NODE_ENV` | `development` |

No `.env` file is loaded, no package download is attempted, and no public/remote service is contacted. Existing installed Node dependencies and fonts are required; normal setup instructions remain in `README.md`. The launcher can find Node from PATH, the configured runtime location or the installed Codex runtime package.

## Test the order

1. Check the imported model/group, expected recipient quantity and common wording.
2. Open the organiser link, choose or change a photograph, paste a name and save.
3. Reload the page and confirm that the intended photo/name pair and draft survive.
4. Generate the final proof and inspect the enlarged name/photo/crop before marking it checked.
5. Review every current entry and approve the order's wording and quantities.
6. Return to staff and generate the A3 diagnostic PDF. Check the placement manifest and exact quantities.

Diagnostic export is for local verification. Do not record a physical calibration merely to bypass the production gate. Actual Size printing, cut fit, colour and Malayalam-reader approval remain human checks from `PRINTING_GUIDE.md`.

Worker logs are under `data/work1/logs/`. A phone's localhost refers to the phone; this launcher intentionally binds only to this computer and is not a customer deployment.

## Imported order and verification results

The existing isolated order is `00eb486e-1f9f-48be-97d9-325212e0d6a7`; its group and recipient IDs are retained in `data/work1/work1-batch-state.json`. This file contains the private organiser link and should not be published. There are exactly 100 source portraits in `Work 1/Leonardo DiCaprio/`. Filenames without extensions are the printed labels. The original photographs and Photoshop files are unchanged.

**Current completion boundary, 24 November 2026:** 17 saved PNG/JPEG designs exist. The complete 100-design manifest, four final contact sheets and 100-page review PDF have **not** been produced. The import remains resumable; it must not be reported as a completed batch. The first eight existing canonical Chromium proofs are retained. Subsequent proofs use the restricted local compositor described below. No customer review or approval is fabricated.

Before resuming, the existing SQLite database was backed up using SQLite's coherent backup API and the prior state/output files were copied to `Work1-Output/previous-attempts/2026-11-24-before-local/`. This preserves the earlier 11 exported image pairs, including exports that did not correspond to the eight initially persisted proofs.

### Resume the 100-design export locally

Stop `Start-Work1.cmd`, then double-click **`Build-Work1.cmd`**. It sets PowerShell and .NET telemetry opt-outs **before starting PowerShell**, discovers installed Node.js, runs offline guard checks, and resumes the existing order. It does not install packages or contact a processing API. Allow approximately 8–10 minutes for the remaining work; this is an estimate, not a measured completed-run time.

The launcher enables Node's filesystem permission checks, allows the installed Sharp native addon, and preloads a guard that denies socket, DNS, HTTP(S), fetch, WebSocket, UDP, child-process and JavaScript-worker operations. Its nine probes must fail locally before the database is opened. Native addons remain trusted installed code; this is not an operating-system firewall. The guard cannot make an already-started shell's prior telemetry disappear, which is why the command launcher sets opt-outs before shell startup.

`Build-Work1.cmd` and its guard are prepared but **have not passed execution in the managed host**. Automatic approval review rejected the batch after detecting a Visual Studio telemetry connection. A later guard-check attempt was also rejected because the host's mandatory PowerShell process contacted telemetry before its in-process opt-out could take effect. The host has no exposed pre-start environment option and rejected a direct `cmd.exe` shell. The rejected execution was not retried unchanged or bypassed. A normal user-launched command file can set those environment variables before creating PowerShell; that complete launcher still requires a local run to establish its result.

On successful completion, inspect `Work1-Output/RUN-REPORT.json`; it is written only after all 100 canonical PNG/source hashes, PDF generation and zero approvals are checked. It records the actual elapsed time, renderer counts, PDF bytes/SHA256 and offline guard state. Outputs are:

| Output | Intended completed content |
| --- | --- |
| `png/` | 100 canonical 2953 × 2953 PNGs, 300 DPI |
| `jpeg/` | 100 JPEG viewing/printing copies, quality 96, 4:4:4 |
| `thumbnails/` | 100 browser thumbnails |
| `contact-sheets/` | Four sheets, 25 designs per sheet |
| `Work1-100-designs-A3-review.pdf` | 100 exact A3 pages; lossless native-resolution artwork |
| `design-manifest.json` | Stable recipient/proof/source/artwork hash mapping |
| `A3-placement-manifest.json` | Physical coordinates and embedded image hashes |
| `index.html`, `RUN-AND-TEST.txt` | Offline browsing and local-order instructions |

The lossless full-size PDF is expected to be roughly 750–850 MB because each original canonical artwork is about 8 MB. It is written sequentially without collecting 100 decoded images in memory. This export is explicitly an **unapproved review PDF**; production release still follows the application's customer approval and printer calibration gates.

### Completed checks and exact limits

- The 14 worker tests pass, including lease recovery, cancellation, immutable approval hashes, exact reprint selection and the independent production-calibration gate.
- The browserless renderer was run against actual Work1 data. It uses pinned Sharp 0.35.5/libvips 8.18.7/Pango 1.58.2 and the bundled `LiberationSans-Regular.ttf`, with font/background/source hash checks. It starts no browser and contains no network client. Its provenance is recorded as `tt-work1-local-sharp-1`.
- A comparison against the first existing Chromium proof found **zero differing pixels across 7,631,739 pixels outside the portrait and name regions**. The measured name baseline was aligned; Pango glyph rasterisation and rounded crop sampling can differ within the editable regions. Byte identity with Chromium is not claimed. This exact sealed template's offline filename renderer accepts printable ASCII labels; other templates continue using the normal multilingual renderer.
- The streaming writer produced a real **two-page** test at `data/work1<TEMP_DIR>/review-pdf-check.pdf` (15,895,173 bytes). Independent `pypdf` checks confirmed both MediaBoxes at 297 × 420 mm and decoded image RGB bytes identical to the two canonical PNGs. PDFium successfully rendered its first page. This test is not the missing 100-page export.
- Every Work1 artwork occupies 250.020667 × 250.020667 mm, derived from 2953 pixels at 300 DPI. PDF placement is x = 23.489667 mm and y = 40 mm from the top of a portrait A3 page. Physical fit to a trophy has not been measured.
- The fixed background SHA256 is `db1f8b4878e6387b03ce3801ee01494c2b214dc6e1ee5ecfdb7c7853ac5986ee`; the bundled Latin font SHA256 is `f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f`.
- Fresh imports copy the same pinned `private/prepared-assets/jyothi-carving-round-master.png`; they do not invoke browser-based layout authoring. The supplied campus JPEG must match SHA256 `4f7c1592ead9cd15bc484ccfc566a65b25f9e295209bca38f76e3bc94ac819c3` before the master can be used.
- Independent visual review of saved designs 001–017 found matching filenames/portraits and visible eyes/mouth. Image 014 is very soft because the actual source is only 160 × 191 pixels; no synthetic detail was introduced. Source 097 includes its original small tiger inset, and 096 has blurred background people.

Remaining checks are completion of all 100 guarded jobs/exports, final all-entry source pairing and visual contact-sheet review, the actual browser customer/staff journey, and printer/device checks. Print at Actual Size/100%, measure the square and cut fit, inspect colour and source-image softness. The campus source is only 640 × 480 pixels (about 79 effective DPI at its placed size), so it cannot be certified as detailed print photography by software.
