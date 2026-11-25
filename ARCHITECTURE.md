# Architecture and invariants

The delivered application is a modular Node.js 24 service with static ES-module customer/staff UI and a separate render/export worker. Private filesystem storage and SQLite WAL persist the work on a single shop server. See `README.md` for the default-stack deviation and `TEST_REPORT.md` for measured verification.

## Components

| Component | Responsibility |
| --- | --- |
| `public/` | Bilingual mobile entry, IndexedDB drafts, static-only versioned service worker, staff operations and proof review. |
| `src/server.js` | Authentication, scoped order access, CSRF-protected mutations, upload decoding and authorized downloads. |
| `src/domain.js` | Revision checks, order/template rules, snapshots, approval and production gates. |
| `src/db.js`, `migrations/001_initial.sql` | SQLite schema migration, foreign keys and immediate transactions. |
| `src/worker.js` | Durable job claim/lease/recovery, bounded rendering/export and artifact publication. |
| `src/render.js` | Font-loaded Chromium text/photo artwork, exact canonical PNG and PDF embedding. |
| `src/packing.js` | Millimetre packing and placement validation. |
| `scripts/backup.js`, `scripts/restore.js` | Coordinated offline backup and verified restoration into a clean directory. |

## Data model

| Record | Meaning |
| --- | --- |
| Users / sessions | Admin and production roles, password hashes, expiring sessions and CSRF values. |
| Templates / calibrations | Immutable version documents, sealed prepared-asset hashes and separate model/profile physical validation records. |
| Orders / groups | Shared wording, current order revision, assigned immutable templates and expected recipient counts. |
| Recipients / recipient revisions | Stable photo/name identity, copy count, crop, current revision and historical inputs. |
| Assets | Private original/normalized media metadata, content hash and idempotent recipient-bound upload identifier. |
| Links | Hashed high-entropy credentials, organiser/helper role, order/group scope, expiry and revocation. |
| Proofs | Current-revision canonical artwork references, hashes and render configuration. |
| Approvals | Immutable full-order snapshots binding source, fields, crops, groups, copy counts and canonical proof hashes. |
| Jobs / print jobs | Queue state independent from order approval, output generation/release/printing and supersession. |
| Audit / settings | Actor/time history and explicit profile configuration. |

An entry's completeness, its review, the order's approval and the print job's state are distinct. Recipient count, copies and printed component count are distinct: two copies of a front/base pair make four pieces.

## Authoritative rendering

The server accepts decoded media, normalizes orientation and retains the full-resolution source privately. An immutable render-job snapshot captures the recipient revision, shared content, immutable template version, source hash and crop transform. Chromium shapes complete Unicode strings with local licensed fonts and waits for font readiness. Text fitting respects the configured minimum; overflow fails rather than silently truncating a name.

The high-resolution lossless PNG is canonical artwork. The customer proof displays that asset. Approval binds its hash; the PDF embeds those same bytes at the recorded millimetre dimensions. PDF creation never reconstructs text in a different font renderer. Raster rounding affects sampling by at most a pixel; PDF placement remains exact in millimetres through `72 / 25.4` points per mm.

SVG/custom decorative content must be prepared and validated through the template setup route. Rendering must not fetch arbitrary input URLs. Current demonstration templates are not representations of unsupported original PSD effects. Curved Malayalam feasibility evidence does not replace a Malayalam-reader quality check.

## Transactions and stale work

Updates carry the expected recipient/order revision. A conflicting update is rejected instead of overwriting another editor. Stable recipient/upload IDs make retries idempotent. Proof publication verifies the current revision; a late result cannot become a newer entry's proof.

Final approval executes in an immediate transaction and verifies quantities, completeness and current reviewed proofs. Changes invalidate current final approval and affected reviews. Old approvals remain in history. Exports consume the immutable approved snapshot, and obsolete output is superseded so it cannot be released as the current production job.

Jobs run outside browser/request lifetimes. The worker claims bounded work transactionally, records a lease and progress, retries transient failures up to the configured attempt limit, and recovers expired leases after a restart. Interactive proof priority includes batch fairness. Only complete artifacts are published. Queue cancellation and manual print release are separate actions.

## Security boundary

The URL fragment initially carries the private order credential; exchange establishes an order-scoped session. Tokens are random and stored hashed. Every order/media/artwork/export operation must recheck its scope; revocation takes effect server-side. Helpers contribute only within assigned scope and cannot approve common wording. Staff roles are checked server-side. Password hashing uses Node's scrypt, with per-password salts.

All mutation routes use session/CSRF protection. Do not expose raw `data/`, reference originals or a database port through the reverse proxy. Customer photos are never sent to an external AI provider. Backups contain personal data and credentials and need restricted, encrypted storage at the operator level.

The application is for one host and local storage. SQLite WAL is not a multi-host database; network shares and independently replicated web containers are unsupported. Docker configuration, HTTPS DNS/certificate setup and actual phone/printer tests require deployment-host verification.
