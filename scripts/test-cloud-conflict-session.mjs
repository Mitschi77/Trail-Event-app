import assert from 'node:assert/strict';
import {
  createConflictSession,
  selectConflictVersion,
  confirmConflictVersion,
  getPublishableConflictSnapshot
} from '../cloud-conflict-session.mjs';

const iphone = { planner: { note: 'iPhone-only edit' }, routes: ['A', 'B'] };
const ipad = { planner: { note: 'iPad edit' }, routes: ['A', 'C'] };
const session = createConflictSession({
  id: 'conflict-1',
  createdAt: '2026-11-23T08:00:00.000Z',
  devices: [
    { id: 'iphone', label: 'iPhone', snapshot: iphone },
    { id: 'ipad', label: 'iPad', snapshot: ipad }
  ]
});

// Both snapshots are independent copies; later mutation cannot erase either.
iphone.planner.note = 'mutated after capture';
ipad.routes.push('D');
assert.deepEqual(session.devices[0].snapshot, { planner: { note: 'iPhone-only edit' }, routes: ['A', 'B'] });
assert.deepEqual(session.devices[1].snapshot, { planner: { note: 'iPad edit' }, routes: ['A', 'C'] });
assert.throws(() => getPublishableConflictSnapshot(session), /both devices/);

// A deliberate choice copies one complete snapshot, retaining the other as evidence.
const selected = selectConflictVersion(session, 'iphone', '2026-11-23T08:01:00.000Z');
assert.equal(selected.status, 'selected');
assert.deepEqual(selected.resolvedSnapshot, session.devices[0].snapshot);
assert.deepEqual(selected.devices[1].snapshot, session.devices[1].snapshot);
assert.throws(() => selectConflictVersion(selected, 'ipad'), /not open/);

// One confirmation is insufficient; publication remains blocked.
const oneConfirmed = confirmConflictVersion(selected, 'iphone', '2026-11-23T08:02:00.000Z');
assert.equal(oneConfirmed.status, 'selected');
assert.throws(() => getPublishableConflictSnapshot(oneConfirmed), /both devices/);

// Only after the second device confirms may the chosen snapshot be published.
const resolved = confirmConflictVersion(oneConfirmed, 'ipad', '2026-11-23T08:03:00.000Z');
assert.equal(resolved.status, 'resolved');
assert.deepEqual(getPublishableConflictSnapshot(resolved), session.devices[0].snapshot);
assert.deepEqual(resolved.devices[1].snapshot, session.devices[1].snapshot);

// Reject unknown devices, duplicate participants, missing snapshots and invalid transitions.
assert.throws(() => selectConflictVersion(session, 'unknown'), /Unknown conflict participant/);
assert.throws(() => confirmConflictVersion(session, 'iphone'), /must be selected/);
assert.throws(() => createConflictSession({
  id: 'bad', devices: [{ id: 'a', snapshot: {} }, { id: 'a', snapshot: {} }]
}), /distinct ids/);
assert.throws(() => createConflictSession({
  id: 'bad', devices: [{ id: 'a', snapshot: {} }, { id: 'b' }]
}), /complete snapshot/);
assert.throws(() => confirmConflictVersion(resolved, 'ipad'), /must be selected/);

console.log('Lossless two-device conflict state-machine tests passed.');
