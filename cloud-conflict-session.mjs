/**
 * Pure state transitions for explicit two-device cloud-conflict resolution.
 * Persistence and network operations deliberately live outside this module.
 */
const clone = value => structuredClone(value);

function assertParticipant(session, deviceId) {
  if (!session || !Array.isArray(session.devices) || !session.devices.some(device => device.id === deviceId)) {
    throw new Error('Unknown conflict participant');
  }
}

export function createConflictSession({ id, devices, createdAt }) {
  if (!id || !Array.isArray(devices) || devices.length !== 2) {
    throw new Error('A conflict requires an id and exactly two devices');
  }
  const [first, second] = devices;
  if (!first?.id || !second?.id || first.id === second.id) {
    throw new Error('Conflict devices must have distinct ids');
  }
  if (!('snapshot' in first) || !('snapshot' in second)) {
    throw new Error('Both complete device snapshots are required');
  }
  return {
    id,
    status: 'open',
    createdAt: createdAt || new Date().toISOString(),
    devices: devices.map(device => ({
      id: String(device.id),
      label: String(device.label || device.id),
      capturedAt: String(device.capturedAt || createdAt || ''),
      snapshot: clone(device.snapshot)
    })),
    selectedDeviceId: null,
    resolvedSnapshot: null,
    selectedAt: null,
    confirmations: {}
  };
}

export function selectConflictVersion(session, deviceId, selectedAt) {
  if (session.status !== 'open') throw new Error('Conflict is not open for selection');
  assertParticipant(session, deviceId);
  const selected = session.devices.find(device => device.id === deviceId);
  return {
    ...clone(session),
    status: 'selected',
    selectedDeviceId: deviceId,
    resolvedSnapshot: clone(selected.snapshot),
    selectedAt: selectedAt || new Date().toISOString(),
    confirmations: {}
  };
}

export function confirmConflictVersion(session, deviceId, confirmedAt) {
  if (session.status !== 'selected') throw new Error('A version must be selected before confirmation');
  assertParticipant(session, deviceId);
  const confirmations = {
    ...session.confirmations,
    [deviceId]: confirmedAt || new Date().toISOString()
  };
  const bothConfirmed = session.devices.every(device => Boolean(confirmations[device.id]));
  return {
    ...clone(session),
    confirmations,
    status: bothConfirmed ? 'resolved' : 'selected',
    resolvedAt: bothConfirmed ? (confirmedAt || new Date().toISOString()) : null
  };
}
