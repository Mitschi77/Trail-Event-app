import assert from 'node:assert/strict';
import {
  createConflictSession,
  selectConflictVersion,
  confirmConflictVersion
} from '../cloud-conflict-session.mjs';

const iphoneSnapshot = { planner: { note: 'iPhone local edit' }, routes: ['A', 'B'] };
const ipadSnapshot = { planner: { note: 'iPad cloud edit' }, routes: ['A', 'C'] };
const session = createConflictSession({
  id: 'conflict-1',
  createdAt: '2026-11-23T08:00:00.000Z',
  devices: [
    { id: 'iphone', label: 'iPhone', capturedAt: '2026-11-23T07:59:00.000Z', snapshot: iphoneSnapshot },
    { id: 'ipad', label: 'iPad', capturedAt: '2026-11-23T07:59:30.000Z', snapshot: ipadSnapshot }
  ]
});

assert.equal(session.status, 'open');
assert.deepEqual(session.devices[0].snapshot, iphoneSnapshot);
assert.deepEqual(session.devices[1].snapshot, ipadSnapshot);

const selected = selectConflictVersion(session, 'iphone', '2026-11-23T08:01:00.000Z');
assert.equal(selected.status, 'selected');
assert.equal(selected.selectedDeviceId, 'iphone');
assert.deepEqual(selected.resolvedSnapshot, iphoneSnapshot);
assert.deepEqual(selected.devices[1].snapshot, ipadSnapshot);
assert.deepEqual(session.devices[0].snapshot, iphoneSnapshot);

const oneConfirmed = confirmConflictVersion(selected, 'iphone', '2026-11-23T08:02:00.000Z');
assert.equal(oneConfirmed.status, 'selected');
assert.equal(oneConfirmed.confirmations.iphone, '2026-11-23T08:02:00.000Z');
assert.equal(oneConfirmed.confirmations.ipad, undefined);

const resolved = confirmConflictVersion(oneConfirmed, 'ipad', '2026-11-23T08:03:00.000Z');
assert.equal(resolved.status, 'resolved');
assert.deepEqual(resolved.resolvedSnapshot, iphoneSnapshot);
assert.ok(resolved.confirmations.iphone && resolved.confirmations.ipad);

assert.throws(() => selectConflictVersion(session, 'unknown'), /Unknown conflict participant/);
assert.throws(() => selectConflictVersion(selected, 'ipad'), /not open/);
assert.throws(() => confirmConflictVersion(session, 'iphone'), /must be selected/);
assert.throws(() => createConflictSession({
  id: 'bad', devices: [{ id: 'iphone', snapshot: {} }], createdAt: ''
}), /exactly two devices/);

console.log('Cloud conflict-session state transition tests passed.');
