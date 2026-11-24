# Hosting handoff

This application needs a running server and private persistent storage. A purchased domain supplies its address; storage space alone does not run the application. The GitHub source does not include the shop's accounts, customer photographs, order database or Work1 practice portraits.

## For the shop owner

Choose where customers will use it:

| Use | What to arrange |
| --- | --- |
| Designer-room/shop Wi-Fi trial | Keep the Windows PC running, connect the phone to the same trusted network and start `Start-Shop.cmd`. No domain is needed. |
| Customers at home or on mobile data | Have the technician verify the existing hosting plan below, then deploy under a trusted HTTPS subdomain such as `orders.your-domain.example`. |

Give the technician the provider/plan name, domain name, appropriate provider access and backup destination. **Check the hosting already purchased before buying anything else.** A static-site or PHP-only plan cannot run this application. Storage-only service can hold protected backups but cannot replace the server.

Keep the current website and email working. Request a new order-app subdomain; do not replace the main website, change nameservers or remove email records just to add this application. Agree who maintains the server, updates it, monitors disk space and checks backups.

At the shop, double-click `Start-Shop.cmd`, create a staff account and open its printed address. It uses clean `data/shop`; `Start-Shop.cmd -Work1` selects the original PC's separate practice order. Create an order in `/staff` and share its private customer QR/link, never the staff password. Keep the PC awake. LAN HTTP is a trial mode without encryption or phone PWA/offline installation. Instructions: [Shop hosting](SHOP_HOSTING.md).

## For the technician

### Confirm the existing host's capabilities

| Required capability | Why it matters |
| --- | --- |
| Node.js 24.22.3 or newer within 24.x, or a Docker host using Linux containers | Runs the supplied backend; uploading files to a PHP/static web directory is not sufficient. |
| Persistent web and worker processes with restart management | Saving entries needs web; proofs/exports need the worker. Short-lived serverless execution alone is insufficient. |
| Headless Chromium, OS/native image libraries and bundled fonts | Produces actual Malayalam artwork. Installation needs package/browser download access. |
| Persistent local disk shared by both processes | SQLite/uploads/proofs/exports must survive updates and remain outside public web directories. |
| HTTPS proxy, DNS control and suitable upload/time limits | Protects customer data and enables supported PWA behavior. Default upload limit: 20 MB. |
| Adequate CPU/RAM/disk and a protected backup destination | Measure representative orders; a storage quota alone does not prove suitability. |

The implementation uses **Node, SQLite and a separate durable worker**, not PostgreSQL. Run one web/worker pair on one host with the same local volume: no SQLite network share, ephemeral filesystem or multiple replicas. No object-storage adapter is supplied. A shared-hosting plan advertising Node must still pass the other capability checks.

### Deploy without disturbing the existing site

1. Use the reviewed source revision and committed dependency lockfile. Keep real environment files, passwords, customer data and backups out of GitHub. A source checkout is not a data migration.
2. Record existing DNS. Add only the chosen subdomain's required A/AAAA or provider-directed CNAME. Preserve root/`www` and MX/TXT email records; publish AAAA only for working IPv6.
3. Follow [Shop hosting](SHOP_HOSTING.md#optional-public-domain-with-https) for Docker/Caddy commands. Copy `deploy/production.env.example` to `.env.production`; set `DOMAIN` to the hostname and `BASE_URL` to its exact HTTPS origin. Use the same environment file and both Compose files throughout.
4. Validate configuration, install dependencies/browser, migrate and create a unique staff account. No default password exists. The standalone admin CLI password prompt is visible; protect that terminal. The Windows launcher masks entry.
5. Keep Node private behind HTTPS. Caddy requires valid DNS and certificate-validation reachability on 80/443. Private-only HTTPS needs separate certificate/DNS validation; never bypass browser certificate errors.
6. Verify persistent storage, both processes, restart recovery and backups. Issue links after the final origin is correct; sync phone drafts before changing host/scheme/port.

For Windows LAN use, follow the documented Private-profile/LocalSubnet firewall setup if needed. `Start-Shop.cmd` changes no firewall/router settings, ignores `.env` and refuses occupied ports/live locks. Reserve the PC's LAN address. Keep the launcher open; it is not an unattended Windows service. Never publicly port-forward its raw HTTP port.

### Back up, restore and update

Stop web **and** worker. Run `scripts/backup.js` with `DATA_DIR` selecting the live store; copy its complete database/files/hash manifest to a protected second location. For normal Shop operation, select `data/shop`. Backing up parent `data` requires stopping every nested instance too.

Restore with `scripts/restore.js` into a new empty directory/volume. Verify integrity, staff access, orders and actual photo/proof/PDF downloads before switching; `scripts/verify-restored-instance.js` checks an approved order. Never overwrite live data or delete the production volume. Preserve Caddy's certificate volumes. [Backup and restore](../BACKUP_RESTORE.md) covers commands, protection and retention. Make and verify a backup before updates.

### Accept the installation

- On actual Android/iPhone hardware, open a private link; confirm staff authentication and denied anonymous file access.
- Choose a photo, paste Malayalam, reload/recover the draft, upload and inspect the real proof's spelling, pairing and crop.
- Approve the current revision; download the real A3 diagnostic PDF and verify quantities/manifest. Test a larger order and worker restart.
- Under HTTPS, test QR/camera/gallery, supported installation, offline reopening, reconnection and updates without draft loss.
- Restore a complete backup separately; verify files/routes and record the responsible person and backup schedule.
- Print at Actual Size; measure rulers/cut fit, check colour/media and obtain Malayalam-reader approval before recording calibration and releasing production.

## What has and has not been verified

Recorded software checks include native HTTP/browser order entry through approved PDF download, real worker rendering, draft recovery, secure-context service-worker lifecycle, exact 297 × 420 mm A3 dimensions and backup recovery. See [Shop QA](SHOP_QA.md) and [Test report](../TEST_REPORT.md) for evidence and scope. LAN-launcher preflight and local private-address binding passed without modifying order databases.

The existing hosting provider, purchased plan and domain configuration have **not** been inspected. No public deployment, DNS change, production Docker build or certificate issuance has been performed. Physical Android/iPhone installation, phone-to-shop connectivity, printer/cut calibration and fluent Malayalam-reader sign-off still require the actual devices and operators. Browser mobile emulation and correctly sized PDFs do not certify those checks.
