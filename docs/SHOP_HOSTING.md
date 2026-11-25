# Shop Wi-Fi and HTTPS hosting

**`Start-Shop.cmd` starts a clean shop instance on this computer's private LAN address.** It uses `data/shop`, separate from the earlier synthetic test database and the imported Work1 sample. The PC must stay awake and the launcher window must remain open while customers use it. No public deployment, firewall change or router change is performed by this launcher.

## Start on the shop Wi-Fi

1. Complete the existing Node/dependency setup in `README.md` once. Connect the PC and test phone to the same trusted shop network. Guest Wi-Fi with client isolation will not reach the PC.
2. Double-click **`Start-Shop.cmd`**. With one active private IPv4 address it selects that address. With several it lists them and asks for the shop address, so a VPN/virtual adapter is not silently chosen.
3. On a new database, choose the owner username and a password of at least 12 characters. Both password entries are masked. Existing accounts are retained. There is no supplied password or automatically imported sample order.
4. Open the **exact staff address printed by the launcher**, sign in and choose **New order**. Select a model and expected number of recipients. After **Create order**, the staff screen displays a QR and **Copy link**. Have the customer scan the QR with the phone camera, or send the copied link. For an existing order select **Share order link / QR** to issue a fresh organiser or helper link. Use the printed LAN address on the PC too; `localhost` is a different origin and is not the phone's route to the PC.

For this workstation, the Wi-Fi adapter reported **`<SHOP_LAN_IP>`** on 24 November 2026. Its tested preflight staff address was **http://<SHOP_LAN_IP>:3000/staff**. That address may change after reconnecting; use the address printed at each start. Reserve the PC's address in the shop router before regular use.

Commands from the project directory:

```powershell
# Fresh shop store, with explicit address if required:
.\Start-Shop.cmd -Address <SHOP_LAN_IP>

# Imported Work1 sample, preserving its existing data and accounts:
.\Start-Shop.cmd -Work1 -Address <SHOP_LAN_IP>

# Inspect dependencies, selected data, locks and listening ability only:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-shop.ps1 -CheckOnly

# Deliberately select a different existing or recovered store:
.\Start-Shop.cmd -DataDirectory 'C:\path\to\recovered-data' -Address <SHOP_LAN_IP>
```

`-DataDirectory` is explicit and mutually exclusive with `-Work1`. A relative path resolves from the project directory. To use the original development database deliberately, specify `-DataDirectory .\data`; it contains earlier test orders. `-Port 3001` selects another port, which becomes part of every generated link. Do not run two processes against the same data store.

The launcher ignores `.env`, sets `HOST` to the selected private IPv4 address, `PORT` to 3000 unless overridden, and `BASE_URL` to that exact HTTP origin. It does not bind all adapters or accept a public/loopback/nonlocal address. It uses installed Node/dependencies, requires Node 24.22.3 or newer within 24.x, and makes no package downloads. Rendering is restricted to local assets. It restores its caller's process environment on exit.

Web output stays in the foreground; the worker starts hidden and writes logs in the selected store's `logs/` directory. No password or customer token is written by the launcher. Press **Ctrl+C** and let the window finish to stop the web process and its worker. Interrupted jobs remain durable. The launcher refuses live server/worker/maintenance locks and an occupied address/port; it does not stop someone else's service or delete locks.

`Start-Work1.cmd` remains the **PC-only** Work1 entry point at `http://localhost:3000/staff`. Stop it before opening the same Work1 store with `Start-Shop.cmd -Work1`.

## Reach the PC from a phone

The launcher checks local binding, which does not prove that Windows Firewall or the router allows a phone through. On the trusted shop network, the Windows network profile should be **Private**. If Windows asks about Node access, select the private network only. Do not enable public-network access for this local test.

An operator with Windows administrator access can create a narrowly scoped inbound rule after verifying the address and profile. This is an example to run in an elevated PowerShell window, **not an action performed by the launcher**:

```powershell
New-NetFirewallRule -DisplayName 'Trichur Trophies shop LAN' `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
  -LocalAddress <SHOP_LAN_IP> -RemoteAddress LocalSubnet -Profile Private
