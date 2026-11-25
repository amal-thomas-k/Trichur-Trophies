# Coordinated backup and restore

Back up the database **and all private files together**. The database contains the order history, template versions, approvals and artifact references; the files contain original uploads and canonical artwork. One without the other is insufficient.

The supplied scripts perform a stopped-service backup. They refuse running web/worker PID locks, create a maintenance lock, checkpoint SQLite WAL, copy private files and verify SHA-256 hashes. They never delete the live directory. Restore verifies every manifest entry and database integrity before a recovered instance is used; it refuses to overwrite a nonempty destination.

## Windows / native Node

Stop both server and worker. Check no other process is using the same `DATA_DIR`. In the project directory:

```powershell
node --env-file-if-exists=.env scripts/backup.js <WORKSPACE>\tt-backups\2026-11-20
```

The target must be a new path outside `DATA_DIR`. Keep the generated `manifest.json` and `data/` directory together. Copy the complete backup to another physical device or protected backup service; leaving the only backup on the same disk does not protect against disk failure.

To verify a recovery without overwriting live work:

```powershell
node scripts/restore.js <WORKSPACE>\tt-backups\2026-11-20 <WORKSPACE>\tt-restore-check
```

The repeatable application recovery check accepts an approved order ID:

```text
node scripts/verify-restored-instance.js RESTORED_DATA_DIRECTORY ORDER_ID artifacts/restore-verification.json
```

If the test environment blocks localhost sockets, append `--in-process`. This calls the actual server authorization/file handlers using Node request/response streams against the restored database and files. It proves the returned bytes and permission checks, but does **not** claim HTTP network transport or a browser/device test. The supplied `artifacts/restore-verification.json` records which transport was used.

Start a clean instance with the restored `DATA_DIR` and a different port, or retire the original instance while testing. The restore writes a local path map so historical absolute asset references resolve inside the new data directory; immutable approval JSON and its hashes are not rewritten. Confirm staff sign-in, order quantities, source photos, canonical proofs, approval history and export download. Do not assume a hash-only check proves every business workflow. See `TEST_REPORT.md` for the recovery test actually performed.

## Docker

Run the backup with both services stopped. Mount an operator-selected backup directory into a one-off container using the same Compose volume:

```text
docker compose stop web worker
docker compose run --rm --user root -v /absolute/backup-directory:/backup web node scripts/backup.js /backup/2026-11-20
docker compose up -d
```

Adjust host path syntax for Windows. Restrict host directory permissions and correct ownership before restoring as the container's non-root user. A fresh restore volume must be empty. Do not use a restore command against the live volume; make a separate verification volume/instance, test it and deliberately switch over. Container commands require validation on the Docker host; Docker was unavailable during implementation.

## Retention and handling

Backups contain customer photographs, names, hashed credentials, approval records and private links/session data. Restrict access, encrypt stored backups using your operating system or backup service, and protect recovery keys separately. Test a restore periodically and before deleting old backup generations.

The retention command is deliberate and offline; no automatic deletion runs in the background. `RETENTION_DAYS` defaults to **365**. The owner must first archive an order in the staff interface. Archiving revokes its customer links and is refused while jobs are queued/running. Reopening retains history but does not reactivate revoked links; issue a new private link if needed.

With web and worker stopped, review the proposed cleanup:

```text
node --env-file-if-exists=.env scripts/retention.js --days 365
```

This is a dry run. Only explicitly archived orders whose archive date and latest audit activity are both older than the cutoff, with no pending jobs, become candidates. Existing approvals and their referenced assets/artifacts remain until that condition is met. Make and verify a fresh backup, review the candidate list, and only then deliberately apply the same policy:

```text
node --env-file-if-exists=.env scripts/retention.js --days 365 --apply
```

Applied deletion is permanent in the live instance; recovery requires a retained backup. The command records its report in `DATA_DIR/retention-log.jsonl`. Failed file removal is reported as unreferenced private files requiring operator attention. Backups are not deleted by retention; manage their own retention/encryption policy separately. The operator must agree the period and applicable business/legal requirements before applying cleanup. Use disk-space reporting in staff operations and monitor the volume through the host OS.

An unexpected maintenance lock may indicate a backup interrupted before it finished. Confirm that its recorded process is no longer running, preserve partial backup evidence, and remove only that stale lock after inspection. Never remove a live lock to force a backup.

## Recovery checklist

- Manifest checks pass and `integrity_check` returns `ok`.
- Staff can sign in with existing credentials.
- Expected orders, groups, revisions, recipient counts and source images are present.
- Current and historic approval references remain intact.
- At least one proof and its canonical artwork hash match the prior instance.
- The corresponding generated PDF and placement manifest can be downloaded through authenticated routes.
- Pending work recovers under the worker without duplicate pieces.
- The restored base URL, hostname, HTTPS and printer configuration match the recovery environment.
