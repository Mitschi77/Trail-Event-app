/**
 * Pure state machine for lossless two-device conflict resolution.
 * This module never persists data or performs network writes.
 */
const clone = value => structuredClone(value);

function assertSession(session) {
  if (!session || !Array.isArray(session.devices) || session.devices.length !== 2) {
    throw new Error('Invalid conflict session');
  }
  if (new Set(session.devices.map(device => device.id)).size !== 2) {
    throw new Error('Conflict participants must be unique');
  }
}
function assertParticipant(session, deviceId) {
  assertSession(session);
  if (!session.devices.some(device => device.id === deviceId)) {
    throw new Error('Unknown conflict participant');
  }
}
function assertSnapshot(snapshot) {
  if (snapshot === undefined) throw new Error('A complete snapshot is required');
  return clone(snapshot);
}

export function createConflictSession({ id, devices, createdAt }) {
  if (!id || !Array.isArray(devices) || devices.length !== 2) {
    throw new Error('A conflict requires an id and exactly two devices');
  }
  if (devices.some(device => !device?.id) || devices[0].id === devices[1].id) {
    throw new Error('Conflict devices must have distinct ids');
  }
  const timestamp = createdAt || new Date().toISOString();
  const session = {
    id: String(id),
    status: 'open',
    createdAt: timestamp,
    devices: devices.map(device => ({
      id: String(device.id),
      label: String(device.label || device.id),
      capturedAt: String(device.capturedAt || timestamp),
      snapshot: assertSnapshot(device.snapshot)
    })),
    selectedDeviceId: null,
    resolvedSnapshot: null,
    selectedAt: null,
    confirmations: {}
  };
  assertSession(session);
  return session;
}

export function selectConflictVersion(session, deviceId, selectedAt) {
  assertParticipant(session, deviceId);
  if (session.status !== 'open') throw new Error('Conflict is not open for selection');
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
  assertParticipant(session, deviceId);
  if (session.status !== 'selected') throw new Error('A version must be selected before confirmation');
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

/** Only a fully confirmed session may expose a snapshot for cloud publication. */
export function getPublishableConflictSnapshot(session) {
  assertSession(session);
  if (session.status !== 'resolved' || !session.devices.every(device => Boolean(session.confirmations?.[device.id]))) {
    throw new Error('Conflict requires confirmation from both devices');
  }
  return clone(session.resolvedSnapshot);
}