```

Change the address/port to the printed values. An existing restrictive organisational policy may still block it. Do not add router port forwarding for this LAN test. Remove the named rule when retiring this test:

```powershell
Remove-NetFirewallRule -DisplayName 'Trichur Trophies shop LAN'
```

If the phone cannot connect, check the printed address, same Wi-Fi/subnet, PC sleep, private firewall profile and client isolation. Test the staff page before handling an order link; no credentials need to be entered for this connectivity check. A successful `/api/health` response shows web reachability, not a functioning worker or printer. Prove worker operation by generating a real proof.

## Staff access and customer links

| Address or link | Audience and capability |
| --- | --- |
| `/staff` | Staff sign-in. Owner/production roles govern staff operations. Never share staff passwords with customers. |
| Organiser link from an order | Private access to that order's entries, shared wording, checking and final approval. |
| Scoped helper link from a group | Private access limited to its assigned group; does not grant staff or final organiser approval rights. |

Staff and customer pages use the same server; `/staff` is protected by authentication, not a separate secret network. Anyone who receives a customer link can exercise its scope until it expires or is revoked. Share it only with the intended recipient. Do not post links in public groups or screenshots. Issue/revoke them from the order screen. Switching customer and staff roles in one browser changes the session; use separate browser profiles/devices or sign in again.

Use the configured origin consistently. If the PC address/domain changes, restart with the correct origin and copy fresh links from staff; previously shared URLs still point at their old host. Revocation is needed if a private token was exposed. Browser drafts are scoped to the origin, so finish syncing local drafts before changing addresses, schemes or ports. A draft saved under `http://localhost:3000` will not automatically appear under a LAN IP or HTTPS domain.

## HTTP testing, installation and offline work

LAN HTTP can test ordinary entry, upload, persistence, proof generation and approval while connected. It does not encrypt names, photos, passwords or sessions over the network. Use synthetic samples for this stage. Use a trusted HTTPS hostname for actual customer deployment.

Service workers require a secure origin. The special localhost allowance applies to the same computer, **not** to `http://192.168...` on a phone. On LAN HTTP, browser-installed PWA/offline-navigation support is unavailable; a home-screen shortcut alone does not change that. Use the standard browser page for the LAN test.

On the HTTPS deployment, open a private customer link in the normal browser and wait for the application to load. The collapsed **App and order help** section gives bilingual Android Chrome and iPhone Safari installation guidance. A native install button appears only when the browser offers that capability. Use the browser's install/add-to-home-screen action when supported. Installation is optional; the website remains usable. Test both Android Chrome and iPhone Safari on the actual devices before promising installation behavior.

The installed app opens the neutral home page, without embedding a private order token in its manifest or shortcut. Reopen the original private link or paste a same-shop order link into App and order help. The re-entry control does not create a new order or persist the pasted token.

Offline support is deliberately limited: saved browser drafts and photographs stay in IndexedDB on that device/origin; the service worker caches application assets, not private API responses, server proofs or uploaded media. Cached order metadata allows already-opened work to reopen when supported. New uploads, server proofs, approval, sign-in/link exchange and PDF generation require the server. Reconnect and confirm the saved/synced status before relying on a draft. Clearing site data, private-browsing disposal or device loss can remove unsynced drafts. Application updates preserve IndexedDB; follow the app's update prompt after current work is saved.

## Optional public domain with HTTPS

The supplied `compose.yaml` uses a separate persistent Docker volume, not `data/shop` or `data/work1`. Its application port is published only on the host's loopback interface. `compose.https.yaml` adds Caddy on ports 80/443, sets **the same `https://DOMAIN` origin for web and worker**, and waits for the web health check. Node remains private behind the proxy. This is an operator deployment procedure, not an already running public service.

Use a maintained Docker host and a domain you control. Point its public DNS A/AAAA records at that host and ensure 80/443 reach Caddy. Remove a stale AAAA record that points elsewhere. Caddy's certificate storage must remain persistent. A private-only LAN HTTPS domain needs separately configured DNS validation or an appropriately managed trusted certificate; this stock image/config does not implement your DNS-provider challenge. Do not ask customers to bypass certificate errors or install an ad-hoc root certificate.

On the chosen host, copy `deploy/production.env.example` to `.env.production`, then replace the example hostname in both `DOMAIN` and `BASE_URL`. `DOMAIN` has no scheme or path; `BASE_URL` is exactly `https://` plus that hostname. Never put staff passwords into this file. These commands use the same Compose project and environment file throughout:

