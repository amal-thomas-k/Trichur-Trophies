# Trichur Trophies — Personalise & Print

**Setting this up with your existing domain/hosting or on the designer-room Wi-Fi? Start with the [owner and technician hosting handoff](docs/HOSTING_HANDOFF.md).**

## Start at the shop counter

1. On this Windows PC, double-click **Start-Shop.cmd**. On first launch, create a staff username and password. Leave the window open. The launcher prints the staff address for this PC's shop Wi-Fi connection.
2. Sign in at the printed **/staff** address. Select **New order**, choose the model and expected number of recipients, and select **Create order**. The Jyothi version of **CARVING KANNADI R BIG** has the college photograph and arched title built into the model. Each customer supplies the name and portrait.
3. Connect the customer's phone to the same shop Wi-Fi. Show the QR code or copy the private order link to the customer. For an existing order, open it and select **Share order link / QR**. An organiser can review and approve. Use a helper link for someone contributing entries to an order.
4. The customer chooses a photo, enters the name and saves. Generate the proof, check the spelling and crop, and confirm the order. Staff can then prepare the A3 PDF. Use an Actual Size test print before releasing an uncalibrated model.

The web link works without installing an APK. The local HTTP address is for a trusted shop Wi-Fi trial. For use from mobile data, public Wi-Fi or home, follow [Shop hosting](docs/SHOP_HOSTING.md) to run the included HTTPS configuration. A compatible phone can add the HTTPS app to its home screen.

The normal shop launcher uses its own database. To open the existing Work 1 practice order on this PC, run `.\Start-Shop.cmd -Work1` in PowerShell. Currently, 17 of its 100 designs have saved, visually checked PNG and JPEG files. To resume the remaining designs, close the Work 1 server and double-click **Build-Work1.cmd** in the original project folder. See [Work 1 local test](docs/WORK1_LOCAL_TEST.md) for output paths and verification limits. A fresh source installation includes the Jyothi template. The practice portraits and order database stay on the original PC.

Customer photograph/name intake, recoverable phone drafts, server-rendered proofs, immutable approval and accurately sized A3 production. This is a self-hosted application; no WhatsApp, email or AI subscription is required. Read `TEST_REPORT.md` for the actual verification results and outstanding gates before a shop pilot.

The original `Design Templates/` files are preserved. The 479 C layout is explicitly synthetic; 727 A and H GLASS use inspected blank source frames with new field placement. Their canvas dimensions are grounded in reference metadata, but physical cut fit and complete visual equivalence to the original PSDs are not certified. Physical calibration must be recorded before production release.

## Run on this Windows workspace

Node.js 24.22.3 is available on this machine. The dependency loader can use its existing audited runtime packages when `node_modules` is absent. From the project directory:

```powershell
Copy-Item .env.example .env
node --env-file-if-exists=.env scripts/migrate.js
node --env-file-if-exists=.env scripts/admin.js --username owner
node --env-file-if-exists=.env scripts/seed.js --demo
```

The administrator command creates a real account; there is no shipped production password. Enter a password of at least 12 characters when prompted. For unattended setup, set a temporary `ADMIN_PASSWORD` environment variable and pass `--password-env ADMIN_PASSWORD`; do not put the password in a command argument or commit it. Add `--role production` for a restricted production staff account. The seed command prints a private sample customer link. Keep that link private: it is an order credential.

Start the two processes in separate PowerShell terminals:

```powershell
node --env-file-if-exists=.env src/server.js
```

```powershell
node --env-file-if-exists=.env src/worker.js
```

Or run `powershell -ExecutionPolicy Bypass -File scripts/run.ps1` for a foreground web server with a hidden worker. Closing it stops the worker; its durable jobs recover on restart. Worker logs are written to `worker.log` and `worker-error.log`.

Open `http://localhost:3000/staff`. The customer uses the link generated for their own order. A running web server alone can save entries, but rendering/export require the worker.

## Install on another computer

Install Node.js **24.22.3 or later in the 24 LTS line**, with its npm command, and pnpm **11.25.0**. Then:

```text
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

On Linux, use `pnpm exec playwright install --with-deps chromium` to install Chromium's OS dependencies. Copy `.env.example` to `.env`, set a persistent `DATA_DIR` and follow the commands above. Windows users may run `scripts/setup.ps1` after installing Node and pnpm. The bundled-runtime shortcut is specific to this development host; ordinary installations use the committed lockfile.

The lockfile contains original integrity records from the installed runtime, including optional platform packages. npm registry DNS and creation of package-manager links were restricted in the implementation environment; a clean internet install and container build must be validated on the deployment host. Do not replace the lockfile with unpinned latest versions.

## Docker / Linux server

Install Docker Engine with Compose on Linux, or Docker Desktop using Linux containers and WSL2 on Windows. These are operator-installed prerequisites; Docker was not available in the implementation environment.

```text
docker compose build
docker compose run --rm web node scripts/migrate.js
docker compose run --rm -it web node scripts/admin.js --username owner
docker compose run --rm web node scripts/seed.js --demo
docker compose up -d
docker compose logs -f web worker
```

The named volume `production-data` contains the database and private files. Do not run `docker compose down -v` unless deliberately destroying that data. Both processes must use the same local volume. Do not place SQLite on a network share or run multiple web replicas across hosts.

For an internet-reachable HTTPS server, set `DOMAIN` to the DNS name that reaches the server, allow inbound ports 80/443, and run:

```text
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Caddy obtains and renews certificates. This deployment requires valid DNS and reachable ports; starting Compose does not make a shop PC reachable from customers' homes. Set the real `BASE_URL` before issuing links. Preserve the reverse proxy's certificate volumes.

