# Integration contract: lossless two-device cloud conflicts

Status: implementation foundation only. The existing application UI and persistence flow have not yet been wired to this module.

## User-visible defect to eliminate

When the iPhone and iPad have diverged, the generic action 'Cloud-Version auf dieses Gerät übernehmen' can replace the local-only variant on the other device. A conflict stop is not sufficient if a later action silently discards one side.

## Non-negotiable safety rules

1. Freeze automatic cloud reads, writes, retries and queued saves as soon as a conflict is detected.
2. Capture the complete local snapshot and the complete current cloud snapshot into separate IndexedDB slots (conflict-local and conflict-cloud) before showing any resolution action.
3. Do not overwrite either saved snapshot during the same conflict. Keep the conflict open if either backup fails.
4. Show both versions, device labels and capture timestamps. Do not describe one side as newer unless timestamps prove it.
5. Require an explicit source choice. A generic 'use cloud' action must never run as an implicit resolution.
6. Require confirmation from both participating devices for the selected version.
7. Only call getPublishableConflictSnapshot() after the session is resolved. Publish with an optimistic concurrency condition against the exact cloud updated_at that was reviewed.
8. If the cloud version changed again before publication, do not publish. Capture the new cloud version as a new conflict revision and ask for a new decision.
9. Keep the conflict state and both snapshots if a device is offline, closes the app, or fails to confirm.
10. Never automatically merge same-field conflicts or clear the conflict after only one device confirms.

## Integration sequence in the app

1. Replace the current conflict action handlers with a conflict-session coordinator using cloud-conflict-session.mjs.
2. On detection, set cloudReady = false, clear cloud timers and pending saves, capture both complete snapshots to separate IndexedDB slots, then render the conflict view.
3. Replace the two current one-click actions with explicit source selection and a separate confirmation step on each device.
4. Keep both local and remote snapshots read-only while the conflict is open.
5. On each confirmation, persist the updated conflict session. Do not enable writes until both confirmations are present.
6. Before publishing, re-read planner_data and compare its updated_at with the reviewed cloud version. Abort and reopen conflict on mismatch.
7. After a successful conditional write, update the cloud baseline on both devices and only then resume polling/saving.
8. If one device cannot reconnect, retain the conflict and backups; never infer confirmation from timeout.

## Test matrix required before release

- iPhone-only edits survive conflict detection and remain downloadable.
- iPad/cloud-only edits survive conflict detection and remain downloadable.
- Selecting either version does not mutate either preserved snapshot.
- One device confirmation cannot publish or resume sync.
- Both confirmations permit one conditional publish.
- A second cloud update between review and publish aborts publication.
- Backup failure hides resolution controls and leaves sync frozen.
- App restart restores the open conflict and both backup slots.
- Offline device retains its local snapshot and cannot auto-upload after reconnect.
- Duplicate, unknown or stale participant confirmations are rejected.
- A new conflict revision invalidates prior confirmations.

## Current repository state

- cloud-conflict-session.mjs provides pure state transitions and blocks publication until both participants confirm.
- scripts/test-cloud-conflict-session.mjs covers independent snapshot retention, explicit selection, dual confirmation and invalid transitions.
- package.json includes the new test in test:syntax.
- Integration into index.html is still pending. The GitHub file-content endpoint returned an empty body for that large file even when requesting ranges, so no speculative rewrite was attempted.
- No production deployment, merge or database change was made.