```text
docker compose --env-file .env.production -f compose.yaml -f compose.https.yaml config
docker compose --env-file .env.production -f compose.yaml -f compose.https.yaml build
docker compose --env-file .env.production -f compose.yaml -f compose.https.yaml run --rm --no-deps web node scripts/migrate.js
docker compose --env-file .env.production -f compose.yaml -f compose.https.yaml run --rm --no-deps web node scripts/admin.js --username owner
docker compose --env-file .env.production -f compose.yaml -f compose.https.yaml up -d
```

The admin CLI prompts for a password with terminal echo suppressed. No default password is created. For automation, its `--password-env NAME` option can receive a transient operator-provided secret; do not store it in the source or command argument.

The build needs package/browser download access. Inspect `config` before startup: `BASE_URL` must be the public HTTPS origin, both services must mount the same `/app/data` volume, and the web application port must remain loopback-published. The configured limits are explicitly passed to both services. Docker build context excludes `.env*`, private data, Work1 source photos/output, original references and delivery archives; only deliberately prepared template assets are included.

Confirm a valid browser padlock, HTTP-to-HTTPS redirect, staff login and a fresh private customer link. Check that the session cookie is `Secure`, that another unauthenticated browser cannot fetch a private photo/proof/PDF, and that a real uploaded entry can produce a proof and approved diagnostic A3 PDF. Customer-device installation, offline reopening/update, server reboot recovery and physical printer calibration are separate checks. Never expose the raw Node port through a public router/firewall rule.

Docker was unavailable in this development environment; image build, Compose validation, TLS issuance and public transport remain host checks. The Compose changes were reviewed against their configured web/worker environment and official syntax; an independent YAML parser was also unavailable here. Pinned image/package versions are reproducible inputs, not a claim that they are the newest secure versions. Review and test updates before deployment.

## Back up the selected store

Stop **both web and worker** before backup; wait for the launcher to exit. Back up the database and private files together using `scripts/backup.js`, then copy the complete result to a protected second device. From a new PowerShell window in the project directory:

```powershell
$env:DATA_DIR = Join-Path (Get-Location) 'data\shop'
# For the imported sample, use data\work1 instead.
$backupDestination = Join-Path 'E:\TrichurBackups' (Get-Date -Format 'yyyyMMdd-HHmmss')
node scripts/backup.js $backupDestination
Remove-Item Env:DATA_DIR
```

Replace `E:\TrichurBackups` with an available protected backup location outside the chosen data directory. The backup destination must be new. If you deliberately back up the original parent `data` directory, stop **all nested stores**, including Shop and Work1, because that backup recursively includes them. Prefer backing up the selected `data/shop` or `data/work1` store individually.

Restore into a new directory and verify before switching:

```powershell
node scripts/restore.js 'E:\TrichurBackups\BACKUP-NAME' 'C:\TrichurRecovery\shop-check'
.\Start-Shop.cmd -DataDirectory 'C:\TrichurRecovery\shop-check' -Port 3001
```

Do not overwrite a live directory or run two workers on the same database. For an existing approved order, `scripts/verify-restored-instance.js` verifies authenticated recovered photo/artwork/PDF routes; see `BACKUP_RESTORE.md` for full backup, Docker, integrity, restore and retention instructions. In Docker, use the same `--env-file` and both `-f` arguments when stopping services or running backup; keep the proxy stopped during maintenance too. Never use `docker compose down -v` against the production store.

## Verification recorded on this workstation

On 24 November 2026, the PowerShell parser and real `-CheckOnly` runs passed for fresh `data/shop` and existing `data/work1`, using Node/dependencies already installed and an exclusive, immediately released bind to `<SHOP_LAN_IP>:3000`. The fresh Shop directory remained absent after preflight. No account, order, database, background service, firewall rule or router configuration was created by those checks. Further negative preflight checks and their exact outcomes are recorded in `artifacts/shop-hosting-check.json`.

This proves launcher preflight and local port binding. It does not claim actual phone-to-PC reachability, HTTPS/PWA installation, Docker execution, unattended service startup or print-device calibration. Those require the shop hardware/host checks above.

Implementation references checked: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Docker environment settings](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) and [Compose health dependencies](https://docs.docker.com/reference/compose-file/services/#depends_on).

A separate self-request to the bound Wi-Fi address timed out from the managed test session. The operator can repeat the disposable LAN check with `node scripts/check-shop-lan.js YOUR_PC_PRIVATE_IPV4`; the result is written to `artifacts/shop-qa/lan-transport.json`. A physical phone on the shop Wi-Fi is the final connectivity test.