## Shop workflow

1. Staff sign in, choose immutable template versions, create model groups and set expected recipient quantities. Add common event wording once.
2. Share the organiser link. Issue restricted helper links when separate people will contribute entries; helpers cannot approve the order or edit other helpers' entries.
3. The customer adds a photo, pastes/types the name, adjusts the crop if needed and saves. Incomplete entries remain visible. Locally retained drafts are distinct from entries saved to the server.
4. Generate each proof, enlarge it and check the photo/name pairing. Fixes require a new proof and review.
5. The organiser confirms common wording and quantities and approves the exact current order. Any later relevant change invalidates that approval.
6. Staff calibrate the template/profile with a physical ruler and test fitting, queue the approved export, inspect its manifest, release it, and separately record actual printing.

See `PRINTING_GUIDE.md`, `TEMPLATE_SETUP.md`, `BACKUP_RESTORE.md`, `docs/CUSTOMER_CARD.md` and `docs/STAFF_PILOT_CHECKLIST.md`.

## Tests and actual exports

```text
node --test tests/*.test.js
node scripts/check-render.js
node --env-file-if-exists=.env scripts/sample.js
```

See `TEST_REPORT.md` for integration/browser/stress commands and measured outcomes. Sample PDFs and manifests are generated by the real renderer and packing pipeline. They demonstrate digital dimensions; only printing at Actual Size and measuring proves the physical printer path. `samples/render-check/sample-A3-artwork.pdf` additionally demonstrates all three prepared families and the paired 727 components; `malayalam-corpus.png` is the straight/curved shaping inspection sheet.

## Configuration and troubleshooting

| Setting / symptom | Action |
| --- | --- |
| `BASE_URL` | Public HTTPS origin for customer links; localhost is only the current computer. |
| `HOST` / `PORT` | Default development binding is local. A LAN test requires a reachable interface, firewall rule and correct LAN URL. |
| `DATA_DIR` | Local persistent database/private asset directory. Back up the whole directory as a coordinated unit. |
| `MAX_UPLOAD_MB` / `MAX_IMAGE_PIXELS` | Server limits; defaults are 20 MB and 50 million decoded pixels. |
| `MIN_FREE_STORAGE_MB` | Default 10 MB free-space reserve before accepting a new upload; low storage returns an actionable failure and preserves the entry. |
| `RETENTION_DAYS` | Default 365 days after explicit order archive and last activity; cleanup is offline and dry-run unless `--apply` is passed. |
| `CHROMIUM_PATH` | Optional explicit browser executable for a controlled local setup. The pinned Playwright browser is preferred. |
| Missing font | Restore the bundled licensed font and license file; do not silently substitute an approved design's font. |
| Proof stays queued | Start the worker and inspect its log/job error. Check writable storage and browser installation. |
| HEIC cannot decode | Export/save the image as JPEG or PNG and retry this entry; keep the other draft work. |
| Conflict after another editor saves | Keep the local draft, load the current server entry and explicitly compare before saving again. |
| Export blocked | Check current approval, individual reviews, expected quantities, model dimensions and printer/template calibration. |
| Disk full | Free space or move the coordinated data directory to adequate storage while stopped; retry the failed job. |
| Phone cannot open localhost | Use the reachable server hostname. The phone's localhost is the phone itself. |

All core fonts/assets are local after installation. Phone HTTP over a LAN is limited development mode: it is not a secure browser context. Production must use HTTPS. Installation of a phone app is optional. Browser storage can be cleared or evicted; unsent drafts are not a backup. In a secure context, a versioned service worker caches only the application shell; API/media/proof responses stay private and uncached. Cached order metadata and drafts use IndexedDB. A manual update prompt preserves unsent work. The native localhost browser test verified offline reload and a service-worker update with an unsent draft. First opening an uncached order while offline still requires a connection. See docs/SHOP_QA.md for device and HTTPS checks.

## Implementation boundary

The master specification's default Next.js/React/PostgreSQL/Drizzle/pg-boss stack could not be installed here because package registry DNS was unavailable and PostgreSQL/Docker were absent. The delivered runnable implementation uses a native ES-module frontend, Node HTTP service, SQLite with transactions and a separate durable worker. These are deliberate documented deviations, not claims that PostgreSQL or pg-boss were delivered. This deployment targets one shop server with local persistent storage. Migrating to PostgreSQL and validating its queue/concurrency/backup path remain required before a multi-server deployment or strict acceptance of that default architecture.

`docs/SPEC_COVERAGE.md` maps the implementation to the complete master specification and identifies partial capabilities, unsupported editable curved Malayalam, unperformed physical/device checks and the remaining acceptance gates.
