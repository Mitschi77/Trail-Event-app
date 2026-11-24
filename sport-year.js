(function (root) {
  'use strict';

  const DEFAULT_BACKYARD_LAP_KM = 6.7;

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeCatalogEntry(entry) {
    if (!entry || typeof entry !== 'object') throw new TypeError('Sport-Katalogeintrag fehlt.');
    const code = cleanText(entry.code);
    const name = cleanText(entry.name);
    if (!code || !name) throw new TypeError('Sport-Katalogeintrag benötigt code und name.');
    return {
      id: cleanText(entry.id) || code,
      code,
      name,
      parentId: cleanText(entry.parentId) || null,
      category: cleanText(entry.category) || null,
      isSystem: entry.isSystem === true,
      isActive: entry.isActive !== false,
      metadata: entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
        ? { ...entry.metadata } : {}
    };
  }

  function normalizeSegment(segment, index) {
    if (!segment || typeof segment !== 'object') throw new TypeError('Segment muss ein Objekt sein.');
    const durationSeconds = segment.durationSeconds == null ? null : Number(segment.durationSeconds);
    if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) {
      throw new RangeError('Segmentdauer muss eine nichtnegative Zahl sein.');
    }
    const distance = segment.distance == null ? null : Number(segment.distance);
    if (distance !== null && (!Number.isFinite(distance) || distance < 0)) {
      throw new RangeError('Segmentdistanz muss eine nichtnegative Zahl sein.');
    }
    return {
      id: cleanText(segment.id) || 'segment-' + (index + 1),
      sequence: Number.isInteger(segment.sequence) && segment.sequence > 0 ? segment.sequence : index + 1,
      sportCode: cleanText(segment.sportCode) || null,
      segmentType: cleanText(segment.segmentType) || 'other',
      name: cleanText(segment.name) || null,
      distance,
      distanceUnit: cleanText(segment.distanceUnit) || null,
      durationSeconds,
      result: segment.result && typeof segment.result === 'object' && !Array.isArray(segment.result)
        ? { ...segment.result } : {}
    };
  }

  function normalizeActivity(activity) {
    if (!activity || typeof activity !== 'object') throw new TypeError('Aktivität muss ein Objekt sein.');
    const result = activity.result && typeof activity.result === 'object' && !Array.isArray(activity.result)
      ? { ...activity.result } : {};
    const metadata = activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
      ? { ...activity.metadata } : {};
    const numeric = (value, label) => {
      if (value == null || value === '') return null;
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new RangeError(label + ' muss eine nichtnegative Zahl sein.');
      return number;
    };
    const startsAt = cleanText(activity.startsAt) || null;
    const endsAt = cleanText(activity.endsAt) || null;
    if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
      throw new RangeError('Das Ende darf nicht vor dem Beginn liegen.');
    }
    return {
      id: cleanText(activity.id) || null,
      sportCode: cleanText(activity.sportCode) || null,
      disciplineCode: cleanText(activity.disciplineCode) || null,
      activityType: cleanText(activity.activityType) || 'activity',
      title: cleanText(activity.title) || 'Aktivität',
      startsAt,
      endsAt,
      location: cleanText(activity.location) || null,
      distanceKm: numeric(activity.distanceKm, 'Distanz'),
      elevationGainM: numeric(activity.elevationGainM, 'Höhenmeter'),
      durationSeconds: numeric(activity.durationSeconds, 'Dauer'),
      status: cleanText(activity.status) || 'planned',
      catalogEventId: cleanText(activity.catalogEventId) || null,
      catalogRouteId: cleanText(activity.catalogRouteId) || null,
      result,
      metadata,
      segments: Array.isArray(activity.segments) ? activity.segments.map(normalizeSegment).sort((a, b) => a.sequence - b.sequence) : []
    };
  }

  function normalizeBackyardResult(input) {
    if (!input || typeof input !== 'object') throw new TypeError('Backyard-Ergebnis fehlt.');
    const rounds = Number(input.rounds);
    const lapLengthKm = input.lapLengthKm == null ? DEFAULT_BACKYARD_LAP_KM : Number(input.lapLengthKm);
    if (!Number.isInteger(rounds) || rounds < 0) throw new RangeError('Rundenanzahl muss eine ganze Zahl ab 0 sein.');
    if (!Number.isFinite(lapLengthKm) || lapLengthKm <= 0) throw new RangeError('Rundenlänge muss größer als 0 sein.');
    const lapTimesSeconds = Array.isArray(input.lapTimesSeconds) ? input.lapTimesSeconds.map(Number) : [];
    if (lapTimesSeconds.some(value => !Number.isFinite(value) || value < 0)) {
      throw new RangeError('Rundenzeiten müssen nichtnegative Zahlen sein.');
    }
    return {
      format: 'backyard',
      rounds,
      lapLengthKm,
      totalDistanceKm: Number((rounds * lapLengthKm).toFixed(3)),
      lapTimesSeconds,
      outcome: cleanText(input.outcome) || 'in_progress',
      eliminatedAfterRound: input.eliminatedAfterRound == null ? null : Number(input.eliminatedAfterRound)
    };
  }

  function summarizeActivity(activity) {
    const normalized = normalizeActivity(activity);
    // Segmente sind Bestandteile einer Aktivität und werden nie zusätzlich zur Aktivität summiert.
    return {
      id: normalized.id,
      sportCode: normalized.sportCode,
      activityType: normalized.activityType,
      title: normalized.title,
      durationSeconds: normalized.durationSeconds,
      distanceKm: normalized.distanceKm,
      elevationGainM: normalized.elevationGainM,
      segmentCount: normalized.segments.length,
      status: normalized.status
    };
  }

  const api = Object.freeze({
    DEFAULT_BACKYARD_LAP_KM,
    normalizeCatalogEntry,
    normalizeSegment,
    normalizeActivity,
    normalizeBackyardResult,
    summarizeActivity
  });

  root.SportYear = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
