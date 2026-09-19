/**
 * engine.js — Sample-clearance checker (backlog #16).
 *
 * Deterministic, zero-dependency. Runs identically in Node (tests) and the
 * browser (demo). Question text is token-matched only — never executed,
 * interpolated into answers, or echoed. The engine NEVER grants permission,
 * clears a sample, or offers legal conclusions: it reports verifiable facts
 * from rights-data.json and hands every question off to Business Affairs.
 *
 * Verdicts: "info-ready" (we hold verifiable facts) or "cannot-verify".
 * There is no "cleared" verdict. There never will be.
 */
'use strict';

function loadData() {
  if (typeof require === 'function') {
    // Node: rights-data.json sits next to this file.
    return require('./rights-data.json');
  }
  if (typeof window !== 'undefined' && window.__CWI_RIGHTS_DATA__) {
    return window.__CWI_RIGHTS_DATA__;
  }
  throw new Error('rights data not available');
}

function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const USE_TYPES = ['sample', 'interpolate', 'cover'];

function validUseType(u) {
  return USE_TYPES.includes(u) ? u : 'sample';
}

function findTrack(query, data) {
  const n = normalize(query);
  if (!n) return { status: 'empty' };
  const tracks = data.tracks || [];
  const exact = tracks.find(
    (t) => normalize(t.title) === n || (t.aliases || []).some((a) => normalize(a) === n)
  );
  if (exact) return { status: 'found', track: exact };
  // Single unambiguous near-miss -> suggest, but do NOT answer for it.
  const partial = tracks.filter(
    (t) => normalize(t.title).includes(n) || n.includes(normalize(t.title))
  );
  if (partial.length === 1) return { status: 'suggest', track: partial[0] };
  return { status: 'unknown' };
}

/**
 * check(trackQuery, useType) -> answer object.
 * Every answer carries the legal banner and the Business Affairs handoff.
 */
function check(trackQuery, useType, data) {
  const d = data || loadData();
  const use = validUseType(useType);
  const useInfo = d.use_types[use];
  const found = findTrack(trackQuery, d);

  const base = {
    banner: d.banner,
    clearance_path: d.clearance_path,
    contact: d.contact,
    global_gaps: d.global_gaps,
    use_type: use,
    use_type_label: useInfo.label,
    use_type_note: useInfo.note,
  };

  if (found.status === 'empty') {
    return Object.assign({}, base, {
      verdict: 'cannot-verify',
      title: 'No track entered',
      facts: [],
      unknown: ['Enter a track title to check what CWI can verify about it.'],
      note: 'Type a track name above, or pick one from the list.',
    });
  }

  if (found.status === 'suggest') {
    return Object.assign({}, base, {
      verdict: 'cannot-verify',
      title: 'Track not matched',
      facts: [],
      unknown: [
        'We could not match that title exactly. Did you mean "' +
          found.track.title +
          '"? Please enter the exact title — we never guess which track you mean when rights are involved.',
      ],
      note: null,
    });
  }

  if (found.status === 'unknown') {
    return Object.assign({}, base, {
      verdict: 'cannot-verify',
      title: 'Cannot verify — not in our records',
      facts: [],
      unknown: [
        'This title is not in CWI\u2019s rights records, so nothing about its rights holders, splits, PRO affiliation, or sample status can be verified here.',
        'If this is a CWI track, contact Business Affairs and they will check the underlying records directly.',
      ],
      note: null,
    });
  }

  const t = found.track;
  const unknown = [
    'Split percentages: no signed split sheets are on file for this track.',
    'Verified rights holders: cannot be confirmed from CWI\u2019s records.',
    'PRO affiliation: unknown — no publisher or work registration numbers on file.',
    'Sample attestation: no clearance letters and no sworn no-sample statement on file.',
  ];
  return Object.assign({}, base, {
    verdict: 'info-ready',
    title: t.title,
    facts: t.facts || [],
    unknown,
    spotify_track_id: t.spotify_track_id || null,
    note: 'Production credits are not rights-holder records. Only the facts above are verifiable; everything else needs Business Affairs.',
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { check, findTrack, normalize, validUseType, loadData, USE_TYPES };
}
