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

  function normalizeSegments(segments) {
    if (!Array.isArray(segments)) return [];
    const normalized = segments.map(normalizeSegment);
    const sequences = normalized.map(segment => segment.sequence);
    if (new Set(sequences).size !== sequences.length) throw new RangeError('Segment-Reihenfolge muss eindeutig sein.');
    return normalized.sort((a, b) => a.sequence - b.sequence);
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
    const segments = normalizeSegments(activity.segments);
    const segmentDistances = segments.filter(segment => segment.distance !== null);
    const derivedDistanceKm = segmentDistances.length
      ? Number(segmentDistances.reduce((sum, segment) => sum + segment.distance, 0).toFixed(3))
      : null;
    const startsAt = cleanText(activity.startsAt) || null;
    const endsAt = cleanText(activity.endsAt) || null;
    const startMs = startsAt ? Date.parse(startsAt) : null;
    const endMs = endsAt ? Date.parse(endsAt) : null;
    if (startMs !== null && !Number.isFinite(startMs)) throw new TypeError('Beginn ist kein gültiger Zeitpunkt.');
    if (endMs !== null && !Number.isFinite(endMs)) throw new TypeError('Ende ist kein gültiger Zeitpunkt.');
    if (startMs !== null && endMs !== null && endMs < startMs) {
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
      distanceKm: derivedDistanceKm !== null ? derivedDistanceKm : numeric(activity.distanceKm, 'Distanz'),
      elevationGainM: numeric(activity.elevationGainM, 'Höhenmeter'),
      durationSeconds: numeric(activity.durationSeconds, 'Dauer'),
      status: cleanText(activity.status) || 'planned',
      catalogEventId: cleanText(activity.catalogEventId) || null,
      catalogRouteId: cleanText(activity.catalogRouteId) || null,
      result,
      metadata,
      segments
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
    if (lapTimesSeconds.length > rounds) throw new RangeError('Es dürfen nicht mehr Rundenzeiten als absolvierte Runden erfasst werden.');
    const eliminatedAfterRound = input.eliminatedAfterRound == null ? null : wholeNumber(input.eliminatedAfterRound, 'Ausscheiden nach Runde', 0);
    if (eliminatedAfterRound !== null && eliminatedAfterRound > rounds) {
      throw new RangeError('Ausscheidungsrunde darf nicht über der Rundenanzahl liegen.');
    }
    return {
      format: 'backyard',
      rounds,
      lapLengthKm,
      totalDistanceKm: Number((rounds * lapLengthKm).toFixed(3)),
      lapTimesSeconds,
      outcome: cleanText(input.outcome) || 'in_progress',
      eliminatedAfterRound
    };
  }


  function wholeNumber(value, label, minimum) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < minimum) {
      throw new RangeError(label + ' muss eine ganze Zahl ab ' + minimum + ' sein.');
    }
    return number;
  }

  function normalizeRacketResult(input) {
    if (!input || typeof input !== 'object') throw new TypeError('Match-Ergebnis fehlt.');
    const sets = Array.isArray(input.sets) ? input.sets.map((set, index) => {
      if (!set || typeof set !== 'object') throw new TypeError('Satz ' + (index + 1) + ' ist ungültig.');
      return {
        home: wholeNumber(set.home, 'Punkte im Satz', 0),
        away: wholeNumber(set.away, 'Punkte im Satz', 0),
        tieBreakHome: set.tieBreakHome == null ? null : wholeNumber(set.tieBreakHome, 'Tie-Break', 0),
        tieBreakAway: set.tieBreakAway == null ? null : wholeNumber(set.tieBreakAway, 'Tie-Break', 0)
      };
    }) : [];
    for (const [index, set] of sets.entries()) {
      if ((set.tieBreakHome === null) !== (set.tieBreakAway === null)) {
        throw new TypeError('Tie-Break benötigt die Punkte beider Seiten (Satz ' + (index + 1) + ').');
      }
    }
    return {
      format: 'racket_match',
      opponent: cleanText(input.opponent) || null,
      partner: cleanText(input.partner) || null,
      competition: cleanText(input.competition) || null,
      sets,
      outcome: cleanText(input.outcome) || (sets.length ? 'played' : 'scheduled')
    };
  }

  function normalizeTeamResult(input) {
    if (!input || typeof input !== 'object') throw new TypeError('Spiel-Ergebnis fehlt.');
    const hasScoreFor = input.scoreFor != null && input.scoreFor !== '';
    const hasScoreAgainst = input.scoreAgainst != null && input.scoreAgainst !== '';
    if (hasScoreFor !== hasScoreAgainst) throw new TypeError('Beide Spielstände müssen gemeinsam angegeben werden.');
    const scoreFor = hasScoreFor ? wholeNumber(input.scoreFor, 'Eigener Spielstand', 0) : null;
    const scoreAgainst = hasScoreAgainst ? wholeNumber(input.scoreAgainst, 'Gegnerischer Spielstand', 0) : null;
    return {
      format: 'team_match',
      team: cleanText(input.team) || null,
      opponent: cleanText(input.opponent) || null,
      competition: cleanText(input.competition) || null,
      scoreFor,
      scoreAgainst,
      outcome: scoreFor === null ? (cleanText(input.outcome) || 'scheduled') : scoreFor > scoreAgainst ? 'win' : scoreFor < scoreAgainst ? 'loss' : 'draw',
      role: cleanText(input.role) || null,
      minutesPlayed: input.minutesPlayed == null ? null : wholeNumber(input.minutesPlayed, 'Einsatzminuten', 0)
    };
  }

  function normalizeStrengthResult(input) {
    if (!input || typeof input !== 'object') throw new TypeError('Krafttraining-Ergebnis fehlt.');
    const exercises = Array.isArray(input.exercises) ? input.exercises.map((exercise, index) => {
      if (!exercise || typeof exercise !== 'object' || !cleanText(exercise.name)) {
        throw new TypeError('Übung ' + (index + 1) + ' benötigt einen Namen.');
      }
      const sets = Array.isArray(exercise.sets) ? exercise.sets.map((set, setIndex) => {
        if (!set || typeof set !== 'object') throw new TypeError('Satz ' + (setIndex + 1) + ' ist ungültig.');
        const reps = set.reps == null ? null : wholeNumber(set.reps, 'Wiederholungen', 0);
        const durationSeconds = set.durationSeconds == null ? null : Number(set.durationSeconds);
        if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) {
          throw new RangeError('Satzdauer muss eine nichtnegative Zahl sein.');
        }
        if (reps === null && durationSeconds === null) throw new TypeError('Ein Satz benötigt Wiederholungen oder eine Dauer.');
        const weightKg = set.weightKg == null ? null : Number(set.weightKg);
        if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 0)) {
          throw new RangeError('Gewicht muss eine nichtnegative Zahl sein.');
        }
        return { reps, durationSeconds, weightKg };
      }) : [];
      return { name: cleanText(exercise.name), sets };
    }) : [];
    return { format: 'strength_training', exercises };
  }

  function normalizeSportResult(format, input) {
    switch (cleanText(format).toLowerCase()) {
      case 'backyard': return normalizeBackyardResult(input);
      case 'racket_match':
      case 'tennis':
      case 'padel':
      case 'badminton':
      case 'squash':
      case 'table_tennis': return normalizeRacketResult(input);
      case 'team_match':
      case 'football':
      case 'handball':
      case 'basketball':
      case 'volleyball':
      case 'hockey': return normalizeTeamResult(input);
      case 'strength_training':
      case 'fitness':
      case 'weight_training': return normalizeStrengthResult(input);
      default:
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          throw new TypeError('Sportartspezifisches Ergebnis muss ein Objekt sein.');
        }
        return { format: cleanText(format) || 'custom', ...input };
    }
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
    normalizeSegments,
    normalizeActivity,
    normalizeBackyardResult,
    normalizeRacketResult,
    normalizeTeamResult,
    normalizeStrengthResult,
    normalizeSportResult,
    summarizeActivity
  });

  root.SportYear = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
